import { handler, readJson } from '@/lib/http';
import { buildIconKit } from '@/lib/icons/build';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

/**
 * Build an icon font from a config (JSON body: name, prefix, suffix, glyphs)
 * and return the kit as a ZIP. Icons from the bundled sets need only their uid;
 * uploaded icons carry their outline in "d". Nothing is stored.
 */
export const POST = handler(async (req) => {
  await rateLimit(req, { name: 'icons-build', perIp: 60, windowSeconds: 3600, global: 6000, message: 'Too many icon fonts built from your network.' });
  const kit = await buildIconKit(await readJson(req));
  return new Response(new Uint8Array(kit.zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${kit.filename}"`,
      'Content-Length': String(kit.zip.byteLength),
      'Cache-Control': 'private, no-store',
    },
  });
});
