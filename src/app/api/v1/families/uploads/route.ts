import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { badRequest, handler, json, readJson } from '@/lib/http';
import { createJob, startJob } from '@/lib/jobs';
import { assertUploadRef } from '@/lib/uploads';

export const maxDuration = 300;

const Body = z.object({
  files: z.array(z.object({ key: z.string().min(1), filename: z.string().min(1), family: z.string().trim().min(1).max(100) })).min(1).max(60),
  licenceConfirmed: z.boolean(),
});

/** Start processing uploaded files (returns a job id). */
export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const body = Body.parse(await readJson(req));
  if (!body.licenceConfirmed) throw badRequest('Confirm that you are licensed to self-host these fonts.', { code: 'licence_required' });
  body.files.forEach((f) => assertUploadRef(f, actor.workspace.id));
  const families = [...new Set(body.files.map((f) => f.family))];
  const title = `Upload: ${families.join(', ')} (${body.files.length} file${body.files.length === 1 ? '' : 's'})`;
  const job = await createJob(actor, 'upload', title, body);
  startJob(job.id);
  return json({ job: { id: job.id, status: job.status } }, { status: 202 });
});
