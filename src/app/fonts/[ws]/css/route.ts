import { eq } from 'drizzle-orm';
import { after } from 'next/server';
import { buildStylesheet, CssQueryError, parseCssQuery } from '@/lib/css-api';
import { db, schema } from '@/lib/db';
import { appOrigin, loadPublishedFamilies } from '@/lib/delivery';
import { recordCssRequest } from '@/lib/stats';

type Ctx = { params: Promise<{ ws: string }> };

const CACHE = 'public, max-age=600, s-maxage=300, stale-while-revalidate=86400, stale-if-error=604800';

const css = (body: string, status: number, cache: string) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': cache,
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });

/**
 * Public CSS API (DLV-1, DLV-2, DLV-6..8) with Google CSS2 syntax:
 *   /fonts/{workspace}/css?family=Montserrat:ital,wght@0,400;1,700&family=Bakbak+One&display=swap
 */
export async function GET(req: Request, { params }: Ctx) {
  const started = performance.now();
  const slug = (await params).ws;
  const workspace = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug), columns: { id: true } });
  if (!workspace) return css('/* Unknown workspace */\n', 404, 'public, max-age=60');

  let status = 200;
  let body: string;
  let names: string[] = [];
  try {
    const url = new URL(req.url);
    const { families, display } = parseCssQuery(url.searchParams);
    names = families.map((f) => f.name);
    const loaded = await loadPublishedFamilies(workspace.id, names);
    const subsets = url.searchParams.get('subset')?.split(',').filter(Boolean);
    const built = buildStylesheet(families, loaded, {
      display,
      fileBase: `${appOrigin(req)}/fonts/files`,
      subsets: subsets?.length ? [...subsets, 'all'] : undefined,
    });
    if (!built.selections.length && !built.imports.length) {
      status = 400;
      body = `/* ${built.missing.join('; ').replace(/\*\//g, '') || 'Nothing to serve'} */\n`;
    } else {
      body = built.css + '\n';
    }
  } catch (e) {
    status = 400;
    body = `/* ${e instanceof CssQueryError ? e.message : 'Invalid request'} */\n`;
    if (!(e instanceof CssQueryError)) console.error(e);
  }
  const ms = performance.now() - started;
  after(() => recordCssRequest(workspace.id, ms, status !== 200, names).catch(() => {}));
  return css(body, status, status === 200 ? CACHE : 'public, max-age=60, s-maxage=60');
}
