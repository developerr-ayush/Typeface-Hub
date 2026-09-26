import { after } from 'next/server';
import { z } from 'zod';
import { CONVERT_LIMITS, convertFonts, type ConvertInput } from '@/lib/convert';
import { KitOptionsSchema } from '@/lib/convert-options';
import { badRequest, handler } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { deleteObject, getObject, usingBlob } from '@/lib/storage';

export const maxDuration = 300;

const Json = z.object({
  files: z.array(z.object({ url: z.string().url(), filename: z.string().min(1).max(200) })).min(1).max(CONVERT_LIMITS.maxFiles),
  options: KitOptionsSchema.default({} as never),
  licenceConfirmed: z.boolean(),
});

/** Delete converter uploads older than an hour (uploaded but never converted). */
async function sweepAbandonedUploads() {
  const { del, list } = await import('@vercel/blob');
  const cutoff = Date.now() - 3600_000;
  const { blobs } = await list({ prefix: 'convert/', limit: 500 });
  const old = blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff).map((b) => b.url);
  if (old.length) await del(old);
}

const isConvertBlob = (url: string) => {
  const u = new URL(url);
  return u.hostname.endsWith('.blob.vercel-storage.com') && u.pathname.startsWith('/convert/');
};

/**
 * Public, no-account converter: upload fonts, get a ZIP with WOFF2/WOFF/TTF,
 * CSS and a demo page. Nothing is kept: uploads are deleted after conversion.
 * Accepts multipart form data (files + options JSON) or JSON with Blob URLs.
 */
export const POST = handler(async (req) => {
  await rateLimit(req, { name: 'convert', perIp: CONVERT_LIMITS.perHour, windowSeconds: 3600, global: CONVERT_LIMITS.perHour * 100, message: 'Too many conversions from your network.' });

  let inputs: ConvertInput[] = [];
  let options: z.infer<typeof KitOptionsSchema>;
  let licenceConfirmed = false;
  let blobs: string[] = [];

  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => {
      throw badRequest('Could not read the upload.');
    });
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length) throw badRequest('Add at least one font file.');
    if (files.length > CONVERT_LIMITS.maxFiles) throw badRequest(`Upload at most ${CONVERT_LIMITS.maxFiles} files at a time.`);
    const total = files.reduce((a, f) => a + f.size, 0);
    if (total > CONVERT_LIMITS.maxTotalBytes) throw badRequest(`Upload at most ${CONVERT_LIMITS.maxTotalBytes / 1024 / 1024} MB at a time.`);
    const big = files.find((f) => f.size > CONVERT_LIMITS.maxFileBytes);
    if (big) throw badRequest(`${big.name} is larger than ${CONVERT_LIMITS.maxFileBytes / 1024 / 1024} MB.`);
    inputs = await Promise.all(files.map(async (f) => ({ filename: f.name, buffer: Buffer.from(await f.arrayBuffer()) })));
    options = KitOptionsSchema.parse(JSON.parse(String(form.get('options') ?? '{}')));
    licenceConfirmed = form.get('licenceConfirmed') === 'true';
  } else {
    const body = Json.parse(await req.json().catch(() => ({})));
    if (!usingBlob()) throw badRequest('Send files as multipart/form-data.');
    blobs = body.files.map((f) => f.url);
    if (!blobs.every(isConvertBlob)) throw badRequest('Invalid upload URL.');
    options = body.options;
    licenceConfirmed = body.licenceConfirmed;
    if (licenceConfirmed) {
      inputs = await Promise.all(
        body.files.map(async (f) => {
          const buffer = await getObject(f.url);
          if (!buffer) throw badRequest(`The upload of ${f.filename} expired. Upload it again.`);
          return { filename: f.filename, buffer };
        }),
      );
    }
  }

  // Uploads are never kept, whatever happens next.
  after(async () => {
    await Promise.all(blobs.map((b) => deleteObject(b))).catch(() => {});
    if (usingBlob() && Math.random() < 0.2) await sweepAbandonedUploads().catch(() => {});
  });
  if (!licenceConfirmed) throw badRequest('Confirm that you are allowed to convert and use these fonts on the web.', { code: 'licence_required' });

  const { zip, filename, summary } = await convertFonts(inputs, options);
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Convert-Summary': Buffer.from(JSON.stringify(summary)).toString('base64url').slice(0, 7000),
    },
  });
});
