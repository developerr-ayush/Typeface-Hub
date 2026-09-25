import 'server-only';
import { db, schema } from './db';
import type { Actor } from './context';

export async function audit(
  actor: Pick<Actor, 'workspace' | 'id' | 'label'>,
  action: string,
  target: { type: string; id?: string | null; label?: string | null },
  change?: { before?: unknown; after?: unknown },
) {
  await db.insert(schema.auditEvents).values({
    workspaceId: actor.workspace.id,
    actorId: actor.id,
    actorLabel: actor.label,
    action,
    targetType: target.type,
    targetId: target.id ?? null,
    targetLabel: target.label ?? null,
    before: change?.before ?? null,
    after: change?.after ?? null,
  });
}
