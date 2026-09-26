import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { handler, HttpError, json, readJson } from '@/lib/http';

export const PATCH = handler(async (req) => {
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sign in first.');
  const { name } = z.object({ name: z.string().trim().min(1, 'Enter your name').max(80) }).parse(await readJson(req));
  await db.update(schema.users).set({ name }).where(eq(schema.users.id, user.id));
  return json({ ok: true });
});
