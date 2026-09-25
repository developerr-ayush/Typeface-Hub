import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createSession, hashPassword } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { conflict, handler, json, readJson } from '@/lib/http';
import { createWorkspace } from '@/lib/workspaces';

const Body = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  workspace: z.string().trim().min(2).max(60).optional(),
});

export const POST = handler(async (req) => {
  const body = Body.parse(await readJson(req));
  const existing = await db.query.users.findFirst({ where: eq(sql`lower(${schema.users.email})`, body.email) });
  if (existing) throw conflict('An account with this email already exists. Sign in instead.');
  const [user] = await db
    .insert(schema.users)
    .values({ name: body.name, email: body.email, passwordHash: await hashPassword(body.password) })
    .returning({ id: schema.users.id, name: schema.users.name });
  const ws = await createWorkspace(user, body.workspace ?? `${body.name.split(' ')[0]}'s fonts`);
  await createSession(user.id);
  return json({ user: { id: user.id, name: user.name }, workspace: { slug: ws.slug } }, { status: 201 });
});
