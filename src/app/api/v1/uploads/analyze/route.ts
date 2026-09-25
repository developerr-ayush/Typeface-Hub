import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { analyzeUploads } from '@/lib/uploads';

export const maxDuration = 60;

const Body = z.object({ files: z.array(z.object({ key: z.string().min(1), filename: z.string().min(1) })).min(1) });

export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const { files } = Body.parse(await readJson(req));
  return json(await analyzeUploads(actor.workspace.id, files));
});
