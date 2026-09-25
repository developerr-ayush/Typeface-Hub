import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { getFamily } from '@/lib/families';
import { badRequest, handler, json, notFound, readJson } from '@/lib/http';
import { createJob, startJob } from '@/lib/jobs';

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  versionId: z.string().uuid(),
  axisLimits: z.record(z.string().regex(/^[A-Za-z]{4}$/), z.union([z.number(), z.object({ min: z.number(), max: z.number() })])),
});

/** Cap or pin variable axes into a new draft version (VAR-3, VAR-4). */
export const POST = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const family = await getFamily(actor.workspace.id, (await params).id);
  const body = Body.parse(await readJson(req));
  const version = await db.query.versions.findFirst({ where: and(eq(schema.versions.id, body.versionId), eq(schema.versions.familyId, family.id)) });
  if (!version) throw notFound('Version not found.');
  if (!Object.keys(body.axisLimits).length) throw badRequest('Set at least one axis limit.');
  for (const [tag, v] of Object.entries(body.axisLimits)) {
    if (typeof v !== 'number' && v.min > v.max) throw badRequest(`${tag}: minimum is above maximum.`);
  }
  const job = await createJob(actor, 'reprocess', `Limit axes of ${family.displayName}`, { familyId: family.id, versionId: version.id, axisLimits: body.axisLimits });
  startJob(job.id);
  return json({ job: { id: job.id, status: job.status } }, { status: 202 });
});
