import { getApiActor } from '@/lib/context';
import { appOrigin } from '@/lib/delivery';
import { listFamilies, serializeFamily } from '@/lib/families';
import { handler, json } from '@/lib/http';

/** List and filter the library (LIB-2, DEV-1). */
export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const p = new URL(req.url).searchParams;
  const rows = await listFamilies(actor.workspace.id, {
    q: p.get('q') ?? undefined,
    source: p.get('source') ?? undefined,
    type: p.get('type') ?? undefined,
    status: p.get('status') ?? undefined,
    tag: p.get('tag') ?? undefined,
    licence: (p.get('licence') as 'missing' | 'recorded') ?? undefined,
    used: (p.get('used') as 'used' | 'unused') ?? undefined,
    includeArchived: p.get('archived') === 'true',
  });
  const limit = Math.min(Number(p.get('limit') ?? 50), 200);
  const offset = Number(p.get('offset') ?? 0);
  const page = rows.slice(offset, offset + limit);
  const origin = appOrigin(req);
  const data = await Promise.all(page.map((r) => serializeFamily(actor.workspace.id, r.family, origin)));
  return json({ data, total: rows.length, limit, offset });
});
