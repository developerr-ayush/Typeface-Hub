import { z } from 'zod';
import { trustedOrigin } from '@/lib/delivery';
import { handler, json, readJson } from '@/lib/http';
import { requestPasswordReset } from '@/lib/passwords';
import { rateLimit } from '@/lib/rate-limit';

export const POST = handler(async (req) => {
  const { email } = z.object({ email: z.string().trim().email('Enter a valid email address') }).parse(await readJson(req));
  await rateLimit(req, { name: 'forgot', perIp: 10, windowSeconds: 3600, subject: { value: email, limit: 3 }, global: 500, message: 'Too many reset requests.' });
  const origin = trustedOrigin(req);
  if (!origin) {
    // Same response either way, so the form can't be used to probe for accounts.
    console.error('[auth] Password reset links need NEXT_PUBLIC_APP_URL to be set (for example https://fonts.example.com). No email was sent.');
    return json({ ok: true });
  }
  const { link } = await requestPasswordReset(email, origin);
  return json({ ok: true, ...(link ? { link } : {}) });
});
