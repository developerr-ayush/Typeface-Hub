import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { unzipSync } from 'fflate';
import { db, schema } from './db';
import { badRequest } from './http';
import { FontError, readFont, sniffFormat } from './fonts/metadata';
import { sha256 } from './fonts/process';
import { deleteObject, getObject, putObject } from './storage';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 60;
const FONT_EXT = /\.(ttf|otf|woff2?|zip)$/i;

export interface UploadRef {
  key: string; // storage key ("uploads/…") or a Vercel Blob URL
  filename: string;
}

export function assertUploadRef(ref: UploadRef, workspaceId: string) {
  if (ref.key.startsWith('https://')) {
    const url = new URL(ref.key);
    if (!url.hostname.endsWith('.blob.vercel-storage.com') || !url.pathname.startsWith(`/uploads/${workspaceId}/`)) {
      throw badRequest(`Upload “${ref.filename}” does not belong to this workspace.`);
    }
  } else if (!ref.key.startsWith(`uploads/${workspaceId}/`)) {
    throw badRequest(`Upload “${ref.filename}” does not belong to this workspace.`);
  }
}

export async function readUpload(ref: UploadRef) {
  const buf = await getObject(ref.key);
  if (!buf) throw new FontError(`The uploaded file “${ref.filename}” has expired or is missing.`, 'Upload it again.');
  return buf;
}

export async function storeUpload(workspaceId: string, filename: string, body: Buffer): Promise<UploadRef> {
  const safe = filename.replace(/[^\w.\-()[\] ]+/g, '_').slice(-120);
  const key = `uploads/${workspaceId}/${randomUUID()}/${safe}`;
  await putObject(key, body, 'application/octet-stream');
  return { key, filename };
}

export async function discardUploads(refs: UploadRef[]) {
  await Promise.all(refs.map((r) => deleteObject(r.key).catch(() => {})));
}

export interface AnalyzedFile extends UploadRef {
  ok: boolean;
  error?: string;
  fix?: string;
  bytes: number;
  sha256?: string;
  format?: string;
  family?: string;
  subfamily?: string;
  weight?: number;
  style?: 'normal' | 'italic';
  isVariable?: boolean;
  axes?: { tag: string; min: number; max: number; default: number }[];
  namedInstances?: string[];
  glyphCount?: number;
  scripts?: string[];
  warnings: string[];
  skip?: boolean;
  skipReason?: string;
  duplicateOf?: string; // existing family that already has this exact file
  fromZip?: string;
  licence?: string;
}

const FORMAT_RANK: Record<string, number> = { ttf: 0, otf: 0, woff2: 1, woff: 2 };

/** Inspect uploaded files before processing: expand ZIPs, read metadata, find duplicates (SRC-2, SRC-6, LIB-7). */
export async function analyzeUploads(workspaceId: string, refs: UploadRef[]) {
  if (!refs.length) throw badRequest('No files uploaded.');
  if (refs.length > MAX_FILES) throw badRequest(`Upload at most ${MAX_FILES} files at a time.`);
  const notes: string[] = [];
  const expanded: { ref: UploadRef; buf: Buffer | null; fromZip?: string; error?: string }[] = [];

  for (const ref of refs) {
    assertUploadRef(ref, workspaceId);
    const buf = await getObject(ref.key);
    if (!buf) {
      expanded.push({ ref, buf: null, error: 'The upload could not be found. Upload it again.' });
      continue;
    }
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(new Uint8Array(buf), { filter: (f) => FONT_EXT.test(f.name) && !f.name.startsWith('__MACOSX') });
      } catch {
        expanded.push({ ref, buf: null, error: 'The ZIP file is corrupt.' });
        continue;
      }
      const names = Object.keys(entries).filter((n) => !n.endsWith('/') && !/\.zip$/i.test(n));
      if (!names.length) notes.push(`${ref.filename}: no TTF, OTF, WOFF or WOFF2 files inside.`);
      else notes.push(`${ref.filename}: found ${names.length} font files; CSS, EOT and SVG files were ignored.`);
      for (const name of names) {
        const inner = Buffer.from(entries[name]);
        const stored = await storeUpload(workspaceId, name.split('/').pop()!, inner);
        expanded.push({ ref: stored, buf: inner, fromZip: ref.filename });
      }
      await deleteObject(ref.key).catch(() => {});
      continue;
    }
    expanded.push({ ref, buf });
  }

  const files: AnalyzedFile[] = expanded.map(({ ref, buf, fromZip, error }) => {
    const base: AnalyzedFile = { ...ref, ok: false, bytes: buf?.length ?? 0, warnings: [], fromZip };
    if (!buf) return { ...base, error };
    if (buf.length > MAX_FILE_BYTES) return { ...base, error: 'File is larger than 20 MB.', fix: 'Subset or compress the font before uploading.' };
    const fmt = sniffFormat(buf);
    const ext = ref.filename.split('.').pop()?.toLowerCase();
    if (!fmt && (ext === 'eot' || ext === 'svg')) {
      return { ...base, error: `${ext.toUpperCase()} is a legacy format and is not needed.`, fix: 'Upload the TTF, OTF or WOFF2 version instead.' };
    }
    try {
      const meta = readFont(buf);
      return {
        ...base,
        ok: true,
        sha256: sha256(buf),
        format: meta.format,
        family: meta.family,
        subfamily: meta.subfamily,
        weight: meta.weight,
        style: meta.style,
        isVariable: meta.isVariable,
        axes: meta.axes,
        namedInstances: meta.namedInstances.map((n) => n.name),
        glyphCount: meta.glyphCount,
        scripts: meta.scripts,
        warnings: meta.warnings,
        licence: meta.licence.license?.slice(0, 120) || meta.licence.licenseUrl,
      };
    } catch (e) {
      const err = e as FontError;
      return { ...base, error: err.message, fix: err.fix };
    }
  });

  // Same face uploaded in several formats (for example a Transfonter export): keep the best master.
  const byFace = new Map<string, AnalyzedFile[]>();
  for (const f of files.filter((f) => f.ok)) {
    const key = `${f.family}|${f.subfamily}|${f.style}|${f.weight}|${f.isVariable}`.toLowerCase();
    byFace.set(key, [...(byFace.get(key) ?? []), f]);
  }
  for (const group of byFace.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => (FORMAT_RANK[a.format!] ?? 9) - (FORMAT_RANK[b.format!] ?? 9));
    for (const dup of group.slice(1)) {
      dup.skip = true;
      dup.skipReason = `Same face as ${group[0].filename}; the ${group[0].format?.toUpperCase()} file is used.`;
    }
  }

  // Exact duplicates of files already in the library.
  const hashes = files.filter((f) => f.sha256).map((f) => f.sha256!);
  if (hashes.length) {
    const existing = await db
      .select({ sha: schema.faces.sha256, family: schema.families.displayName })
      .from(schema.faces)
      .innerJoin(schema.versions, eq(schema.versions.id, schema.faces.versionId))
      .innerJoin(schema.families, eq(schema.families.id, schema.versions.familyId))
      .where(and(eq(schema.families.workspaceId, workspaceId), inArray(schema.faces.sha256, hashes)));
    const map = new Map(existing.map((e) => [e.sha, e.family]));
    for (const f of files) if (f.sha256 && map.has(f.sha256)) f.duplicateOf = map.get(f.sha256);
  }

  const groups = new Map<string, number>();
  for (const f of files) if (f.ok && !f.skip) groups.set(f.family!, (groups.get(f.family!) ?? 0) + 1);

  return { files, notes, families: [...groups.entries()].map(([family, count]) => ({ family, files: count })) };
}
