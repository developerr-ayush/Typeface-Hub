import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { handler, HttpError, json, readJson } from '@/lib/http';
import { createWorkspace } from '@/lib/workspaces';

export const POST = handler(async (req) => {
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sign in first.');
  const { name } = z.object({ name: z.string().trim().min(2, 'Use at least 2 characters').max(60) }).parse(await readJson(req));
  const ws = await createWorkspace(user, name);
  return json({ workspace: { slug: ws.slug, name: ws.name } }, { status: 201 });
});
