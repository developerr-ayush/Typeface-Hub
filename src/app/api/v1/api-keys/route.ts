import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { createApiKey, listApiKeys } from '@/lib/workspaces';

export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('settings');
  return json({ data: await listApiKeys(actor.workspace.id) });
});

export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('settings');
  const body = z
    .object({ name: z.string().trim().min(1).max(60), scopes: z.array(z.enum(['delivery', 'read', 'write', 'publish'])).min(1) })
    .parse(await readJson(req));
  const key = await createApiKey(actor, body.name, body.scopes);
  return json({ id: key.id, name: key.name, scopes: key.scopes, token: key.token }, { status: 201 });
});
