import { getApiActor } from '@/lib/context';
import { appOrigin } from '@/lib/delivery';
import { handler, json } from '@/lib/http';
import { publishIconFont } from '@/lib/icons/workspace';

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** Build the saved config and serve it at /fonts/{workspace}/icons/{slug}.css. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('publish');
  const row = await publishIconFont(actor, (await params).id);
  return json({ id: row.id, slug: row.slug, published: row.published, css: `${appOrigin(req)}/fonts/${actor.workspace.slug}/icons/${row.slug}.css` });
});
