import { handler, json } from '@/lib/http';
import { searchIcons } from '@/lib/icons/sets';

/**
 * Search the bundled icon sets: /api/icons/search?q=arrow&set=mdi&offset=0&limit=120.
 * Returns outlines (SVG paths, 1000 units high) so results can be previewed as SVG.
 */
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').slice(0, 100);
  const set = url.searchParams.get('set')?.slice(0, 40) || null;
  const offset = Math.max(0, Math.min(20_000, Number(url.searchParams.get('offset')) || 0));
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get('limit')) || 120));
  const { total, glyphs } = await searchIcons({ q, set, offset, limit });
  return json(
    { total, offset, glyphs: glyphs.map(({ uid, set, css, width, d }) => ({ uid, set, css, width, d })) },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
});
