import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { audit } from './audit';
import type { Actor } from './context';
import { cssQueryFor, selectFaces } from './css-api';
import { db, schema } from './db';
import type { Breakpoints, RoleToken, TextStyle } from './db/schema';
import { loadPublishedFamilies } from './delivery';
import { badRequest } from './http';
import {
  DEFAULT_BREAKPOINTS,
  DEFAULT_ROLES,
  DEFAULT_TEXT_STYLES,
  STANDARD_STYLES,
  tokensToJson,
  usedFaces,
  type FamilyLookup,
  type TokenInput,
} from './tokens';

const ROLE_ORDER = ['heading', 'body', 'display', 'mono'];

/** Postgres jsonb does not keep key order; put the standard keys first, then the rest alphabetically. */
function ordered<T>(obj: Record<string, T>, order: string[]): Record<string, T> {
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)));
}

export async function listThemes(workspaceId: string) {
  const rows = await db.select({ theme: schema.tokenSets.theme }).from(schema.tokenSets).where(eq(schema.tokenSets.workspaceId, workspaceId));
  const themes = rows.map((r) => r.theme);
  return themes.includes('default') ? themes : ['default', ...themes];
}

export async function getTokenSet(workspaceId: string, theme = 'default'): Promise<TokenInput & { updatedAt: Date | null }> {
  const row = await db.query.tokenSets.findFirst({
    where: and(eq(schema.tokenSets.workspaceId, workspaceId), eq(schema.tokenSets.theme, theme)),
  });
  if (row) return { theme, roles: ordered(row.roles, ROLE_ORDER), textStyles: ordered(row.textStyles, STANDARD_STYLES), breakpoints: row.breakpoints, updatedAt: row.updatedAt };
  return { theme, roles: DEFAULT_ROLES, textStyles: DEFAULT_TEXT_STYLES, breakpoints: DEFAULT_BREAKPOINTS, updatedAt: null };
}

export async function saveTokenSet(
  actor: Actor,
  theme: string,
  data: { roles: Record<string, RoleToken>; textStyles: Record<string, TextStyle>; breakpoints: Breakpoints },
) {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(theme)) throw badRequest('Theme names use lowercase letters, numbers and dashes.');
  for (const [name, s] of Object.entries(data.textStyles)) {
    if (!data.roles[s.role]) throw badRequest(`Text style “${name}” uses the role “${s.role}”, which does not exist.`);
  }
  const familyIds = Object.values(data.roles).map((r) => r.familyId).filter(Boolean) as string[];
  if (familyIds.length) {
    const found = await db
      .select({ id: schema.families.id, status: schema.families.status, name: schema.families.displayName })
      .from(schema.families)
      .where(and(eq(schema.families.workspaceId, actor.workspace.id), inArray(schema.families.id, familyIds)));
    if (found.length !== new Set(familyIds).size) throw badRequest('A role points to a family that does not exist in this workspace.');
    const archived = found.find((f) => f.status === 'archived');
    if (archived) throw badRequest(`${archived.name} is archived. Restore it before using it in tokens.`);
  }
  const before = await getTokenSet(actor.workspace.id, theme);
  await db
    .insert(schema.tokenSets)
    .values({ workspaceId: actor.workspace.id, theme, ...data, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: [schema.tokenSets.workspaceId, schema.tokenSets.theme],
      set: { ...data, updatedAt: new Date(), updatedBy: actor.id },
    });
  await audit(actor, 'tokens.updated', { type: 'tokens', id: theme, label: `Theme “${theme}”` }, {
    before: { roles: before.roles },
    after: { roles: data.roles },
  });
  return getTokenSet(actor.workspace.id, theme);
}

export async function deleteTheme(actor: Actor, theme: string) {
  if (theme === 'default') throw badRequest('The default theme cannot be deleted.');
  await db.delete(schema.tokenSets).where(and(eq(schema.tokenSets.workspaceId, actor.workspace.id), eq(schema.tokenSets.theme, theme)));
  await audit(actor, 'tokens.theme_deleted', { type: 'tokens', id: theme, label: `Theme “${theme}”` });
}

/** Families referenced by tokens, keyed by id. Unpublished families resolve to fallbacks only. */
export async function familyLookup(workspaceId: string, opts: { publishedOnly?: boolean } = {}): Promise<FamilyLookup> {
  const fams = await db.select().from(schema.families).where(eq(schema.families.workspaceId, workspaceId));
  const map: FamilyLookup = new Map();
  for (const f of fams) {
    if (opts.publishedOnly && f.status !== 'published') continue;
    map.set(f.id, { cssName: f.cssName, fallbackStack: f.fallbackStack, hasFallbackFace: f.delivery === 'internal' && f.status === 'published', delivery: f.delivery });
  }
  return map;
}

/**
 * SDUI contract (DEV-3, DLV-3..5): one CSS URL for the faces the token set
 * renders, up to two preloads for above-the-fold faces, and preconnects only
 * when an external provider is used.
 */
export async function buildSdui(workspace: { id: string; slug: string }, origin: string, opts: { theme?: string; styles?: string[]; preload?: string[] } = {}) {
  const theme = opts.theme ?? 'default';
  const tokens = await getTokenSet(workspace.id, theme);
  const lookup = await familyLookup(workspace.id, { publishedOnly: true });
  const faces = usedFaces(tokens, lookup, opts.styles);
  const published = await loadPublishedFamilies(workspace.id, [...new Set(faces.map((f) => f.family))]);

  const css: string[] = [];
  const preload: string[] = [];
  const preconnect = new Set<string>();
  if (faces.length) {
    css.push(`${origin}/fonts/${workspace.slug}/css?${cssQueryFor(faces.map((f) => ({ family: f.family, weight: f.weight, italic: f.italic })))}`);
  }
  // Preload the latin WOFF2 of the faces used by the first above-the-fold styles.
  const preloadStyles = opts.preload ?? ['h1', 'body'];
  for (const styleName of preloadStyles) {
    if (preload.length >= 2) break;
    const face = faces.find((f) => f.styles.includes(styleName));
    if (!face) continue;
    const entry = published.get(face.family.toLowerCase());
    if (!entry) continue;
    if (entry.family.delivery === 'external') continue;
    const { selected } = selectFaces(entry.faces, { name: face.family, tags: ['ital', 'wght'], raw: '', tuples: [{ ital: face.italic ? 1 : 0, wght: [face.weight, face.weight], wdth: null, axes: {} }] });
    const file = selected[0]?.face.files.find((f) => f.format === 'woff2' && (f.subset === 'latin' || f.subset === 'all'));
    const url = file && `${origin}/fonts/files/${file.name}`;
    if (url && !preload.includes(url)) preload.push(url);
  }
  for (const entry of published.values()) {
    if (entry.family.delivery !== 'external') continue;
    if (entry.family.external?.provider === 'google') {
      preconnect.add('https://fonts.googleapis.com');
      preconnect.add('https://fonts.gstatic.com');
    } else if (entry.family.external?.cssUrl) {
      preconnect.add(new URL(entry.family.external.cssUrl).origin);
    }
  }
  return {
    fonts: { css, preload, preconnect: [...preconnect] },
    typography: {
      theme,
      css: `${origin}/fonts/${workspace.slug}/tokens.css?theme=${encodeURIComponent(theme)}`,
      tokens: tokensToJson(tokens, lookup),
    },
    faces: faces.map((f) => ({ family: f.family, weight: f.weight, style: f.italic ? 'italic' : 'normal', usedBy: f.styles })),
  };
}
