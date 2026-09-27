import 'server-only';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Agent, fetch, type RequestInit, type Response } from 'undici';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// Addresses a user-supplied URL may never reach. BlockList also matches IPv4-mapped
// IPv6 forms (::ffff:127.0.0.1, ::ffff:7f00:1) against the IPv4 rules.
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::', 96], // IPv4-compatible (deprecated)
  ['64:ff9b::', 96], // NAT64
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) blocked.addSubnet(net, prefix, 'ipv6');

/** True when the address is loopback, private, link-local or otherwise not a public internet address. */
export function isPrivateAddress(ip: string) {
  const family = isIP(ip);
  if (!family) return true;
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

// Checks are skipped outside production so local development can fetch from localhost.
const enforce = () => process.env.NODE_ENV === 'production';

/**
 * DNS lookup used for every connection: the addresses are checked at connect time,
 * so a hostname can't pass the check and then resolve to a private address (DNS rebinding).
 */
function guardedLookup(hostname: string, options: { all?: boolean; family?: number } & Record<string, unknown>, callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, options.all ? [] : '');
    const list = addresses as LookupAddress[];
    if (enforce() && (!list.length || list.some((a) => isPrivateAddress(a.address)))) {
      return callback(Object.assign(new Error(`${hostname} points to a private network address and cannot be fetched.`), { code: 'EPRIVATE' }), options.all ? [] : '');
    }
    if (options.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}

const dispatcher = new Agent({ connect: { lookup: guardedLookup as never } });

function checkUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`“${String(raw)}” is not a valid URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are allowed.');
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // IP literals skip DNS, so check them here; hostnames are checked in guardedLookup.
  if (enforce() && isIP(host) && isPrivateAddress(host)) throw new Error(`${host} is a private network address and cannot be fetched.`);
  return url;
}

/**
 * Fetch a user-supplied URL, refusing private network addresses (SSRF protection).
 * Redirects are followed manually so every hop is checked again.
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const signal = AbortSignal.timeout(30_000);
  let current = checkUrl(url);
  for (let hop = 0; ; hop++) {
    let res: Response;
    try {
      res = await fetch(current, { ...init, redirect: 'manual', signal, dispatcher });
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause;
      if (cause?.code === 'EPRIVATE') throw new Error(cause.message);
      throw e;
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      if (hop >= MAX_REDIRECTS) throw new Error(`${url} redirected too many times.`);
      current = checkUrl(new URL(location, current));
      continue;
    }
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) throw new Error(`${url} is larger than 25 MB.`);
    return res;
  }
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
