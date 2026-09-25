import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_BYTES = 25 * 1024 * 1024;

function isPrivate(ip: string) {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v === '::' || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Fetch a user-supplied URL, refusing private network addresses (SSRF protection). */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`“${url}” is not a valid URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http and https URLs are allowed.');
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error(`Could not resolve ${host}.`);
  if (process.env.NODE_ENV === 'production' && addresses.some((a) => isPrivate(a.address))) {
    throw new Error(`${host} points to a private network address and cannot be fetched.`);
  }
  const res = await fetch(parsed, { ...init, redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) throw new Error(`${url} is larger than 25 MB.`);
  return res;
}

export async function safeFetchBuffer(url: string) {
  const res = await safeFetch(url, { headers: { 'User-Agent': 'TypefaceHub/1.0 (+font import)' } });
  if (!res.ok) throw new Error(`Download failed with HTTP ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`${url} is larger than 25 MB.`);
  return buf;
}

export async function safeFetchText(url: string) {
  const res = await safeFetch(url, {
    headers: {
      // A modern browser UA so providers like Google return WOFF2 CSS.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Accept: 'text/css,*/*;q=0.1',
    },
  });
  if (!res.ok) throw new Error(`The stylesheet returned HTTP ${res.status}.`);
  return res.text();
}
