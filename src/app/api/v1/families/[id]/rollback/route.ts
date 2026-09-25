import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { rollback } from '@/lib/families';
import { handler, json, readJson } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('publish');
  const { version } = z.object({ version: z.union([z.string(), z.number()]) }).parse(await readJson(req));
  const v = await rollback(actor, (await params).id, String(version));
  return json({ ok: true, version: { id: v.id, number: v.number } });
});
