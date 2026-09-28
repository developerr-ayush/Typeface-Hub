import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Uptime check: 200 when the app can reach its database, 503 otherwise. */
export async function GET() {
  const started = performance.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: 'up', ms: Math.round(performance.now() - started) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false, database: 'down' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
