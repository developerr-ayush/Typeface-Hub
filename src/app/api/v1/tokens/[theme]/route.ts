import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { tokensToCss, tokensToJson } from '@/lib/tokens';
import { deleteTheme, familyLookup, getTokenSet, saveTokenSet } from '@/lib/typography';

type Ctx = { params: Promise<{ theme: string }> };

/** Typography tokens (TYP-1, TYP-2, TYP-5, TYP-8). ?format=css|json|raw */
export const GET = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const theme = (await params).theme;
  const format = new URL(req.url).searchParams.get('format') ?? 'raw';
  const set = await getTokenSet(actor.workspace.id, theme);
  const lookup = await familyLookup(actor.workspace.id, { publishedOnly: true });
  if (format === 'css') return new Response(tokensToCss(set, lookup), { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
  if (format === 'json') return json(tokensToJson(set, lookup));
  return json(set);
});

const Style = z.object({
  role: z.string().min(1),
  weight: z.number().int().min(1).max(1000),
  style: z.enum(['normal', 'italic']).default('normal'),
  size: z.object({ mobile: z.number().positive().max(20), tablet: z.number().positive().max(20), desktop: z.number().positive().max(20) }),
  lineHeight: z.number().positive().max(5),
  letterSpacing: z.number().min(-1).max(1),
  transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).default('none'),
  fluid: z.boolean().optional(),
});
const Body = z.object({
  roles: z.record(
    z.string().regex(/^[a-z][a-z0-9-]{0,30}$/, 'Role names use lowercase letters, numbers and dashes'),
    z.object({ familyId: z.string().uuid().nullable(), fallback: z.array(z.string().min(1).max(60).regex(/^[^'";{}<>\\]+$/)).max(10).optional() }),
  ),
  textStyles: z.record(z.string().regex(/^[a-z][a-z0-9-]{0,30}$/, 'Style names use lowercase letters, numbers and dashes'), Style),
  breakpoints: z.object({ tablet: z.number().int().min(320).max(4000), desktop: z.number().int().min(320).max(4000) }),
});

export const PUT = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('edit');
  const body = Body.parse(await readJson(req));
  return json(await saveTokenSet(actor, (await params).theme, body));
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('edit');
  await deleteTheme(actor, (await params).theme);
  return json({ ok: true });
});
