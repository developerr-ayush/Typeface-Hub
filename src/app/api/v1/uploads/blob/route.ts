import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getApiActor } from '@/lib/context';
import { badRequest, handler, json, readJson } from '@/lib/http';
import { isUploadKey, MAX_FILE_BYTES } from '@/lib/uploads';

/** Issues client-upload tokens so large font files go directly from the browser to Vercel Blob. */
export const POST = handler(async (req) => {
  const body = await readJson<HandleUploadBody>(req);
  const result = await handleUpload({
    request: req,
    body,
    onBeforeGenerateToken: async (pathname) => {
      const actor = await getApiActor(req);
      actor.assert('upload');
      if (!isUploadKey(pathname, actor.workspace.id)) throw badRequest('Invalid upload path.');
      return {
        maximumSizeInBytes: MAX_FILE_BYTES,
        addRandomSuffix: true,
        allowedContentTypes: ['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'application/font-woff', 'application/x-font-ttf', 'application/x-font-otf', 'application/vnd.ms-opentype', 'font/sfnt'],
      };
    },
    onUploadCompleted: async () => {},
  });
  return json(result);
});
