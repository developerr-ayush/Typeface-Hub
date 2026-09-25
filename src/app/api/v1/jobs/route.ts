import { getApiActor } from '@/lib/context';
import { handler, json } from '@/lib/http';
import { listJobs } from '@/lib/jobs';

export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  return json({ data: await listJobs(actor.workspace.id, 100) });
});
