import { getObject } from '@/lib/storage';

type Ctx = { params: Promise<{ name: string }> };

const TYPES: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff' };

/** Content-hashed font files: immutable, cacheable for a year, CORS enabled (PRC-8, DLV-6, DLV-7). */
export async function GET(_req: Request, { params }: Ctx) {
  const name = (await params).name;
  const ext = /^[a-z0-9-]+\.[a-f0-9]{10}\.(woff2|woff)$/.exec(name)?.[1];
  if (!ext) return new Response('Not found', { status: 404 });
  const body = await getObject(`files/${name}`);
  if (!body) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': TYPES[ext],
      'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}
