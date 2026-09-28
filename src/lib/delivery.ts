import 'server-only';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db, schema } from './db';
import {
  buildStylesheet,
  fallbackRule,
  fontFaceRules,
  type DeliveryFamily,
  type FaceWithFiles,
} from './css-api';

export async function facesForVersions(versionIds: string[]): Promise<Map<string, FaceWithFiles[]>> {
  const out = new Map<string, FaceWithFiles[]>();
  if (!versionIds.length) return out;
  const faceRows = await db.select().from(schema.faces).where(inArray(schema.faces.versionId, versionIds));
  const fileRows = faceRows.length
    ? await db.select().from(schema.files).where(inArray(schema.files.faceId, faceRows.map((f) => f.id)))
    : [];
  const filesByFace = new Map<string, typeof fileRows>();
  for (const f of fileRows) filesByFace.set(f.faceId, [...(filesByFace.get(f.faceId) ?? []), f]);
  for (const face of faceRows) {
    const list = out.get(face.versionId) ?? [];
    list.push({ ...face, files: filesByFace.get(face.id) ?? [] });
    out.set(face.versionId, list);
  }
  for (const list of out.values()) list.sort((a, b) => Number(a.style !== 'normal') - Number(b.style !== 'normal') || a.weightMin - b.weightMin);
  return out;
}

export async function facesForVersion(versionId: string) {
  return (await facesForVersions([versionId])).get(versionId) ?? [];
}

/** Published families of a workspace keyed by lower-case CSS name. */
export async function loadPublishedFamilies(workspaceId: string, names?: string[]) {
  const where = [
    eq(schema.families.workspaceId, workspaceId),
    eq(schema.families.status, 'published'),
    isNotNull(schema.families.currentVersionId),
  ];
  if (names?.length) where.push(inArray(sql`lower(${schema.families.cssName})`, names.map((n) => n.toLowerCase())));
  const fams = await db.select().from(schema.families).where(and(...where));
  const faces = await facesForVersions(fams.map((f) => f.currentVersionId!));
  const map = new Map<string, DeliveryFamily>();
  for (const family of fams) map.set(family.cssName.toLowerCase(), { family, faces: faces.get(family.currentVersionId!) ?? [] });
  return map;
}

/**
 * The site's origin from configuration only (never from request headers):
 * NEXT_PUBLIC_APP_URL, or the URL Vercel assigns to the deployment.
 */
export function configuredOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

/**
 * Origin for links sent by email (password resets). Host and X-Forwarded-Host
 * can be set by the client, so they are only trusted outside production.
 */
export function trustedOrigin(req: Request) {
  return configuredOrigin() ?? (process.env.NODE_ENV === 'production' ? null : appOrigin(req));
}

export function appOrigin(req?: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (req) {
    const url = new URL(req.url);
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host;
    const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
    return `${proto}://${host}`;
  }
  return '';
}

export async function requestOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export const FILE_BASE = '/fonts/files';

/** Preview CSS for any version (including drafts) under an alias name, for the admin UI. */
export function previewCss(alias: string, faces: FaceWithFiles[], opts: { subsets?: string[] } = {}) {
  return faces
    .map((face) =>
      fontFaceRules(alias, { face, weight: [face.weightMin, face.weightMax] }, {
        display: 'swap',
        fileBase: FILE_BASE,
        subsets: opts.subsets,
      }),
    )
    .join('\n');
}

export { buildStylesheet, fallbackRule };

export const previewAlias = (id: string) => `th-${id.slice(0, 8)}`;
