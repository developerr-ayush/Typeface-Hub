import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { appOrigin } from '@/lib/delivery';
import { deleteFamily, getFamily, serializeFamily, updateFamily } from '@/lib/families';
import { handler, json, readJson } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const family = await getFamily(actor.workspace.id, (await params).id);
  return json(await serializeFamily(actor.workspace.id, family, appOrigin(req)));
});

const Patch = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  cssName: z.string().trim().min(1).max(100).regex(/^[^'";{}<>\\]+$/, 'CSS names cannot contain quotes or braces').optional(),
  category: z.enum(['sans-serif', 'serif', 'display', 'handwriting', 'monospace']).optional(),
  fallbackStack: z.array(z.string().trim().min(1).max(60).regex(/^[^'";{}<>\\]+$/)).max(10).optional(),
  display: z.enum(['auto', 'block', 'swap', 'fallback', 'optional']).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  licence: z
    .object({
      type: z.enum(['OFL', 'Apache', 'UFL', 'commercial', 'client-owned', 'other']).optional(),
      owner: z.string().max(200).optional(),
      allowedDomains: z.array(z.string().max(200)).max(50).optional(),
      expiresAt: z.string().nullable().optional(),
      notes: z.string().max(2000).optional(),
      documentUrl: z.string().max(500).optional(),
    })
    .optional(),
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('edit');
  const patch = Patch.parse(await readJson(req));
  const family = await updateFamily(actor, (await params).id, patch);
  return json(await serializeFamily(actor.workspace.id, family, appOrigin(req)));
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('delete');
  await deleteFamily(actor, (await params).id);
  return json({ ok: true });
});
