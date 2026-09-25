import { inArray } from 'drizzle-orm';
import { JobsList } from '@/components/jobs-list';
import { PageHeader } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { listJobs } from '@/lib/jobs';

export const metadata = { title: 'Jobs' };

export default async function JobsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const actor = await getWorkspaceActor(ws);
  const jobs = await listJobs(actor.workspace.id, 100);
  const userIds = [...new Set(jobs.map((j) => j.createdBy).filter(Boolean))] as string[];
  const users = userIds.length ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const familyIds = [...new Set(jobs.flatMap((j) => j.result?.families.map((f) => f.familyId) ?? []))];
  const fams = familyIds.length
    ? await db.select({ id: schema.families.id, slug: schema.families.slug }).from(schema.families).where(inArray(schema.families.id, familyIds))
    : [];
  return (
    <>
      <PageHeader title="Jobs" description="Every upload and import runs through the pipeline: validate, read metadata, convert, subset, store and report." />
      <JobsList
        ws={ws}
        canRetry={actor.can('upload')}
        jobs={jobs.map((j) => ({
          id: j.id,
          title: j.title,
          kind: j.kind,
          status: j.status,
          step: j.step,
          error: j.error,
          attempts: j.attempts,
          createdAt: j.createdAt.toISOString(),
          startedAt: j.startedAt?.toISOString() ?? null,
          finishedAt: j.finishedAt?.toISOString() ?? null,
          createdBy: users.find((u) => u.id === j.createdBy)?.name ?? null,
          families: (j.result?.families ?? [])
            .filter((f) => fams.some((x) => x.id === f.familyId))
            .map((f) => ({ ...f, slug: fams.find((x) => x.id === f.familyId)?.slug })),
        }))}
      />
    </>
  );
}
