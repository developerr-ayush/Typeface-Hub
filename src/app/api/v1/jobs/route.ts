import { getApiActor } from '@/lib/context';
import { handler, json } from '@/lib/http';
import { listJobs, resumeStaleJobs } from '@/lib/jobs';

export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  await resumeStaleJobs(actor.workspace.id);
  return json({ data: await listJobs(actor.workspace.id, 100) });
});
