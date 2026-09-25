import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { notFound as nextNotFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getUser, type SessionUser } from './auth';
import { db, schema } from './db';
import type { ApiScope, Role } from './db/schema';
import { forbidden, HttpError } from './http';
import { roleCan, scopesCan, type Permission } from './permissions';

export type Workspace = typeof schema.workspaces.$inferSelect;

export type Actor = {
  workspace: Workspace;
  id: string | null; // user id (null for API keys)
  label: string;
  role: Role | null;
  scopes: ApiScope[] | null;
  can: (p: Permission) => boolean;
  assert: (p: Permission) => void;
};

function makeActor(workspace: Workspace, opts: { user?: SessionUser; role?: Role; key?: { name: string; scopes: ApiScope[] } }): Actor {
  const can = (p: Permission) =>
    opts.role ? roleCan(opts.role, p) : opts.key ? scopesCan(opts.key.scopes, p) : false;
  return {
    workspace,
    id: opts.user?.id ?? null,
    label: opts.user ? opts.user.name : `API key “${opts.key?.name}”`,
    role: opts.role ?? null,
    scopes: opts.key?.scopes ?? null,
    can,
    assert: (p) => {
      if (!can(p)) throw forbidden(`Your ${opts.role ? `role (${opts.role})` : 'API key'} does not allow “${p}”.`);
    },
  };
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Resolve the caller of an API route: a Bearer API key or the session cookie plus a workspace. */
export async function getApiActor(req: Request): Promise<Actor> {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const key = await db.query.apiKeys.findFirst({ where: eq(schema.apiKeys.hash, hashKey(token)) });
    if (!key || key.revoked) throw new HttpError(401, 'Invalid or revoked API key.');
    const workspace = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, key.workspaceId) });
    if (!workspace) throw new HttpError(401, 'Invalid API key.');
    void db.update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, key.id)).catch(() => {});
    return makeActor(workspace, { key: { name: key.name, scopes: key.scopes } });
  }
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sign in or pass an API key as “Authorization: Bearer <key>”.');
  const slug = req.headers.get('x-workspace') ?? new URL(req.url).searchParams.get('workspace');
  if (!slug) throw new HttpError(400, 'Pass the workspace slug in the X-Workspace header.');
  const ctx = await membershipFor(user.id, slug);
  if (!ctx) throw new HttpError(404, 'Workspace not found or you are not a member.');
  return makeActor(ctx.workspace, { user, role: ctx.role });
}

async function membershipFor(userId: string, slug: string) {
  const rows = await db
    .select({ workspace: schema.workspaces, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .where(and(eq(schema.memberships.userId, userId), eq(schema.workspaces.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

/** For server components under /w/[ws]: the signed-in member, or redirect/404. */
export const getWorkspaceActor = cache(async (slug: string) => {
  const user = await getUser();
  if (!user) redirect('/login');
  const ctx = await membershipFor(user.id, slug);
  if (!ctx) nextNotFound();
  return { ...makeActor(ctx.workspace, { user, role: ctx.role }), user };
});

export async function listUserWorkspaces(userId: string) {
  return db
    .select({ slug: schema.workspaces.slug, name: schema.workspaces.name, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .where(eq(schema.memberships.userId, userId))
    .orderBy(schema.workspaces.name);
}
