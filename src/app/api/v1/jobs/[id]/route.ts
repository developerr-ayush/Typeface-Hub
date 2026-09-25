import { and, eq } from 'drizzle-orm';
import { getApiActor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { handler, json, notFound } from '@/lib/http';
import { startJob } from '@/lib/jobs';

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Job status and report (PRC-11). A queued job that never started is picked up here. */
export const GET = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const job = await db.query.jobs.findFirst({ where: and(eq(schema.jobs.id, (await params).id), eq(schema.jobs.workspaceId, actor.workspace.id)) });
  if (!job) throw notFound('Job not found.');
  if (job.status === 'queued' && Date.now() - job.createdAt.getTime() > 15_000) startJob(job.id);
  const versions = job.result?.families.length
    ? await db.query.versions.findMany({ where: (v, { inArray }) => inArray(v.id, job.result!.families.map((f) => f.versionId)) })
    : [];
  return json({ ...job, reports: versions.map((v) => ({ versionId: v.id, familyId: v.familyId, number: v.number, status: v.status, report: v.report })) });
});
