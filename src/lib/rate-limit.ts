import 'server-only';
import { createHash } from 'node:crypto';
import { lt, sql } from 'drizzle-orm';
import { db, schema } from './db';
import { HttpError } from './http';

export function clientIp(req: Request) {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('x-real-ip') || 'local';
}

/**
 * Count one hit against a fixed window and throw 429 once the limit is passed.
 * IPs are hashed so no raw addresses are stored.
 */
export async function rateLimit(req: Request, name: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const ip = createHash('sha256').update(`${clientIp(req)}|${process.env.AUTH_SECRET ?? ''}`).digest('hex').slice(0, 24);
  const key = `${name}:${ip}:${windowStart}`;
  const expiresAt = new Date((windowStart + windowSeconds) * 1000);
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({ target: schema.rateLimits.key, set: { count: sql`${schema.rateLimits.count} + 1` } })
    .returning({ count: schema.rateLimits.count });
  // Opportunistic cleanup of old windows.
  if (Math.random() < 0.05) void db.delete(schema.rateLimits).where(lt(schema.rateLimits.expiresAt, new Date())).catch(() => {});
  if (row.count > limit) {
    const retry = Math.max(1, Math.ceil(expiresAt.getTime() / 1000 - now / 1000));
    throw new HttpError(429, `Too many conversions from your network. Try again in ${retry > 90 ? `${Math.ceil(retry / 60)} minutes` : `${retry} seconds`}.`, { retryAfter: retry });
  }
  return { remaining: limit - row.count };
}
