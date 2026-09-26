import 'server-only';
import { createHash } from 'node:crypto';
import { lt, sql } from 'drizzle-orm';
import { db, schema } from './db';
import { HttpError } from './http';

/**
 * The client's address. On Vercel the platform sets x-vercel-forwarded-for,
 * which clients cannot forge. Self-hosted, a reverse proxy (nginx, Caddy)
 * appends the real address to X-Forwarded-For, so the last entry is used.
 * Without a proxy the header can be forged; the global limits below still apply.
 */
export function clientIp(req: Request) {
  if (process.env.VERCEL) {
    return req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  }
  const chain = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  return chain[chain.length - 1] || req.headers.get('x-real-ip') || 'unknown';
}

const hash = (v: string) => createHash('sha256').update(`${v}|${process.env.AUTH_SECRET ?? ''}`).digest('hex').slice(0, 24);

async function hit(key: string, windowSeconds: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const expiresAt = new Date((windowStart + windowSeconds) * 1000);
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key: `${key}:${windowStart}`, count: 1, expiresAt })
    .onConflictDoUpdate({ target: schema.rateLimits.key, set: { count: sql`${schema.rateLimits.count} + 1` } })
    .returning({ count: schema.rateLimits.count });
  return { count: row.count, retry: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)) };
}

const wait = (s: number) => (s > 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`);

export interface Limit {
  /** Name of the bucket, e.g. "login". */
  name: string;
  /** Allowed hits per window for one client address. */
  perIp: number;
  windowSeconds: number;
  /** Optional extra key that can't be forged (for example the email being signed in to). */
  subject?: { value: string; limit: number };
  /** Optional ceiling across all clients, a safety net when addresses can't be trusted. */
  global?: number;
  message?: string;
}

/** Count one hit and throw 429 once any limit is passed. IPs and subjects are stored hashed. */
export async function rateLimit(req: Request, limit: Limit) {
  // End-to-end test runs sign up many accounts from one address; per-account limits still apply.
  const scale = process.env.E2E === 'true' ? 100 : 1;
  const checks: Promise<{ count: number; retry: number; max: number }>[] = [
    hit(`${limit.name}:ip:${hash(clientIp(req))}`, limit.windowSeconds).then((r) => ({ ...r, max: limit.perIp * scale })),
  ];
  if (limit.subject) checks.push(hit(`${limit.name}:sub:${hash(limit.subject.value.toLowerCase())}`, limit.windowSeconds).then((r) => ({ ...r, max: limit.subject!.limit })));
  if (limit.global) checks.push(hit(`${limit.name}:global`, limit.windowSeconds).then((r) => ({ ...r, max: limit.global! * scale })));
  const results = await Promise.all(checks);
  if (Math.random() < 0.05) void db.delete(schema.rateLimits).where(lt(schema.rateLimits.expiresAt, new Date())).catch(() => {});
  const over = results.find((r) => r.count > r.max);
  if (over) {
    throw new HttpError(429, `${limit.message ?? 'Too many requests.'} Try again in ${wait(over.retry)}.`, { retryAfter: over.retry });
  }
}
