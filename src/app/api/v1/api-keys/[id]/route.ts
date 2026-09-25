import { getApiActor } from '@/lib/context';
import { handler, json } from '@/lib/http';
import { revokeApiKey } from '@/lib/workspaces';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('settings');
  await revokeApiKey(actor, (await params).id);
  return json({ ok: true });
});
