import 'server-only';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

/**
 * File storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise
 * the local ./.data/storage folder (for development and Docker).
 *
 * Keys look like "files/montserrat-vf-latin.a8f3c1d2e4.woff2" (public delivery
 * files) or "masters/<ws>/<sha>.ttf" (original uploads). Original masters and
 * cached kits contain complete font files, so when BLOB_PRIVATE_READ_WRITE_TOKEN
 * is set they go to a separate *private* Blob store that can't be read by URL.
 */
export const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const usingPrivateBlob = () => usingBlob() && Boolean(process.env.BLOB_PRIVATE_READ_WRITE_TOKEN);

const PRIVATE_PREFIXES = ['masters/', 'kits/'];
const isPrivateKey = (key: string) => usingPrivateBlob() && PRIVATE_PREFIXES.some((p) => key.startsWith(p));
const privateToken = () => process.env.BLOB_PRIVATE_READ_WRITE_TOKEN!;

const LOCAL_ROOT = join(process.cwd(), '.data', 'storage');

function localPath(key: string) {
  const path = normalize(join(LOCAL_ROOT, key));
  if (!path.startsWith(LOCAL_ROOT)) throw new Error('Invalid storage key');
  return path;
}

const blobUrls = new Map<string, string>();

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string) {
  if (isPrivateKey(key)) {
    const { put } = await import('@vercel/blob');
    await put(key, Buffer.from(body), { access: 'private', token: privateToken(), contentType, addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  if (usingBlob()) {
    const { put } = await import('@vercel/blob');
    const res = await put(key, Buffer.from(body), {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
    });
    blobUrls.set(key, res.url);
    return;
  }
  const path = localPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

async function blobUrl(key: string) {
  const cached = blobUrls.get(key);
  if (cached) return cached;
  const { head } = await import('@vercel/blob');
  const res = await head(key).catch(() => null);
  if (!res) return null;
  blobUrls.set(key, res.url);
  return res.url;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (isPrivateKey(key)) {
    const { get } = await import('@vercel/blob');
    const res = await get(key, { access: 'private', token: privateToken() }).catch(() => null);
    if (res?.statusCode === 200) return streamToBuffer(res.stream);
    // Masters stored before the private store was configured still live in the public store.
  }
  if (usingBlob()) {
    const url = key.startsWith('https://') ? key : await blobUrl(key);
    if (!url) return null;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  if (isPrivateKey(key)) {
    const { del } = await import('@vercel/blob');
    await del(key, { token: privateToken() }).catch(() => {});
  }
  if (usingBlob()) {
    const { del } = await import('@vercel/blob');
    const url = key.startsWith('https://') ? key : await blobUrl(key).catch(() => null);
    if (url) await del(url).catch(() => {});
    return;
  }
  await unlink(localPath(key)).catch(() => {});
}
