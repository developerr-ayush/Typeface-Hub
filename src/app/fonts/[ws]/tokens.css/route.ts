import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { tokensToCss } from '@/lib/tokens';
import { familyLookup, getTokenSet } from '@/lib/typography';

type Ctx = { params: Promise<{ ws: string }> };

/** Public token stylesheet: CSS custom properties and .text-* classes for a theme. */
export async function GET(req: Request, { params }: Ctx) {
  const slug = (await params).ws;
  const workspace = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.slug, slug), columns: { id: true } });
  if (!workspace) return new Response('/* Unknown workspace */', { status: 404, headers: { 'Content-Type': 'text/css' } });
  const theme = new URL(req.url).searchParams.get('theme') ?? 'default';
  const set = await getTokenSet(workspace.id, theme);
  const body = tokensToCss(set, await familyLookup(workspace.id, { publishedOnly: true }));
  return new Response(body, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=60, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
