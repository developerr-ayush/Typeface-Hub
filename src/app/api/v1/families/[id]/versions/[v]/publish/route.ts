import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { publishVersion } from '@/lib/families';
import { handler, json } from '@/lib/http';

type Ctx = { params: Promise<{ id: string; v: string }> };

export const POST = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('publish');
  const { id, v } = await params;
  const body = z.object({ licenceConfirmed: z.boolean().optional() }).parse(await req.json().catch(() => ({})));
  const version = await publishVersion(actor, id, v, body);
  return json({ ok: true, version: { id: version.id, number: version.number } });
});
