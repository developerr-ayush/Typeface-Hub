import 'server-only';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

/**
 * File storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise
 * the local ./.data/storage folder (for development). Keys look like
 * "files/montserrat-vf-latin.a8f3c1d2e4.woff2" or "masters/<ws>/<sha>.ttf".
 */
export const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const LOCAL_ROOT = join(process.cwd(), '.data', 'storage');

function localPath(key: string) {
  const path = normalize(join(LOCAL_ROOT, key));
  if (!path.startsWith(LOCAL_ROOT)) throw new Error('Invalid storage key');
  return path;
}

const blobUrls = new Map<string, string>();

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string) {
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

export async function getObject(key: string): Promise<Buffer | null> {
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
  if (usingBlob()) {
    const { del } = await import('@vercel/blob');
    const url = await blobUrl(key);
    if (url) await del(url).catch(() => {});
    return;
  }
  await unlink(localPath(key)).catch(() => {});
}
