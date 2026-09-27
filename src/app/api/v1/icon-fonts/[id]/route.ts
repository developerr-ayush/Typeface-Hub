import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { deleteIconFont, getIconFont, saveIconFont } from '@/lib/icons/workspace';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const row = await getIconFont(actor.workspace.id, (await params).id);
  return json({ id: row.id, slug: row.slug, config: row.config, published: row.published, updatedAt: row.updatedAt });
});

/** Replace the config (name, prefix, suffix, glyphs). Publishing is a separate step. */
export const PUT = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('edit');
  const row = await saveIconFont(actor, (await params).id, await readJson(req));
  return json({ id: row.id, slug: row.slug, config: row.config, published: row.published, updatedAt: row.updatedAt });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('delete');
  await deleteIconFont(actor, (await params).id);
  return new Response(null, { status: 204 });
});
