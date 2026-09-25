import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { updateFace } from '@/lib/families';
import { handler, json, readJson } from '@/lib/http';

type Ctx = { params: Promise<{ id: string; faceId: string }> };

const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  style: z.enum(['normal', 'italic']).optional(),
  weightMin: z.number().int().min(1).max(1000).optional(),
  weightMax: z.number().int().min(1).max(1000).optional(),
});

/** Edit a face in a draft version (review screen, ADM-2). */
export const PATCH = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const { id, faceId } = await params;
  return json({ face: await updateFace(actor, id, faceId, Patch.parse(await readJson(req))) });
});
