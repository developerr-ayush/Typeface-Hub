import { z } from 'zod';
import { appOrigin } from '@/lib/delivery';
import { handler, json, readJson } from '@/lib/http';
import { requestPasswordReset } from '@/lib/passwords';
import { rateLimit } from '@/lib/rate-limit';

export const POST = handler(async (req) => {
  const { email } = z.object({ email: z.string().trim().email('Enter a valid email address') }).parse(await readJson(req));
  await rateLimit(req, { name: 'forgot', perIp: 10, windowSeconds: 3600, subject: { value: email, limit: 3 }, global: 500, message: 'Too many reset requests.' });
  const { link } = await requestPasswordReset(email, appOrigin(req));
  return json({ ok: true, ...(link ? { link } : {}) });
});
