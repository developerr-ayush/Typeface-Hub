import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { setArchived } from '@/lib/families';
import { handler, json, readJson } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('publish');
  const { archived } = z.object({ archived: z.boolean() }).parse(await readJson(req));
  await setArchived(actor, (await params).id, archived);
  return json({ ok: true });
});
