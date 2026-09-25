import { getApiActor } from '@/lib/context';
import { searchGoogle } from '@/lib/google';
import { handler, json } from '@/lib/http';

/** Google Fonts catalogue search (SRC-3). */
export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const p = new URL(req.url).searchParams;
  return json(
    await searchGoogle({
      q: p.get('q') ?? undefined,
      category: p.get('category') ?? undefined,
      variable: p.get('variable') === 'true',
      limit: Math.min(Number(p.get('limit') ?? 48), 100),
      offset: Number(p.get('offset') ?? 0),
    }),
  );
});
