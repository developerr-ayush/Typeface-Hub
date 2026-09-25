import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { addMember, listMembers } from '@/lib/workspaces';

const Role = z.enum(['viewer', 'editor', 'publisher', 'admin']);

export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  return json({ data: await listMembers(actor.workspace.id) });
});

export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('settings');
  const { email, role } = z.object({ email: z.string().email(), role: Role }).parse(await readJson(req));
  await addMember(actor, email, role);
  return json({ ok: true }, { status: 201 });
});
