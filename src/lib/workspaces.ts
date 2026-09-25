import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { audit } from './audit';
import { hashKey, type Actor } from './context';
import { db, schema } from './db';
import type { ApiScope, Role, WorkspaceSettings } from './db/schema';
import { slugify } from './fonts/process';
import { badRequest, conflict, notFound } from './http';

export const DEFAULT_SETTINGS: WorkspaceSettings = { googleMode: 'external', selfHostOnly: false, defaultDisplay: 'swap' };

const RESERVED = new Set(['files', 'css', 'api', 'new', 'app', 'login', 'signup', 'w']);

export async function createWorkspace(user: { id: string; name: string }, name: string) {
  const clean = name.trim();
  if (clean.length < 2) throw badRequest('Workspace name must be at least 2 characters.');
  let base = slugify(clean).slice(0, 40);
  if (RESERVED.has(base)) base = `${base}-ws`;
  const rows = await db.select({ slug: schema.workspaces.slug }).from(schema.workspaces).where(sql`${schema.workspaces.slug} like ${base + '%'}`);
  const taken = new Set(rows.map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const [ws] = await db.insert(schema.workspaces).values({ slug, name: clean, settings: DEFAULT_SETTINGS }).returning();
  await db.insert(schema.memberships).values({ workspaceId: ws.id, userId: user.id, role: 'admin' });
  await db.insert(schema.auditEvents).values({
    workspaceId: ws.id,
    actorId: user.id,
    actorLabel: user.name,
    action: 'workspace.created',
    targetType: 'workspace',
    targetId: ws.id,
    targetLabel: ws.name,
  });
  return ws;
}

export async function updateWorkspace(actor: Actor, patch: { name?: string; settings?: Partial<WorkspaceSettings> }) {
  const next = {
    ...(patch.name && { name: patch.name.trim() }),
    ...(patch.settings && { settings: { ...actor.workspace.settings, ...patch.settings } }),
  };
  const [ws] = await db.update(schema.workspaces).set(next).where(eq(schema.workspaces.id, actor.workspace.id)).returning();
  await audit(actor, 'workspace.updated', { type: 'workspace', id: ws.id, label: ws.name }, {
    before: { name: actor.workspace.name, settings: actor.workspace.settings },
    after: next,
  });
  return ws;
}

export async function listMembers(workspaceId: string) {
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role, since: schema.memberships.createdAt })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, workspaceId))
    .orderBy(schema.users.name);
}

export async function addMember(actor: Actor, email: string, role: Role) {
  const user = await db.query.users.findFirst({ where: eq(sql`lower(${schema.users.email})`, email.trim().toLowerCase()) });
  if (!user) throw notFound(`No account uses ${email}. Ask them to sign up first, then add them here.`);
  const existing = await db.query.memberships.findFirst({
    where: and(eq(schema.memberships.workspaceId, actor.workspace.id), eq(schema.memberships.userId, user.id)),
  });
  if (existing) throw conflict(`${user.name} is already a member.`);
  await db.insert(schema.memberships).values({ workspaceId: actor.workspace.id, userId: user.id, role });
  await audit(actor, 'member.added', { type: 'member', id: user.id, label: user.email }, { after: { role } });
}

async function adminCount(workspaceId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.role, 'admin')));
  return n;
}

export async function setMemberRole(actor: Actor, userId: string, role: Role) {
  const m = await db.query.memberships.findFirst({
    where: and(eq(schema.memberships.workspaceId, actor.workspace.id), eq(schema.memberships.userId, userId)),
  });
  if (!m) throw notFound('Member not found.');
  if (m.role === 'admin' && role !== 'admin' && (await adminCount(actor.workspace.id)) <= 1) {
    throw badRequest('A workspace needs at least one admin.');
  }
  await db.update(schema.memberships).set({ role }).where(and(eq(schema.memberships.workspaceId, actor.workspace.id), eq(schema.memberships.userId, userId)));
  await audit(actor, 'member.role_changed', { type: 'member', id: userId }, { before: { role: m.role }, after: { role } });
}

export async function removeMember(actor: Actor, userId: string) {
  const m = await db.query.memberships.findFirst({
    where: and(eq(schema.memberships.workspaceId, actor.workspace.id), eq(schema.memberships.userId, userId)),
  });
  if (!m) throw notFound('Member not found.');
  if (m.role === 'admin' && (await adminCount(actor.workspace.id)) <= 1) throw badRequest('A workspace needs at least one admin.');
  await db.delete(schema.memberships).where(and(eq(schema.memberships.workspaceId, actor.workspace.id), eq(schema.memberships.userId, userId)));
  await audit(actor, 'member.removed', { type: 'member', id: userId });
}

/* API keys (DEV-9) */

export async function listApiKeys(workspaceId: string) {
  return db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      prefix: schema.apiKeys.prefix,
      scopes: schema.apiKeys.scopes,
      createdAt: schema.apiKeys.createdAt,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      revoked: schema.apiKeys.revoked,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.workspaceId, workspaceId))
    .orderBy(desc(schema.apiKeys.createdAt));
}

export async function createApiKey(actor: Actor, name: string, scopes: ApiScope[]) {
  if (!scopes.length) throw badRequest('Pick at least one scope.');
  const token = `th_${scopes.includes('write') || scopes.includes('publish') ? 'mgmt' : 'live'}_${randomBytes(24).toString('base64url')}`;
  const [key] = await db
    .insert(schema.apiKeys)
    .values({ workspaceId: actor.workspace.id, name: name.trim() || 'API key', prefix: token.slice(0, 12), hash: hashKey(token), scopes, createdBy: actor.id })
    .returning();
  await audit(actor, 'api_key.created', { type: 'api_key', id: key.id, label: key.name }, { after: { scopes } });
  return { ...key, token };
}

export async function revokeApiKey(actor: Actor, id: string) {
  const [key] = await db
    .update(schema.apiKeys)
    .set({ revoked: true })
    .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.workspaceId, actor.workspace.id)))
    .returning();
  if (!key) throw notFound('API key not found.');
  await audit(actor, 'api_key.revoked', { type: 'api_key', id: key.id, label: key.name });
}
