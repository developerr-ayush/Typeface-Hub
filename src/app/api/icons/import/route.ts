import { badRequest, handler, json } from '@/lib/http';
import { importConfig } from '@/lib/icons/import';
import { rateLimit } from '@/lib/rate-limit';

const MAX = 4 * 1024 * 1024;

/** Open a Fontello config.json, or the ZIP downloaded from Fontello or Typeface Hub. Nothing is stored. */
export const POST = handler(async (req) => {
  await rateLimit(req, { name: 'icons-import', perIp: 120, windowSeconds: 3600, global: 12_000, message: 'Too many imports from your network.' });
  const form = await req.formData().catch(() => {
    throw badRequest('Could not read the upload.');
  });
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Add a config.json or ZIP file.');
  if (file.size > MAX) throw badRequest('The file is larger than 4 MB.');
  return json(await importConfig(new Uint8Array(await file.arrayBuffer())));
});
