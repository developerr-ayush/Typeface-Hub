import { getApiActor } from '@/lib/context';
import { badRequest, handler, json } from '@/lib/http';
import { retryJob } from '@/lib/jobs';

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const job = await retryJob(actor, (await params).id);
  if (!job) throw badRequest('Only failed or stuck jobs can be retried.');
  return json({ job: { id: job.id, status: job.status } });
});
