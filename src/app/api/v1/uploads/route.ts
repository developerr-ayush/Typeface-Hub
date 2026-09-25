import { getApiActor } from '@/lib/context';
import { badRequest, handler, json } from '@/lib/http';
import { usingBlob } from '@/lib/storage';
import { MAX_FILE_BYTES, MAX_FILES, storeUpload } from '@/lib/uploads';

export const runtime = 'nodejs';

/** Upload config: files go straight to Vercel Blob when configured, otherwise through this route. */
export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  return json({ mode: usingBlob() ? 'blob' : 'direct', maxFileBytes: MAX_FILE_BYTES, maxFiles: MAX_FILES, prefix: `uploads/${actor.workspace.id}/` });
});

/** Multipart upload (local development, API clients, and files under 4 MB on Vercel). */
export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const form = await req.formData().catch(() => {
    throw badRequest('Send files as multipart/form-data in a “files” field.');
  });
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) throw badRequest('No files in the “files” field.');
  if (files.length > MAX_FILES) throw badRequest(`Upload at most ${MAX_FILES} files at a time.`);
  const refs = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw badRequest(`${file.name} is larger than 20 MB.`);
    refs.push(await storeUpload(actor.workspace.id, file.name, Buffer.from(await file.arrayBuffer())));
  }
  return json({ files: refs }, { status: 201 });
});
