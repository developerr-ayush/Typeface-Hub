import { appOrigin } from '@/lib/delivery';
import { publishedIconCss } from '@/lib/icons/workspace';

type Ctx = { params: Promise<{ ws: string; file: string }> };

const CACHE = 'public, max-age=600, s-maxage=300, stale-while-revalidate=86400, stale-if-error=604800';

/** Public stylesheet of a published icon font: /fonts/{workspace}/icons/{slug}.css */
export async function GET(req: Request, { params }: Ctx) {
  const { ws, file } = await params;
  const slug = /^([a-z0-9-]+)\.css$/.exec(file)?.[1];
  const body = slug ? await publishedIconCss(ws, slug, appOrigin(req)) : null;
  return new Response(body ?? '/* Icon font not found or not published */\n', {
    status: body ? 200 : 404,
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': body ? CACHE : 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
