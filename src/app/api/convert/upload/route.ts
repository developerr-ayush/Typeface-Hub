import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { CONVERT_LIMITS } from '@/lib/convert';
import { badRequest, handler, json, readJson } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';

/** Client-upload tokens for the public converter (files go straight to Blob, then are deleted after conversion). */
export const POST = handler(async (req) => {
  const body = await readJson<HandleUploadBody>(req);
  const result = await handleUpload({
    request: req,
    body,
    onBeforeGenerateToken: async (pathname) => {
      await rateLimit(req, 'convert-upload', CONVERT_LIMITS.perHour * CONVERT_LIMITS.maxFiles, 3600);
      if (!pathname.startsWith('convert/')) throw badRequest('Invalid upload path.');
      return { maximumSizeInBytes: CONVERT_LIMITS.maxFileBytes, addRandomSuffix: true, validUntil: Date.now() + 10 * 60_000 };
    },
    onUploadCompleted: async () => {},
  });
  return json(result);
});
