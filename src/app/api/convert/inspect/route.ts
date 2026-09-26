import { z } from 'zod';
import { CONVERT_LIMITS, inspectFonts, type ConvertInput } from '@/lib/convert';
import { badRequest, handler, json } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { getObject, usingBlob } from '@/lib/storage';

export const maxDuration = 60;

const Json = z.object({ files: z.array(z.object({ url: z.string().url(), filename: z.string().min(1).max(200) })).min(1).max(CONVERT_LIMITS.maxFiles) });

/**
 * Tell the converter page what each dropped file is (family, style, static or
 * variable, axes) before converting. Files are read in memory and not kept.
 */
export const POST = handler(async (req) => {
  await rateLimit(req, 'convert-inspect', CONVERT_LIMITS.perHour * 4, 3600);
  let inputs: ConvertInput[];
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => {
      throw badRequest('Could not read the upload.');
    });
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length || files.length > CONVERT_LIMITS.maxFiles) throw badRequest(`Send between 1 and ${CONVERT_LIMITS.maxFiles} files.`);
    if (files.some((f) => f.size > CONVERT_LIMITS.maxFileBytes)) throw badRequest(`Files must be under ${CONVERT_LIMITS.maxFileBytes / 1024 / 1024} MB.`);
    inputs = await Promise.all(files.map(async (f) => ({ filename: f.name, buffer: Buffer.from(await f.arrayBuffer()) })));
  } else {
    if (!usingBlob()) throw badRequest('Send files as multipart/form-data.');
    const body = Json.parse(await req.json().catch(() => ({})));
    inputs = await Promise.all(
      body.files.map(async (f) => {
        const u = new URL(f.url);
        if (!u.hostname.endsWith('.blob.vercel-storage.com') || !u.pathname.startsWith('/convert/')) throw badRequest('Invalid upload URL.');
        const buffer = await getObject(f.url);
        if (!buffer) throw badRequest(`The upload of ${f.filename} expired. Add it again.`);
        return { filename: f.filename, buffer };
      }),
    );
  }
  return json({ fonts: inspectFonts(inputs) });
});
