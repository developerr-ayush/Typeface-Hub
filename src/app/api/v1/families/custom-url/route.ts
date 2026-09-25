import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { addCustomUrlExternal } from '@/lib/families';
import { badRequest, handler, json, readJson } from '@/lib/http';
import { createJob, startJob } from '@/lib/jobs';

export const maxDuration = 300;

const Body = z
  .object({
    url: z.string().url().optional(),
    css: z.string().max(500_000).optional(),
    baseUrl: z.string().url().optional(),
    mode: z.enum(['external', 'import']).default('import'),
    families: z.array(z.string()).optional(),
    legacy: z.boolean().default(false),
    licenceConfirmed: z.boolean().default(false),
  })
  .refine((b) => b.url || b.css, { message: 'Pass a stylesheet url or css text' });

/** Add fonts from a stylesheet URL or pasted CSS (SRC-5, SRC-7 legacy import). */
export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const body = Body.parse(await readJson(req));
  if (body.mode === 'external') {
    if (!body.url) throw badRequest('Loading externally needs a stylesheet URL.');
    if (actor.workspace.settings.selfHostOnly) throw badRequest('This workspace is set to self-host only. Import the fonts instead.');
    const families = await addCustomUrlExternal(actor, body.url);
    return json({ families: families.map((f) => ({ id: f.id, slug: f.slug, name: f.displayName })) }, { status: 201 });
  }
  if (!body.licenceConfirmed) throw badRequest('Confirm you are licensed to self-host these fonts.', { code: 'licence_required' });
  if (body.css && !body.url && !body.baseUrl && /url\(\s*['"]?(?!https?:|data:)/i.test(body.css)) {
    throw badRequest('The CSS uses relative URLs. Enter the base URL the files are served from.');
  }
  const job = await createJob(actor, 'css_import', body.legacy ? 'Legacy import from CSS' : `Import from ${body.url ? new URL(body.url).host : 'pasted CSS'}`, {
    cssUrl: body.url,
    cssText: body.css,
    baseUrl: body.baseUrl,
    families: body.families,
    legacy: body.legacy,
  });
  startJob(job.id);
  return json({ job: { id: job.id, status: job.status } }, { status: 202 });
});
