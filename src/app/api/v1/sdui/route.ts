import { getApiActor } from '@/lib/context';
import { appOrigin } from '@/lib/delivery';
import { handler, json } from '@/lib/http';
import { buildSdui } from '@/lib/typography';

/**
 * SDUI contract (DEV-3): fonts.css[], fonts.preload[], fonts.preconnect[], typography.tokens.
 * ?theme=default&styles=h1,body (styles used on the page)&preload=h1,body (above the fold)
 */
export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const p = new URL(req.url).searchParams;
  const list = (k: string) => p.get(k)?.split(',').map((s) => s.trim()).filter(Boolean);
  return json(await buildSdui(actor.workspace, appOrigin(req), { theme: p.get('theme') ?? 'default', styles: list('styles'), preload: list('preload') }));
});
