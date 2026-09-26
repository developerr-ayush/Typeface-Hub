import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { handler, HttpError, json, readJson } from '@/lib/http';
import { changePassword } from '@/lib/passwords';
import { rateLimit } from '@/lib/rate-limit';

export const POST = handler(async (req) => {
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sign in first.');
  const body = z.object({ current: z.string().min(1), next: z.string().min(8, 'Use at least 8 characters').max(200) }).parse(await readJson(req));
  await rateLimit(req, { name: 'password', perIp: 20, windowSeconds: 900, subject: { value: user.id, limit: 10 }, message: 'Too many attempts.' });
  await changePassword(user.id, body.current, body.next);
  return json({ ok: true });
});
