import { z } from 'zod';
import { listUserWorkspaces } from '@/lib/context';
import { handler, json, readJson } from '@/lib/http';
import { resetPassword } from '@/lib/passwords';
import { rateLimit } from '@/lib/rate-limit';

export const POST = handler(async (req) => {
  const body = z.object({ token: z.string().min(20).max(200), password: z.string().min(8, 'Use at least 8 characters').max(200) }).parse(await readJson(req));
  await rateLimit(req, { name: 'reset', perIp: 20, windowSeconds: 3600, global: 1000, message: 'Too many attempts.' });
  const user = await resetPassword(body.token, body.password);
  const workspaces = await listUserWorkspaces(user.id);
  return json({ ok: true, workspace: workspaces[0] ?? null });
});
