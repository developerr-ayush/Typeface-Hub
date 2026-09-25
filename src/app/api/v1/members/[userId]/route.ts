import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { removeMember, setMemberRole } from '@/lib/workspaces';

type Ctx = { params: Promise<{ userId: string }> };

export const PATCH = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('settings');
  const { role } = z.object({ role: z.enum(['viewer', 'editor', 'publisher', 'admin']) }).parse(await readJson(req));
  await setMemberRole(actor, (await params).userId, role);
  return json({ ok: true });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('settings');
  await removeMember(actor, (await params).userId);
  return json({ ok: true });
});
