import { getApiActor } from '@/lib/context';
import { discardDraft } from '@/lib/families';
import { handler, json } from '@/lib/http';

type Ctx = { params: Promise<{ id: string; v: string }> };

/** Discard a draft or failed version. */
export const DELETE = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const { id, v } = await params;
  return json(await discardDraft(actor, id, v));
});
