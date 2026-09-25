import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { audit } from './audit';
import type { Actor } from './context';
import { parseFontFaces } from './css-import';
import { db, schema } from './db';
import type { Axis, FamilyStatus, Licence } from './db/schema';
import { facesForVersions } from './delivery';
import { defaultFallbackStack } from './fonts/metadata';
import { slugify } from './fonts/process';
import { findGoogle, googleLicenceType, type GoogleSelection } from './google';
import { badRequest, conflict, notFound } from './http';
import { safeFetchText } from './safe-fetch';

type Family = typeof schema.families.$inferSelect;

/* ------------------------------------------------------------------ */
/* Usage                                                              */
/* ------------------------------------------------------------------ */

export async function usageByFamily(workspaceId: string) {
  const sets = await db.select().from(schema.tokenSets).where(eq(schema.tokenSets.workspaceId, workspaceId));
  const usage = new Map<string, { theme: string; role: string; styles: string[] }[]>();
  for (const set of sets) {
    for (const [role, token] of Object.entries(set.roles)) {
      if (!token.familyId) continue;
      const styles = Object.entries(set.textStyles).filter(([, s]) => s.role === role).map(([k]) => k);
      usage.set(token.familyId, [...(usage.get(token.familyId) ?? []), { theme: set.theme, role, styles }]);
    }
  }
  return usage;
}

/* ------------------------------------------------------------------ */
/* Listing (LIB-1, LIB-2)                                             */
/* ------------------------------------------------------------------ */

export interface ListFilters {
  q?: string;
  source?: string;
  type?: string;
  status?: string;
  tag?: string;
  licence?: 'missing' | 'recorded';
  used?: 'used' | 'unused';
  includeArchived?: boolean;
}

export async function listFamilies(workspaceId: string, filters: ListFilters = {}) {
  const where = [eq(schema.families.workspaceId, workspaceId)];
  if (filters.q) where.push(sql`(${schema.families.displayName} ilike ${'%' + filters.q + '%'} or ${schema.families.cssName} ilike ${'%' + filters.q + '%'})`);
  if (filters.source) where.push(eq(schema.families.source, filters.source as Family['source']));
  if (filters.type) where.push(eq(schema.families.type, filters.type as Family['type']));
  if (filters.status) where.push(eq(schema.families.status, filters.status as FamilyStatus));
  else if (!filters.includeArchived) where.push(sql`${schema.families.status} <> 'archived'`);
  if (filters.tag) where.push(sql`${schema.families.tags} ? ${filters.tag}`);
  if (filters.licence === 'missing') where.push(sql`(${schema.families.licence}->>'type') is null`);
  if (filters.licence === 'recorded') where.push(sql`(${schema.families.licence}->>'type') is not null`);

  const fams = await db.select().from(schema.families).where(and(...where)).orderBy(asc(schema.families.displayName));
  const usage = await usageByFamily(workspaceId);

  // Latest version per family (drafts included) for counts and sizes.
  const latest = fams.length
    ? await db
        .selectDistinctOn([schema.versions.familyId])
        .from(schema.versions)
        .where(inArray(schema.versions.familyId, fams.map((f) => f.id)))
        .orderBy(schema.versions.familyId, desc(schema.versions.number))
    : [];
  const latestByFamily = new Map(latest.map((v) => [v.familyId, v]));
  const showVersionIds = fams.map((f) => f.currentVersionId ?? latestByFamily.get(f.id)?.id).filter(Boolean) as string[];
  const faces = await facesForVersions(showVersionIds);

  let rows = fams.map((f) => {
    const versionId = f.currentVersionId ?? latestByFamily.get(f.id)?.id ?? null;
    const vf = versionId ? faces.get(versionId) ?? [] : [];
    const woff2Bytes = vf.flatMap((x) => x.files).filter((x) => x.format === 'woff2').reduce((a, b) => a + b.bytes, 0);
    const latestVersion = latestByFamily.get(f.id);
    return {
      family: f,
      previewVersionId: versionId,
      faces: vf,
      facesCount: vf.length,
      woff2Bytes,
      usage: usage.get(f.id) ?? [],
      pendingDraft: Boolean(f.currentVersionId && latestVersion && latestVersion.id !== f.currentVersionId && latestVersion.status === 'draft'),
      latestVersion,
    };
  });
  if (filters.used === 'used') rows = rows.filter((r) => r.usage.length);
  if (filters.used === 'unused') rows = rows.filter((r) => !r.usage.length);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

export async function getFamily(workspaceId: string, idOrSlug: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const family = await db.query.families.findFirst({
    where: and(eq(schema.families.workspaceId, workspaceId), isUuid ? eq(schema.families.id, idOrSlug) : eq(schema.families.slug, idOrSlug)),
  });
  if (!family) throw notFound('Family not found.');
  return family;
}

export async function getFamilyDetail(workspaceId: string, idOrSlug: string) {
  const family = await getFamily(workspaceId, idOrSlug);
  const versions = await db
    .select({ v: schema.versions, author: schema.users.name })
    .from(schema.versions)
    .leftJoin(schema.users, eq(schema.users.id, schema.versions.createdBy))
    .where(eq(schema.versions.familyId, family.id))
    .orderBy(desc(schema.versions.number));
  const faces = await facesForVersions(versions.map((v) => v.v.id));
  const usage = (await usageByFamily(workspaceId)).get(family.id) ?? [];
  return {
    family,
    versions: versions.map(({ v, author }) => ({ ...v, author, faces: faces.get(v.id) ?? [] })),
    usage,
  };
}

/** Management API representation (matches the PRD contract). */
export async function serializeFamily(workspaceId: string, family: Family, origin: string) {
  const detail = await getFamilyDetail(workspaceId, family.id);
  const current = detail.versions.find((v) => v.id === family.currentVersionId) ?? detail.versions[0];
  const creator = family.createdBy ? await db.query.users.findFirst({ where: eq(schema.users.id, family.createdBy), columns: { name: true } }) : null;
  return {
    id: family.id,
    slug: family.slug,
    display_name: family.displayName,
    css_name: family.cssName,
    source: family.source,
    delivery: family.delivery,
    type: family.type,
    category: family.category,
    fallback_stack: family.fallbackStack,
    display: family.display,
    tags: family.tags,
    status: family.status,
    version: current?.number ?? null,
    current_version_id: family.currentVersionId,
    external: family.external,
    faces: (current?.faces ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      style: f.style,
      weight: f.weightMin === f.weightMax ? f.weightMin : `${f.weightMin} ${f.weightMax}`,
      stretch: f.stretchMin === f.stretchMax ? `${f.stretchMin}%` : `${f.stretchMin}% ${f.stretchMax}%`,
      axes: f.axes.map((a) => ({ tag: a.tag, min: a.min, max: a.max, default: a.default })),
      named_instances: f.namedInstances.map((n) => n.name),
      files: f.files.map((file) => ({
        format: file.format,
        subset: file.subset,
        bytes: file.bytes,
        unicode_range: file.unicodeRange,
        url: `${origin}/fonts/files/${file.name}`,
      })),
    })),
    versions: detail.versions.map((v) => ({ id: v.id, number: v.number, status: v.status, created_at: v.createdAt, published_at: v.publishedAt })),
    licence: family.licence,
    usage: { tokens: detail.usage.map((u) => `${u.theme}:${u.role}`) },
    created_by: creator?.name ?? null,
    created_at: family.createdAt,
    updated_at: family.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Edits (LIB-5)                                                      */
/* ------------------------------------------------------------------ */

export interface FamilyPatch {
  displayName?: string;
  cssName?: string;
  category?: string;
  fallbackStack?: string[];
  display?: string;
  tags?: string[];
  licence?: Licence;
}

export async function updateFamily(actor: Actor, id: string, patch: FamilyPatch) {
  const family = await getFamily(actor.workspace.id, id);
  if (patch.licence) actor.assert('licence');
  if (patch.cssName && patch.cssName.toLowerCase() !== family.cssName.toLowerCase()) {
    const clash = await db.query.families.findFirst({
      where: and(eq(schema.families.workspaceId, actor.workspace.id), sql`lower(${schema.families.cssName}) = ${patch.cssName.toLowerCase()}`),
    });
    if (clash) throw conflict(`Another family already uses the CSS name “${patch.cssName}”.`);
  }
  const next = {
    ...(patch.displayName !== undefined && { displayName: patch.displayName.trim() }),
    ...(patch.cssName !== undefined && { cssName: patch.cssName.trim() }),
    ...(patch.category !== undefined && { category: patch.category }),
    ...(patch.fallbackStack !== undefined && { fallbackStack: patch.fallbackStack.map((s) => s.trim()).filter(Boolean) }),
    ...(patch.display !== undefined && { display: patch.display }),
    ...(patch.tags !== undefined && { tags: [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))] }),
    ...(patch.licence !== undefined && { licence: { ...family.licence, ...patch.licence } }),
  };
  const [updated] = await db.update(schema.families).set({ ...next, updatedAt: new Date() }).where(eq(schema.families.id, family.id)).returning();
  const before = Object.fromEntries(Object.keys(next).map((k) => [k, family[k as keyof Family]]));
  await audit(actor, patch.licence ? 'family.licence_updated' : 'family.updated', { type: 'family', id: family.id, label: family.displayName }, { before, after: next });
  return updated;
}

export async function updateFace(
  actor: Actor,
  familyId: string,
  faceId: string,
  patch: { name?: string; style?: 'normal' | 'italic'; weightMin?: number; weightMax?: number },
) {
  const family = await getFamily(actor.workspace.id, familyId);
  const [row] = await db
    .select({ face: schema.faces, version: schema.versions })
    .from(schema.faces)
    .innerJoin(schema.versions, eq(schema.versions.id, schema.faces.versionId))
    .where(and(eq(schema.faces.id, faceId), eq(schema.versions.familyId, family.id)));
  if (!row) throw notFound('Face not found.');
  if (row.version.status !== 'draft') throw badRequest('Only faces in a draft version can be edited. Create a new version to change a published one.');
  const weightMin = patch.weightMin ?? row.face.weightMin;
  const weightMax = patch.weightMax ?? (row.face.axes.length ? row.face.weightMax : weightMin);
  if (weightMin < 1 || weightMax > 1000 || weightMin > weightMax) throw badRequest('Weight must be between 1 and 1000.');
  const [face] = await db
    .update(schema.faces)
    .set({ name: patch.name ?? row.face.name, style: patch.style ?? row.face.style, weightMin, weightMax })
    .where(eq(schema.faces.id, faceId))
    .returning();
  await audit(actor, 'face.updated', { type: 'family', id: family.id, label: `${family.displayName} v${row.version.number} · ${face.name}` }, {
    before: { name: row.face.name, style: row.face.style, weight: [row.face.weightMin, row.face.weightMax] },
    after: { name: face.name, style: face.style, weight: [face.weightMin, face.weightMax] },
  });
  return face;
}

/* ------------------------------------------------------------------ */
/* Governance (GOV-1..3, LIB-6)                                       */
/* ------------------------------------------------------------------ */

async function versionOf(familyId: string, versionIdOrNumber: string) {
  const byNumber = /^\d+$/.test(versionIdOrNumber);
  const version = await db.query.versions.findFirst({
    where: and(eq(schema.versions.familyId, familyId), byNumber ? eq(schema.versions.number, Number(versionIdOrNumber)) : eq(schema.versions.id, versionIdOrNumber)),
  });
  if (!version) throw notFound('Version not found.');
  return version;
}

async function switchCurrent(actor: Actor, family: Family, versionId: string, action: 'version.published' | 'family.rolled_back') {
  const version = await versionOf(family.id, versionId);
  if (!['draft', 'published', 'archived'].includes(version.status)) {
    throw badRequest(`Version ${version.number} is ${version.status} and cannot go live.`);
  }
  const faces = await db.select({ id: schema.faces.id }).from(schema.faces).where(eq(schema.faces.versionId, version.id));
  if (!faces.length) throw badRequest(`Version ${version.number} has no faces.`);
  const [{ n: fileCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.files)
    .where(inArray(schema.files.faceId, faces.map((f) => f.id)));
  const previous = family.currentVersionId;
  await db.transaction(async (tx) => {
    if (previous && previous !== version.id) {
      await tx.update(schema.versions).set({ status: 'archived' }).where(eq(schema.versions.id, previous));
    }
    await tx.update(schema.versions).set({ status: 'published', publishedAt: new Date() }).where(eq(schema.versions.id, version.id));
    await tx
      .update(schema.families)
      .set({
        currentVersionId: version.id,
        status: 'published',
        delivery: fileCount > 0 ? 'internal' : 'external',
        updatedAt: new Date(),
      })
      .where(eq(schema.families.id, family.id));
  });
  const prevNumber = previous ? (await db.query.versions.findFirst({ where: eq(schema.versions.id, previous) }))?.number : null;
  await audit(actor, action, { type: 'family', id: family.id, label: `${family.displayName} v${version.number}` }, {
    before: { version: prevNumber ?? null },
    after: { version: version.number },
  });
  return version;
}

export async function publishVersion(actor: Actor, familyId: string, versionId: string, opts: { licenceConfirmed?: boolean } = {}) {
  const family = await getFamily(actor.workspace.id, familyId);
  if (family.status === 'archived') throw badRequest('Restore the family before publishing.');
  const version = await versionOf(family.id, versionId);
  if (version.status !== 'draft') throw badRequest(`Only draft versions can be published (v${version.number} is ${version.status}). Use rollback for older versions.`);
  const hasLicence = Boolean(family.licence.type || family.licence.confirmedAt);
  if (!hasLicence && !opts.licenceConfirmed) {
    throw badRequest('Confirm you are licensed to self-host and serve this font before publishing.', { code: 'licence_required' });
  }
  if (!hasLicence && opts.licenceConfirmed) {
    await db
      .update(schema.families)
      .set({ licence: { ...family.licence, confirmedBy: actor.label, confirmedAt: new Date().toISOString() } })
      .where(eq(schema.families.id, family.id));
  }
  return switchCurrent(actor, family, version.id, 'version.published');
}

export async function rollback(actor: Actor, familyId: string, versionId: string) {
  const family = await getFamily(actor.workspace.id, familyId);
  const version = await versionOf(family.id, versionId);
  if (version.id === family.currentVersionId) throw badRequest(`Version ${version.number} is already live.`);
  if (version.status !== 'archived') throw badRequest('You can only roll back to a previously published version.');
  return switchCurrent(actor, family, version.id, 'family.rolled_back');
}

export async function discardDraft(actor: Actor, familyId: string, versionId: string) {
  const family = await getFamily(actor.workspace.id, familyId);
  const version = await versionOf(family.id, versionId);
  if (!['draft', 'failed'].includes(version.status)) throw badRequest('Only draft or failed versions can be discarded.');
  await db.delete(schema.versions).where(eq(schema.versions.id, version.id));
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.versions).where(eq(schema.versions.familyId, family.id));
  await audit(actor, 'version.discarded', { type: 'family', id: family.id, label: `${family.displayName} v${version.number}` });
  if (n === 0) {
    await db.delete(schema.families).where(eq(schema.families.id, family.id));
    return { familyDeleted: true };
  }
  return { familyDeleted: false };
}

export async function setArchived(actor: Actor, familyId: string, archived: boolean) {
  const family = await getFamily(actor.workspace.id, familyId);
  if (archived) {
    const usage = (await usageByFamily(actor.workspace.id)).get(family.id) ?? [];
    if (usage.length) {
      throw conflict(`${family.displayName} is used by ${usage.map((u) => `the ${u.role} role (${u.theme})`).join(', ')}. Reassign it first.`, { usage });
    }
  }
  const status: FamilyStatus = archived ? 'archived' : family.currentVersionId ? 'published' : 'draft';
  await db.update(schema.families).set({ status, updatedAt: new Date() }).where(eq(schema.families.id, family.id));
  await audit(actor, archived ? 'family.archived' : 'family.restored', { type: 'family', id: family.id, label: family.displayName });
}

export async function deleteFamily(actor: Actor, familyId: string) {
  const family = await getFamily(actor.workspace.id, familyId);
  const usage = (await usageByFamily(actor.workspace.id)).get(family.id) ?? [];
  if (usage.length) {
    throw conflict(`${family.displayName} is in use by ${usage.map((u) => `${u.role} (${u.theme})`).join(', ')}. Reassign those roles before deleting.`, { usage });
  }
  await db.delete(schema.families).where(eq(schema.families.id, family.id));
  await audit(actor, 'family.deleted', { type: 'family', id: family.id, label: family.displayName }, { before: { cssName: family.cssName, source: family.source } });
}

/* ------------------------------------------------------------------ */
/* External families (SRC-4 load external, SRC-5)                    */
/* ------------------------------------------------------------------ */

async function uniqueSlug(workspaceId: string, base: string) {
  const rows = await db.select({ slug: schema.families.slug }).from(schema.families)
    .where(and(eq(schema.families.workspaceId, workspaceId), sql`${schema.families.slug} like ${base + '%'}`));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

async function assertNameFree(workspaceId: string, cssName: string) {
  const clash = await db.query.families.findFirst({
    where: and(eq(schema.families.workspaceId, workspaceId), sql`lower(${schema.families.cssName}) = ${cssName.toLowerCase()}`),
  });
  if (clash) throw conflict(`“${cssName}” is already in the library.`, { familyId: clash.id, slug: clash.slug });
}

export async function addGoogleExternal(actor: Actor, name: string, sel: GoogleSelection) {
  const entry = await findGoogle(name);
  if (!entry) throw notFound(`“${name}” is not in the Google Fonts catalogue.`);
  await assertNameFree(actor.workspace.id, entry.family);
  const axes: Axis[] = entry.axes.filter((a) => a.tag !== 'ital');
  const wght = axes.find((a) => a.tag === 'wght');
  const [family] = await db
    .insert(schema.families)
    .values({
      workspaceId: actor.workspace.id,
      slug: await uniqueSlug(actor.workspace.id, slugify(entry.family)),
      displayName: entry.family,
      cssName: entry.family,
      source: 'google',
      delivery: 'external',
      type: wght ? 'variable' : 'static',
      category: entry.category,
      fallbackStack: defaultFallbackStack(entry.category),
      status: 'draft',
      external: { provider: 'google', family: entry.family, axes },
      licence: { type: googleLicenceType(entry.licence), owner: 'Google Fonts', allowedDomains: ['*'] },
      createdBy: actor.id,
    })
    .returning();
  const [version] = await db
    .insert(schema.versions)
    .values({ familyId: family.id, number: 1, status: 'draft', createdBy: actor.id, note: 'Loaded from Google Fonts' })
    .returning();

  const styles = sel.styles.filter((s) => s === 'normal' || entry.variants.some((v) => v.endsWith('i')));
  const faceRows = wght
    ? styles.map((style) => ({
        versionId: version.id,
        name: `Variable ${style === 'italic' ? 'Italic' : 'Roman'}`,
        style,
        weightMin: wght.min,
        weightMax: wght.max,
        axes,
      }))
    : entry.variants
        .map((v) => ({ weight: parseInt(v, 10), style: (v.endsWith('i') ? 'italic' : 'normal') as 'normal' | 'italic' }))
        .filter((v) => styles.includes(v.style) && (!sel.weights.length || sel.weights.includes(v.weight)))
        .map((v) => ({ versionId: version.id, name: `${v.weight}${v.style === 'italic' ? ' Italic' : ''}`, style: v.style, weightMin: v.weight, weightMax: v.weight, axes: [] }));
  if (!faceRows.length) throw badRequest('Pick at least one weight and style.');
  await db.insert(schema.faces).values(faceRows.map((f) => ({ ...f, scripts: entry.subsets })));
  await audit(actor, 'family.created', { type: 'family', id: family.id, label: family.displayName }, { after: { source: 'google', delivery: 'external' } });
  return family;
}

export async function addCustomUrlExternal(actor: Actor, cssUrl: string) {
  const css = await safeFetchText(cssUrl).catch((e) => {
    throw badRequest(`Could not fetch the stylesheet: ${(e as Error).message}`);
  });
  const faces = parseFontFaces(css, cssUrl);
  if (!faces.length) throw badRequest('No @font-face rules were found at that URL.');
  const byFamily = new Map<string, typeof faces>();
  for (const f of faces) byFamily.set(f.family, [...(byFamily.get(f.family) ?? []), f]);
  const created: Family[] = [];
  for (const [name, list] of byFamily) {
    await assertNameFree(actor.workspace.id, name);
    const [family] = await db
      .insert(schema.families)
      .values({
        workspaceId: actor.workspace.id,
        slug: await uniqueSlug(actor.workspace.id, slugify(name)),
        displayName: name,
        cssName: name,
        source: 'custom_url',
        delivery: 'external',
        type: list.some((f) => /\d+\s+\d+/.test(f.weight)) ? 'variable' : 'static',
        category: 'sans-serif',
        fallbackStack: defaultFallbackStack('sans-serif'),
        status: 'draft',
        external: { provider: 'css', cssUrl },
        createdBy: actor.id,
      })
      .returning();
    const [version] = await db
      .insert(schema.versions)
      .values({ familyId: family.id, number: 1, status: 'draft', createdBy: actor.id, note: `Loaded from ${new URL(cssUrl).host}` })
      .returning();
    const unique = new Map<string, (typeof list)[number]>();
    for (const f of list) unique.set(`${f.weight}|${f.style}`, f);
    await db.insert(schema.faces).values(
      [...unique.values()].map((f) => {
        const [a, b] = f.weight.split(/\s+/).map((w) => (w === 'bold' ? 700 : w === 'normal' ? 400 : Number(w) || 400));
        const style = f.style === 'italic' || f.style === 'oblique' ? 'italic' : 'normal';
        return {
          versionId: version.id,
          name: `${a}${b ? `–${b}` : ''}${style === 'italic' ? ' Italic' : ''}`,
          style: style as 'normal' | 'italic',
          weightMin: a,
          weightMax: b ?? a,
          axes: b ? [{ tag: 'wght', min: a, max: b, default: Math.min(Math.max(400, a), b) }] : [],
        };
      }),
    );
    await audit(actor, 'family.created', { type: 'family', id: family.id, label: name }, { after: { source: 'custom_url', cssUrl } });
    created.push(family);
  }
  return created;
}
