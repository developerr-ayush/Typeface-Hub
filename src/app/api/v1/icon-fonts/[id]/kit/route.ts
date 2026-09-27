import { getApiActor } from '@/lib/context';
import { handler } from '@/lib/http';
import { buildIconKit } from '@/lib/icons/build';
import { getIconFont } from '@/lib/icons/workspace';

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** Download the saved icon font as a kit (fonts, CSS, demo, config.json). */
export const GET = handler<Ctx>(async (req, { params }) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const row = await getIconFont(actor.workspace.id, (await params).id);
  const kit = await buildIconKit(row.config);
  return new Response(new Uint8Array(kit.zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${kit.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
