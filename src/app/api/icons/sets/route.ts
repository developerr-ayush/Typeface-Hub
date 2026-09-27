import { handler, json } from '@/lib/http';
import { listSets } from '@/lib/icons/sets';

/** The icon sets bundled with the icon font editor, with their licences. */
export const GET = handler(async () => json({ sets: await listSets() }, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }));
