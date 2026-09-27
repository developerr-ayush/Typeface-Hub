import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { IconFontConfigSchema } from '@/lib/icons/config';
import { createIconFont, listIconFonts } from '@/lib/icons/workspace';

export const GET = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('read');
  const rows = await listIconFonts(actor.workspace.id);
  return json({
    data: rows.map((r) => ({ id: r.id, slug: r.slug, name: r.config.name, glyphs: r.config.glyphs.length, published: r.published, updatedAt: r.updatedAt })),
  });
});

export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('edit');
  const body = IconFontConfigSchema.partial().extend({ name: z.string().trim().min(1).max(40).optional() }).parse(await readJson(req));
  const row = await createIconFont(actor, body);
  return json({ id: row.id, slug: row.slug, config: row.config }, { status: 201 });
});
