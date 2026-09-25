import { formatBytes, timeAgo } from '@/lib/format';
import { and, desc, eq, lt } from 'drizzle-orm';
import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { db, schema } from '@/lib/db';

export const metadata = { title: 'Activity' };

const PAGE = 50;

function describe(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ before?: string }> }) {
  const { ws } = await params;
  const { before } = await searchParams;
  const actor = await getWorkspaceActor(ws);
  const where = [eq(schema.auditEvents.workspaceId, actor.workspace.id)];
  if (before) where.push(lt(schema.auditEvents.id, Number(before)));
  const events = await db.select().from(schema.auditEvents).where(and(...where)).orderBy(desc(schema.auditEvents.id)).limit(PAGE + 1);
  const page = events.slice(0, PAGE);
  return (
    <>
      <PageHeader title="Activity" description="Audit log of who uploaded, changed, published, rolled back or deleted what, and when." />
      {page.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card>
          <ol className="divide-y divide-line">
            {page.map((e) => {
              const before = describe(e.before);
              const after = describe(e.after);
              return (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{e.actorLabel}</span> <span className="text-ink-2">{e.action.replace(/[._]/g, ' ')}</span>{' '}
                    {e.targetType === 'family' && e.targetId ? (
                      <Link href={`/w/${ws}/families/${e.targetId}`} className="font-medium text-accent hover:underline">
                        {e.targetLabel}
                      </Link>
                    ) : (
                      <span className="text-ink">{e.targetLabel}</span>
                    )}
                    {(before || after) && (
                      <div className="mt-0.5 text-xs text-muted">
                        {before && <span>before {before}</span>}
                        {before && after && ' → '}
                        {after && <span>{before ? '' : ''}{after}</span>}
                      </div>
                    )}
                  </div>
                  <time className="text-xs text-muted" dateTime={e.at.toISOString()} title={e.at.toLocaleString()}>
                    {timeAgo(e.at)}
                  </time>
                </li>
              );
            })}
          </ol>
          {events.length > PAGE && (
            <div className="border-t border-line px-5 py-3">
              <Link href={`/w/${ws}/activity?before=${page[page.length - 1].id}`} className="text-sm font-medium text-accent hover:underline">
                Older events →
              </Link>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
