import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createSession, verifyPassword } from '@/lib/auth';
import { listUserWorkspaces } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { handler, HttpError, json, readJson } from '@/lib/http';

const Body = z.object({ email: z.string().trim().toLowerCase(), password: z.string().min(1) });

export const POST = handler(async (req) => {
  const body = Body.parse(await readJson(req));
  const user = await db.query.users.findFirst({ where: eq(sql`lower(${schema.users.email})`, body.email) });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  await createSession(user.id);
  const workspaces = await listUserWorkspaces(user.id);
  return json({ user: { id: user.id, name: user.name }, workspace: workspaces[0] ?? null });
});
