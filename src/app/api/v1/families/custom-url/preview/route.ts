import { z } from 'zod';
import { getApiActor } from '@/lib/context';
import { parseFontFaces, summarise } from '@/lib/css-import';
import { badRequest, handler, json, readJson } from '@/lib/http';
import { safeFetchText } from '@/lib/safe-fetch';

const Body = z.object({ url: z.string().url().optional(), css: z.string().max(500_000).optional(), baseUrl: z.string().url().optional() });

/** Parse a stylesheet and list the families and faces it declares. */
export const POST = handler(async (req) => {
  const actor = await getApiActor(req);
  actor.assert('upload');
  const body = Body.parse(await readJson(req));
  let css = body.css;
  if (!css && body.url) {
    css = await safeFetchText(body.url).catch((e) => {
      throw badRequest(`Could not fetch the stylesheet: ${(e as Error).message}`);
    });
  }
  if (!css) throw badRequest('Pass a stylesheet url or css text.');
  const faces = parseFontFaces(css, body.baseUrl ?? body.url);
  if (!faces.length) throw badRequest('No @font-face rules were found.');
  const relative = !body.url && !body.baseUrl && faces.some((f) => f.sources.some((s) => !/^https?:/.test(s.url)));
  return json({ families: summarise(faces), faces: faces.length, needsBaseUrl: relative });
});
