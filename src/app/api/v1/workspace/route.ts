import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { updateWorkspace } from '@/lib/workspaces';

export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  const { id, slug, name, settings, createdAt } = actor.workspace;
  return json({ id, slug, name, settings, createdAt, role: actor.role, scopes: actor.scopes });
});

const Patch = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  settings: z
    .object({
      googleMode: z.enum(['external', 'import']).optional(),
      selfHostOnly: z.boolean().optional(),
      defaultDisplay: z.enum(['auto', 'block', 'swap', 'fallback', 'optional']).optional(),
    })
    .optional(),
});

export const PATCH = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('settings');
  const ws = await updateWorkspace(actor, Patch.parse(await readJson(req)));
  return json({ slug: ws.slug, name: ws.name, settings: ws.settings });
});
