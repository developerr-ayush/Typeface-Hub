import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { audit } from '@/lib/audit';
import type { Actor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import type { PublishedIconFont } from '@/lib/db/schema';
import { slugify } from '@/lib/fonts/process';
import { conflict, notFound } from '@/lib/http';
import { putObject } from '@/lib/storage';
import { buildFontFiles, iconCss, resolveConfig } from './build';
import { emptyConfig, IconFontConfigSchema, type IconFontConfig } from './config';

export type IconFont = typeof schema.iconFonts.$inferSelect;

export async function listIconFonts(workspaceId: string) {
  return db.query.iconFonts.findMany({ where: eq(schema.iconFonts.workspaceId, workspaceId), orderBy: [desc(schema.iconFonts.updatedAt)] });
}

export async function getIconFont(workspaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Icon font not found.');
  const row = await db.query.iconFonts.findFirst({ where: and(eq(schema.iconFonts.workspaceId, workspaceId), eq(schema.iconFonts.id, id)) });
  if (!row) throw notFound('Icon font not found.');
  return row;
}

async function uniqueSlug(workspaceId: string, base: string) {
  const rows = await db.select({ slug: schema.iconFonts.slug }).from(schema.iconFonts).where(eq(schema.iconFonts.workspaceId, workspaceId));
  const taken = new Set(rows.map((r) => r.slug));
  const clean = slugify(base).slice(0, 40);
  if (!taken.has(clean)) return clean;
  for (let i = 2; ; i++) if (!taken.has(`${clean}-${i}`)) return `${clean}-${i}`;
}

export async function createIconFont(actor: Actor, input: Partial<IconFontConfig>) {
  const config = IconFontConfigSchema.parse({ ...emptyConfig(), ...input });
  const slug = await uniqueSlug(actor.workspace.id, config.name);
  const [row] = await db.insert(schema.iconFonts).values({ workspaceId: actor.workspace.id, slug, config, createdBy: actor.id }).returning();
  await audit(actor, 'icon_font.create', { type: 'icon_font', id: row.id, label: config.name }, { after: { glyphs: config.glyphs.length } });
  return row;
}

export async function saveIconFont(actor: Actor, id: string, input: unknown) {
  const existing = await getIconFont(actor.workspace.id, id);
  const config = IconFontConfigSchema.parse(input);
  const [row] = await db.update(schema.iconFonts).set({ config, updatedAt: new Date() }).where(eq(schema.iconFonts.id, existing.id)).returning();
  await audit(actor, 'icon_font.update', { type: 'icon_font', id, label: config.name }, { before: { glyphs: existing.config.glyphs.length }, after: { glyphs: config.glyphs.length } });
  return row;
}

export async function deleteIconFont(actor: Actor, id: string) {
  const existing = await getIconFont(actor.workspace.id, id);
  await db.delete(schema.iconFonts).where(eq(schema.iconFonts.id, existing.id));
  await audit(actor, 'icon_font.delete', { type: 'icon_font', id, label: existing.config.name });
}

/** Build the saved config and make it live at /fonts/{workspace}/icons/{slug}.css. */
export async function publishIconFont(actor: Actor, id: string) {
  const existing = await getIconFont(actor.workspace.id, id);
  if (!existing.config.glyphs.length) throw conflict('Add at least one icon before publishing.');
  const { glyphs, config } = await resolveConfig(existing.config);
  const files = await buildFontFiles(config.name, glyphs);
  const base = `${existing.slug}-icons.${files.hash}`;
  await putObject(`files/${base}.woff2`, files.woff2, 'font/woff2');
  await putObject(`files/${base}.woff`, files.woff, 'font/woff');
  const published: PublishedIconFont = {
    hash: files.hash,
    woff2: `${base}.woff2`,
    woff: `${base}.woff`,
    glyphs: glyphs.length,
    bytes: files.woff2.byteLength,
    publishedAt: new Date().toISOString(),
    name: config.name,
    prefix: config.prefix,
    suffix: config.suffix,
    codes: glyphs.map((g) => ({ css: g.css, code: g.code })),
  };
  const [row] = await db.update(schema.iconFonts).set({ published }).where(eq(schema.iconFonts.id, existing.id)).returning();
  await audit(actor, 'icon_font.publish', { type: 'icon_font', id, label: config.name }, { before: existing.published ? { hash: existing.published.hash } : null, after: { hash: files.hash, glyphs: glyphs.length } });
  return row;
}

/** The public stylesheet of a published icon font. */
export async function publishedIconCss(workspaceSlug: string, slug: string, origin: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, workspaceSlug), columns: { id: true } });
  if (!ws) return null;
  const row = await db.query.iconFonts.findFirst({ where: and(eq(schema.iconFonts.workspaceId, ws.id), eq(schema.iconFonts.slug, slug)) });
  if (!row?.published) return null;
  const p = row.published;
  const cfg = { name: p.name, prefix: p.prefix, suffix: p.suffix };
  return iconCss(cfg, p.codes, { woff2: `${origin}/fonts/files/${p.woff2}`, woff: `${origin}/fonts/files/${p.woff}` }, `/* ${p.name} icon font · published ${p.publishedAt.slice(0, 10)} · Typeface Hub */\n`);
}
