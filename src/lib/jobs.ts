import 'server-only';
import { and, desc, eq, inArray, or, sql, lt } from 'drizzle-orm';
import { after } from 'next/server';
import { audit } from './audit';
import type { Actor } from './context';
import { bestSource, parseFontFaces } from './css-import';
import { db, schema } from './db';
import type { ExternalConfig, FamilySource, JobKind, Licence, VersionReport } from './db/schema';
import { defaultFallbackStack, FontError, guessCategory, MIME, readFont } from './fonts/metadata';
import { buildFace, faceSlugFor, instanceFont, sha256, slugify, type AxisLimits } from './fonts/process';
import { fetchGoogleMasters, findGoogle, googleLicenceType, type GoogleSelection } from './google';
import { cleanCssName } from './css-names';
import { safeFetchBuffer, safeFetchText } from './safe-fetch';
import { getObject, putObject } from './storage';
import { discardUploads, readUpload, type UploadRef } from './uploads';

type Job = typeof schema.jobs.$inferSelect;

export interface UploadJobInput {
  files: (UploadRef & { family: string })[];
  licenceConfirmed: boolean;
}
export interface GoogleJobInput {
  family: string;
  selection: GoogleSelection;
  axisLimits?: AxisLimits;
}
export interface CssJobInput {
  cssUrl?: string;
  cssText?: string;
  baseUrl?: string;
  families?: string[];
  legacy?: boolean;
}
export interface ReprocessJobInput {
  familyId: string;
  versionId: string;
  axisLimits: AxisLimits;
}

export async function createJob(actor: Actor, kind: JobKind, title: string, input: object) {
  const [job] = await db
    .insert(schema.jobs)
    .values({ workspaceId: actor.workspace.id, kind, title, input: input as Record<string, unknown>, createdBy: actor.id })
    .returning();
  await audit(actor, 'job.created', { type: 'job', id: job.id, label: title });
  return job;
}

/** Run a job after the response is sent (Vercel keeps the function alive until it finishes). */
export function startJob(jobId: string) {
  after(() => runJob(jobId).catch((e) => console.error('[jobs] run failed', e)));
}

const STALE_MINUTES = 5;
const MAX_ATTEMPTS = 3;

export async function runJob(jobId: string) {
  // Claim the job atomically so it never runs twice at the same time. A job
  // still marked processing but without a recent heartbeat has died and can be taken over.
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60_000);
  const [job] = await db
    .update(schema.jobs)
    .set({ status: 'processing', startedAt: new Date(), heartbeatAt: new Date(), step: 'Starting', error: null, attempts: sql`${schema.jobs.attempts} + 1` })
    .where(
      and(
        eq(schema.jobs.id, jobId),
        lt(schema.jobs.attempts, MAX_ATTEMPTS),
        or(
          eq(schema.jobs.status, 'queued'),
          and(eq(schema.jobs.status, 'processing'), sql`coalesce(${schema.jobs.heartbeatAt}, ${schema.jobs.startedAt}) < ${staleBefore.toISOString()}`),
        ),
      ),
    )
    .returning();
  if (!job) return;

  const ctx = new JobContext(job);
  try {
    await cleanupPartial(job.id);
    switch (job.kind) {
      case 'upload':
        await runUpload(ctx, job.input as unknown as UploadJobInput);
        break;
      case 'google_import':
        await runGoogleImport(ctx, job.input as unknown as GoogleJobInput);
        break;
      case 'css_import':
        await runCssImport(ctx, job.input as unknown as CssJobInput);
        break;
      case 'reprocess':
        await runReprocess(ctx, job.input as unknown as ReprocessJobInput);
        break;
    }
    await db
      .update(schema.jobs)
      .set({ status: 'ready', step: 'Done', finishedAt: new Date(), result: { families: ctx.results } })
      .where(eq(schema.jobs.id, job.id));
    if (job.kind === 'upload') await discardUploads((job.input as unknown as UploadJobInput).files);
  } catch (e) {
    const err = e as FontError;
    const message = err.fix ? `${err.message} ${err.fix}` : err.message || 'Processing failed.';
    console.error(`[jobs] ${job.id} failed at “${ctx.step}”:`, e);
    await markFailed(job.id);
    await db
      .update(schema.jobs)
      .set({ status: 'failed', error: message, step: ctx.step, finishedAt: new Date(), result: { families: ctx.results } })
      .where(eq(schema.jobs.id, job.id));
    await db.insert(schema.auditEvents).values({
      workspaceId: job.workspaceId,
      actorId: null,
      actorLabel: 'Processing pipeline',
      action: 'job.failed',
      targetType: 'job',
      targetId: job.id,
      targetLabel: job.title,
      after: { error: message, step: ctx.step },
    });
  }
}

/**
 * Pick up jobs that never started (for example the server stopped before the
 * background task ran) or stopped sending heartbeats (the server restarted
 * mid-job). Jobs that died MAX_ATTEMPTS times are marked failed.
 */
export async function resumeStaleJobs(workspaceId: string, opts: { inline?: boolean } = {}) {
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60_000);
  const queuedBefore = new Date(Date.now() - 30_000);
  const stuck = await db
    .select({ id: schema.jobs.id, attempts: schema.jobs.attempts, status: schema.jobs.status })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.workspaceId, workspaceId),
        or(
          and(eq(schema.jobs.status, 'queued'), lt(schema.jobs.createdAt, queuedBefore)),
          and(eq(schema.jobs.status, 'processing'), sql`coalesce(${schema.jobs.heartbeatAt}, ${schema.jobs.startedAt}) < ${staleBefore.toISOString()}`),
        ),
      ),
    )
    .limit(10);
  for (const job of stuck) {
    if (job.attempts >= MAX_ATTEMPTS) {
      await markFailed(job.id);
      await db
        .update(schema.jobs)
        .set({ status: 'failed', error: `Processing stopped responding ${job.attempts} times. Check the files and retry.`, finishedAt: new Date() })
        .where(eq(schema.jobs.id, job.id));
    } else if (opts.inline) {
      // Already running in the background (after the response): process here.
      await runJob(job.id).catch((e) => console.error('[jobs] resume failed', e));
    } else {
      startJob(job.id);
    }
  }
  return stuck.length;
}

export async function retryJob(actor: Actor, jobId: string) {
  const [job] = await db
    .update(schema.jobs)
    .set({ status: 'queued', error: null, step: null, finishedAt: null, attempts: 0 })
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.workspaceId, actor.workspace.id), inArray(schema.jobs.status, ['failed', 'processing'])))
    .returning();
  if (!job) return null;
  await audit(actor, 'job.retried', { type: 'job', id: job.id, label: job.title });
  startJob(job.id);
  return job;
}

/** Versions a failed attempt left behind are removed before a retry. */
async function cleanupPartial(jobId: string) {
  const partial = await db
    .select({ id: schema.versions.id, familyId: schema.versions.familyId })
    .from(schema.versions)
    .where(and(eq(schema.versions.jobId, jobId), inArray(schema.versions.status, ['processing', 'failed'])));
  if (!partial.length) return;
  await db.delete(schema.versions).where(inArray(schema.versions.id, partial.map((p) => p.id)));
  await deleteEmptyFamilies(partial.map((p) => p.familyId));
}

async function markFailed(jobId: string) {
  const rows = await db
    .update(schema.versions)
    .set({ status: 'failed' })
    .where(and(eq(schema.versions.jobId, jobId), eq(schema.versions.status, 'processing')))
    .returning({ familyId: schema.versions.familyId });
  for (const { familyId } of rows) {
    const fam = await db.query.families.findFirst({ where: eq(schema.families.id, familyId) });
    if (fam && !fam.currentVersionId) {
      const others = await db.select({ id: schema.versions.id }).from(schema.versions)
        .where(and(eq(schema.versions.familyId, familyId), eq(schema.versions.status, 'draft'))).limit(1);
      await db.update(schema.families).set({ status: others.length ? 'draft' : 'failed' }).where(eq(schema.families.id, familyId));
    }
  }
}

async function deleteEmptyFamilies(familyIds: string[]) {
  for (const id of new Set(familyIds)) {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.versions).where(eq(schema.versions.familyId, id));
    if (row.n === 0) await db.delete(schema.families).where(eq(schema.families.id, id));
  }
}

class JobContext {
  step = 'Starting';
  results: { familyId: string; versionId: string; name: string }[] = [];
  constructor(public job: Job) {}
  async setStep(step: string) {
    this.step = step;
    await db.update(schema.jobs).set({ step, heartbeatAt: new Date() }).where(eq(schema.jobs.id, this.job.id));
  }
}

/* ------------------------------------------------------------------ */
/* Shared ingest: masters → family version with faces and files       */
/* ------------------------------------------------------------------ */

interface Master {
  filename: string;
  buffer: Buffer;
}
interface IngestGroup {
  familyName: string;
  source: FamilySource;
  masters: Master[];
  category?: string;
  licence?: Licence;
  targetFamilyId?: string;
  axisLimits?: AxisLimits;
  note?: string;
}

async function uniqueSlug(workspaceId: string, base: string) {
  const rows = await db
    .select({ slug: schema.families.slug })
    .from(schema.families)
    .where(and(eq(schema.families.workspaceId, workspaceId), sql`${schema.families.slug} like ${base + '%'}`));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

async function ingest(ctx: JobContext, input: IngestGroup) {
  const group = { ...input, familyName: cleanCssName(input.familyName) };
  const { job } = ctx;
  const started = Date.now();
  const warnings: string[] = [];

  await ctx.setStep(`Validating ${group.familyName}`);
  // Validate and read every master before creating anything (PRC-1, PRC-2).
  const prepared = group.masters.map((m) => {
    try {
      return { ...m, meta: readFont(m.buffer) };
    } catch (e) {
      const err = e as FontError;
      throw new FontError(`${m.filename}: ${err.message}`, err.fix);
    }
  });

  let family = group.targetFamilyId
    ? await db.query.families.findFirst({ where: eq(schema.families.id, group.targetFamilyId) })
    : await db.query.families.findFirst({
        where: and(eq(schema.families.workspaceId, job.workspaceId), sql`lower(${schema.families.cssName}) = ${group.familyName.toLowerCase()}`),
      });
  const category = family?.category ?? group.category ?? guessCategory(prepared[0].meta);

  if (!family) {
    const detected = prepared[0].meta.licence;
    [family] = await db
      .insert(schema.families)
      .values({
        workspaceId: job.workspaceId,
        slug: await uniqueSlug(job.workspaceId, slugify(group.familyName)),
        displayName: group.familyName,
        cssName: group.familyName,
        source: group.source,
        delivery: 'internal',
        category,
        fallbackStack: defaultFallbackStack(category),
        status: 'processing',
        licence: { ...group.licence, detected: { license: detected.license, licenseUrl: detected.licenseUrl, vendor: detected.vendor, copyright: detected.copyright } },
        createdBy: job.createdBy,
      })
      .returning();
  } else if (family.delivery === 'external') {
    // Importing a family that was loaded externally switches it to internal delivery on publish.
    warnings.push('This family was delivered from an external provider. Publishing this version switches it to self-hosted files.');
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.versions.number}), 0)::int + 1` })
    .from(schema.versions)
    .where(eq(schema.versions.familyId, family.id));
  const [version] = await db
    .insert(schema.versions)
    .values({ familyId: family.id, number: next, status: 'processing', jobId: job.id, createdBy: job.createdBy, note: group.note })
    .returning();

  const familySlug = family.slug;
  const perFace: VersionReport['perFace'] = [];
  const seen = new Set<string>();
  let inputBytes = 0;
  let outputBytes = 0;
  let woffBytes = 0;
  let fileCount = 0;
  const subsets = new Set<string>();

  for (let i = 0; i < prepared.length; i++) {
    let { buffer, meta } = prepared[i];
    const { filename } = prepared[i];
    const label = `${group.familyName} ${meta.subfamily}`;

    if (group.axisLimits && meta.isVariable) {
      await ctx.setStep(`Limiting axes of ${label}`);
      buffer = await instanceFont(buffer, group.axisLimits);
      meta = readFont(buffer);
    }

    const faceKey = `${meta.style}|${meta.isVariable ? 'vf' : meta.weight}|${meta.stretch}`;
    if (seen.has(faceKey)) {
      warnings.push(`${filename} duplicates another ${meta.style} ${meta.isVariable ? 'variable' : meta.weight} face and was skipped.`);
      continue;
    }
    seen.add(faceKey);

    await ctx.setStep(`Converting ${label} (${i + 1}/${prepared.length})`);
    const hash = sha256(buffer);
    const masterKey = `masters/${job.workspaceId}/${hash}.${meta.format}`;
    await putObject(masterKey, buffer, MIME[meta.format]);

    const built = await buildFace(buffer, {
      familySlug,
      faceSlug: faceSlugFor(meta),
      category,
      onProgress: (msg) => void ctx.setStep(`${msg} · ${label} (${i + 1}/${prepared.length})`),
    });
    const wght = meta.axes.find((a) => a.tag === 'wght');
    const wdth = meta.axes.find((a) => a.tag === 'wdth');

    const [face] = await db
      .insert(schema.faces)
      .values({
        versionId: version.id,
        name: meta.isVariable ? `Variable ${meta.style === 'italic' ? 'Italic' : 'Roman'}` : meta.subfamily,
        style: meta.style,
        weightMin: wght ? Math.round(wght.min) : meta.weight,
        weightMax: wght ? Math.round(wght.max) : meta.weight,
        stretchMin: wdth ? Math.round(wdth.min) : Math.round(meta.stretch),
        stretchMax: wdth ? Math.round(wdth.max) : Math.round(meta.stretch),
        axes: meta.axes,
        namedInstances: meta.namedInstances,
        glyphCount: meta.glyphCount,
        scripts: meta.scripts,
        metrics: built.meta.metrics,
        masterKey,
        masterBytes: buffer.length,
        masterFormat: meta.format,
        sha256: hash,
        sourceFile: filename,
      })
      .returning();
    if (built.files.length) {
      await db.insert(schema.files).values(built.files.map((f) => ({ ...f, faceId: face.id })));
    }
    meta.warnings.forEach((w) => warnings.push(`${filename}: ${w}`));
    built.files.forEach((f) => subsets.add(f.subset));
    inputBytes += buffer.length;
    outputBytes += built.woff2Bytes;
    woffBytes += built.woffBytes;
    fileCount += built.files.length;
    perFace.push({
      faceId: face.id,
      name: face.name,
      source: filename,
      masterBytes: buffer.length,
      woff2Bytes: built.woff2Bytes,
      woffBytes: built.woffBytes,
      subsets: [...new Set(built.files.map((f) => f.subset))].map((s) => ({
        subset: s,
        glyphs: built.files.find((f) => f.subset === s)!.glyphs,
        woff2: built.files.find((f) => f.subset === s && f.format === 'woff2')?.bytes ?? 0,
        woff: built.files.find((f) => f.subset === s && f.format === 'woff')?.bytes ?? 0,
      })),
    });
  }

  await ctx.setStep(`Writing report for ${group.familyName}`);
  const statics = perFace.length;
  const report: VersionReport = {
    inputBytes,
    outputBytes,
    woffBytes,
    faces: statics,
    files: fileCount,
    subsets: [...subsets],
    warnings,
    durationMs: Date.now() - started,
    perFace,
    axisLimits: group.axisLimits,
  };
  await db.update(schema.versions).set({ status: 'draft', report }).where(eq(schema.versions.id, version.id));

  const allFaces = await db.select({ axes: schema.faces.axes }).from(schema.faces).where(eq(schema.faces.versionId, version.id));
  await db
    .update(schema.families)
    .set({
      type: allFaces.some((f) => f.axes.length) ? 'variable' : 'static',
      status: family.currentVersionId ? family.status : 'draft',
      updatedAt: new Date(),
      ...(group.licence && !family.licence.type ? { licence: { ...family.licence, ...group.licence } } : {}),
    })
    .where(eq(schema.families.id, family.id));

  await db.insert(schema.auditEvents).values({
    workspaceId: job.workspaceId,
    actorId: job.createdBy,
    actorLabel: 'Processing pipeline',
    action: 'version.created',
    targetType: 'family',
    targetId: family.id,
    targetLabel: `${family.displayName} v${version.number}`,
    after: { version: version.number, faces: statics, files: fileCount, outputBytes },
  });
  ctx.results.push({ familyId: family.id, versionId: version.id, name: family.displayName });
}

/* ------------------------------------------------------------------ */
/* Job kinds                                                          */
/* ------------------------------------------------------------------ */

async function runUpload(ctx: JobContext, input: UploadJobInput) {
  await ctx.setStep('Reading uploads');
  const groups = new Map<string, Master[]>();
  for (const f of input.files) {
    const buffer = await readUpload(f);
    groups.set(f.family, [...(groups.get(f.family) ?? []), { filename: f.filename, buffer }]);
  }
  const creator = ctx.job.createdBy
    ? await db.query.users.findFirst({ where: eq(schema.users.id, ctx.job.createdBy), columns: { name: true } })
    : null;
  for (const [familyName, masters] of groups) {
    await ingest(ctx, {
      familyName,
      source: 'internal',
      masters,
      licence: input.licenceConfirmed ? { confirmedBy: creator?.name, confirmedAt: new Date().toISOString() } : undefined,
    });
  }
}

async function runGoogleImport(ctx: JobContext, input: GoogleJobInput) {
  const entry = await findGoogle(input.family);
  if (!entry) throw new FontError(`“${input.family}” is not in the Google Fonts catalogue.`);
  await ctx.setStep(`Downloading ${entry.family} from Google Fonts`);
  const masters = await fetchGoogleMasters(entry, input.selection);
  await ingest(ctx, {
    familyName: entry.family,
    source: 'google',
    category: entry.category,
    masters,
    axisLimits: input.axisLimits,
    licence: { type: googleLicenceType(entry.licence), owner: 'Google Fonts', allowedDomains: ['*'] },
  });
}

async function runCssImport(ctx: JobContext, input: CssJobInput) {
  await ctx.setStep('Fetching stylesheet');
  const css = input.cssText ?? (input.cssUrl ? await safeFetchText(input.cssUrl) : '');
  const faces = parseFontFaces(css, input.baseUrl ?? input.cssUrl);
  if (!faces.length) throw new FontError('No @font-face rules were found in the stylesheet.');

  const byFamily = new Map<string, typeof faces>();
  for (const f of faces) {
    if (input.families?.length && !input.families.includes(f.family)) continue;
    byFamily.set(f.family, [...(byFamily.get(f.family) ?? []), f]);
  }
  for (const [familyName, list] of byFamily) {
    // One master per weight/style; for faces split by unicode-range prefer the Latin slice.
    const perFace = new Map<string, (typeof list)[number]>();
    for (const f of list) {
      const key = `${f.weight}|${f.style}`;
      const prev = perFace.get(key);
      const isLatin = !f.unicodeRange || /U\+0000-00FF/i.test(f.unicodeRange);
      if (!prev || (isLatin && prev.unicodeRange && !/U\+0000-00FF/i.test(prev.unicodeRange))) perFace.set(key, f);
    }
    const masters: Master[] = [];
    for (const face of perFace.values()) {
      const src = bestSource(face);
      if (!src) throw new FontError(`${familyName} ${face.weight} ${face.style}: no TTF, OTF, WOFF or WOFF2 source in the CSS.`);
      await ctx.setStep(`Downloading ${familyName} ${face.weight} ${face.style}`);
      masters.push({ filename: decodeURIComponent(src.url.split('/').pop()!.split('?')[0]), buffer: await safeFetchBuffer(src.url) });
    }
    await ingest(ctx, {
      familyName,
      source: input.legacy ? 'internal' : 'custom_url',
      masters,
      note: input.legacy ? 'Imported from legacy stylesheet' : `Imported from ${input.cssUrl ?? 'pasted CSS'}`,
    });
  }
}

async function runReprocess(ctx: JobContext, input: ReprocessJobInput) {
  const family = await db.query.families.findFirst({ where: eq(schema.families.id, input.familyId) });
  if (!family) throw new FontError('Family not found.');
  const faces = await db.select().from(schema.faces).where(eq(schema.faces.versionId, input.versionId));
  const masters: Master[] = [];
  await ctx.setStep('Loading master files');
  for (const f of faces) {
    if (!f.masterKey) continue;
    const buffer = await getObject(f.masterKey);
    if (!buffer) throw new FontError(`Master file for ${f.name} is missing.`);
    masters.push({ filename: f.sourceFile ?? `${f.name}.${f.masterFormat}`, buffer });
  }
  if (!masters.length) throw new FontError('This version has no master files to reprocess.');
  const fromVersion = await db.query.versions.findFirst({ where: eq(schema.versions.id, input.versionId) });
  const limits = Object.entries(input.axisLimits)
    .map(([tag, v]) => (typeof v === 'number' ? `${tag}=${v}` : `${tag} ${v.min}–${v.max}`))
    .join(', ');
  await ingest(ctx, {
    familyName: family.cssName,
    source: family.source,
    masters,
    targetFamilyId: family.id,
    axisLimits: input.axisLimits,
    note: `Axis limits (${limits}) applied to v${fromVersion?.number ?? '?'}`,
  });
}

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

export async function listJobs(workspaceId: string, limit = 50) {
  return db.select().from(schema.jobs).where(eq(schema.jobs.workspaceId, workspaceId)).orderBy(desc(schema.jobs.createdAt)).limit(limit);
}

export type { ExternalConfig };
