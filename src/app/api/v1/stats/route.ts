import { getApiActor } from '@/lib/context';
import { handler, json } from '@/lib/http';
import { cssStats, jobStats } from '@/lib/stats';

/** Pipeline and CSS API monitoring (OBS-5, OBS-6). */
export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  return json({ css: await cssStats(actor.workspace.id), jobs: await jobStats(actor.workspace.id) });
});
