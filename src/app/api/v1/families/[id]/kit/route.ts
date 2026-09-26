import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { getApiActor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { getFamily, usageByFamily } from '@/lib/families';
import { badRequest, handler, notFound, readJson } from '@/lib/http';
import { buildKit } from '@/lib/kit';
import { tokensToCss } from '@/lib/tokens';
import { familyLookup, getTokenSet } from '@/lib/typography';

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  versionId: z.string().uuid().optional(),
  formats: z.array(z.enum(['woff2', 'woff', 'sfnt'])).min(1).default(['woff2', 'woff']),
  faceIds: z.array(z.string().uuid()).optional(),
  characters: z.enum(['full', 'split', 'latin', 'latin-ext', 'custom']).default('latin-ext'),
  customText: z.string().max(2000).optional(),
  variable: z.enum(['variable', 'static']).default('variable'),
  staticWeights: z.array(z.number().int().min(1).max(1000)).max(20).optional(),
  pathPrefix: z.string().max(200).regex(/^[\w./-]*$/, 'Use a relative or absolute path such as ../fonts/').default('../fonts/'),
  display: z.enum(['auto', 'block', 'swap', 'fallback', 'optional']).default('swap'),
  fallback: z.boolean().default(true),
  unicodeRange: z.boolean().default(true),
  demo: z.boolean().default(true),
  tokens: z.boolean().default(false),
});

/**
 * Download a self-contained web font kit (ZIP): font files in the chosen formats,
 * a stylesheet, an optional demo page, tokens and a README.
 */
export const POST = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const family = await getFamily(actor.workspace.id, (await params).id);
  const body = Body.parse(await readJson(req).catch(() => ({})));

  const versionId = body.versionId ?? family.currentVersionId;
  const version = versionId
    ? await db.query.versions.findFirst({ where: and(eq(schema.versions.id, versionId), eq(schema.versions.familyId, family.id)) })
    : await db.query.versions.findFirst({ where: eq(schema.versions.familyId, family.id), orderBy: (v, { desc }) => desc(v.number) });
  if (!version) throw notFound('Version not found.');
  if (!['draft', 'published', 'archived'].includes(version.status)) throw badRequest(`Version ${version.number} is ${version.status}.`);
  const faces = await db.select().from(schema.faces).where(eq(schema.faces.versionId, version.id));

  let tokensCss: string | null = null;
  if (body.tokens) {
    const usage = (await usageByFamily(actor.workspace.id)).get(family.id);
    const set = await getTokenSet(actor.workspace.id, usage?.[0]?.theme ?? 'default');
    tokensCss = tokensToCss(set, await familyLookup(actor.workspace.id, { publishedOnly: false }));
  }

  const kit = await buildKit(family, version, faces, { ...body, tokensCss });
  await audit(actor, 'family.kit_downloaded', { type: 'family', id: family.id, label: `${family.displayName} v${version.number}` }, {
    after: { formats: body.formats.join(','), characters: body.characters, variable: body.variable },
  });
  return new Response(new Uint8Array(kit.zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${kit.filename}"`,
      'Content-Length': String(kit.zip.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Kit-Cached': String(kit.cached),
    },
  });
});
