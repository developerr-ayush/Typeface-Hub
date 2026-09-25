import { and, desc, eq, lt } from 'drizzle-orm';
import { getApiActor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { handler, json } from '@/lib/http';

/** Audit log (GOV-9), newest first. ?before=<id>&target=<id> */
export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const p = new URL(req.url).searchParams;
  const where = [eq(schema.auditEvents.workspaceId, actor.workspace.id)];
  if (p.get('before')) where.push(lt(schema.auditEvents.id, Number(p.get('before'))));
  if (p.get('target')) where.push(eq(schema.auditEvents.targetId, p.get('target')!));
  const data = await db.select().from(schema.auditEvents).where(and(...where)).orderBy(desc(schema.auditEvents.id)).limit(Math.min(Number(p.get('limit') ?? 50), 200));
  return json({ data });
});
