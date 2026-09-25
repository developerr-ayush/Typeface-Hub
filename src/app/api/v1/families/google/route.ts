import { z } from 'zod';
import { audit } from '@/lib/audit';
import { getApiActor } from '@/lib/context';
import { addGoogleExternal } from '@/lib/families';
import { findGoogle } from '@/lib/google';
import { badRequest, handler, json, notFound, readJson } from '@/lib/http';
import { createJob, startJob } from '@/lib/jobs';

export const maxDuration = 300;

const Body = z.object({
  family: z.string().min(1),
  mode: z.enum(['external', 'import']).optional(),
  styles: z.array(z.enum(['normal', 'italic'])).min(1).default(['normal']),
  weights: z.array(z.number().int().min(1).max(1000)).default([400, 700]),
  axisLimits: z.record(z.string(), z.union([z.number(), z.object({ min: z.number(), max: z.number() })])).optional(),
  licenceConfirmed: z.boolean().default(false),
});

/** Add a Google family: load it from Google's CDN, or import it as internal files (SRC-3, SRC-4). */
export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const body = Body.parse(await readJson(req));
  const entry = await findGoogle(body.family);
  if (!entry) throw notFound(`“${body.family}” is not in the Google Fonts catalogue.`);
  const settings = actor.workspace.settings;
  const mode = body.mode ?? (settings.selfHostOnly ? 'import' : settings.googleMode);
  if (mode === 'external' && settings.selfHostOnly) {
    throw badRequest('This workspace is set to self-host only. Import the font as internal instead.');
  }
  if (mode === 'external') {
    const family = await addGoogleExternal(actor, entry.family, { styles: body.styles, weights: body.weights });
    return json({ family: { id: family.id, slug: family.slug } }, { status: 201 });
  }
  if (!body.licenceConfirmed) throw badRequest('Confirm the licence before importing the font as internal.', { code: 'licence_required' });
  const job = await createJob(actor, 'google_import', `Import ${entry.family} from Google Fonts`, {
    family: entry.family,
    selection: { styles: body.styles, weights: body.weights },
    axisLimits: body.axisLimits,
  });
  await audit(actor, 'licence.confirmed', { type: 'family', label: entry.family }, { after: { source: 'google' } });
  startJob(job.id);
  return json({ job: { id: job.id, status: job.status } }, { status: 202 });
});
