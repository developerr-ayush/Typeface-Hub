import { and, eq, inArray } from 'drizzle-orm';
import { Shell } from '@/components/shell';
import { getWorkspaceActor, listUserWorkspaces } from '@/lib/context';
import { db, schema } from '@/lib/db';

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const actor = await getWorkspaceActor(ws);
  const workspaces = await listUserWorkspaces(actor.user.id);
  const running = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.workspaceId, actor.workspace.id), inArray(schema.jobs.status, ['queued', 'processing'])));
  return (
    <Shell ws={{ slug: actor.workspace.slug, name: actor.workspace.name }} workspaces={workspaces} user={actor.user} role={actor.role ?? ''} runningJobs={running.length}>
      {children}
    </Shell>
  );
}
