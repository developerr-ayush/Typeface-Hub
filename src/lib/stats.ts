import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from './db';

const BUCKETS = [5, 10, 25, 50, 100, 300, 1000];
export const BUCKET_LABELS = ['<5', '<10', '<25', '<50', '<100', '<300', '<1000', '≥1000'];

const bucketOf = (ms: number) => {
  const i = BUCKETS.findIndex((b) => ms < b);
  return i < 0 ? BUCKETS.length : i;
};

/** Aggregate CSS API metrics (OBS-6). Called after the response is sent. */
export async function recordCssRequest(workspaceId: string, ms: number, error: boolean, families: string[]) {
  const day = new Date().toISOString().slice(0, 10);
  const b = bucketOf(ms);
  const buckets = Array.from({ length: 8 }, (_, i) => (i === b ? 1 : 0));
  const fam = Object.fromEntries(families.map((f) => [f, 1]));
  await db
    .insert(schema.cssStats)
    .values({ workspaceId, day, requests: 1, errors: error ? 1 : 0, totalMs: Math.round(ms), buckets, families: fam })
    .onConflictDoUpdate({
      target: [schema.cssStats.workspaceId, schema.cssStats.day],
      set: {
        requests: sql`${schema.cssStats.requests} + 1`,
        errors: sql`${schema.cssStats.errors} + ${error ? 1 : 0}`,
        totalMs: sql`${schema.cssStats.totalMs} + ${Math.round(ms)}`,
        buckets: sql`(select jsonb_agg(coalesce((${schema.cssStats.buckets}->>(i-1))::int, 0) + case when i - 1 = ${b} then 1 else 0 end order by i) from generate_series(1, 8) as i)`,
        families: sql`(select coalesce(jsonb_object_agg(k, coalesce((${schema.cssStats.families}->>k)::int, 0) + coalesce((${JSON.stringify(fam)}::jsonb->>k)::int, 0)), '{}'::jsonb) from (select jsonb_object_keys(${schema.cssStats.families} || ${JSON.stringify(fam)}::jsonb) as k) keys)`,
      },
    });
}

function percentile(buckets: number[], p: number) {
  const total = buckets.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let acc = 0;
  for (let i = 0; i < buckets.length; i++) {
    acc += buckets[i];
    if (acc / total >= p) return BUCKET_LABELS[i];
  }
  return BUCKET_LABELS[BUCKET_LABELS.length - 1];
}

export async function cssStats(workspaceId: string, days = 14) {
  const since = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(schema.cssStats)
    .where(and(eq(schema.cssStats.workspaceId, workspaceId), gte(schema.cssStats.day, since)))
    .orderBy(schema.cssStats.day);
  const buckets = Array(8).fill(0) as number[];
  const families: Record<string, number> = {};
  let requests = 0;
  let errors = 0;
  let totalMs = 0;
  for (const r of rows) {
    requests += r.requests;
    errors += r.errors;
    totalMs += r.totalMs;
    r.buckets.forEach((n, i) => (buckets[i] += n));
    for (const [k, v] of Object.entries(r.families)) families[k] = (families[k] ?? 0) + v;
  }
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86400_000).toISOString().slice(0, 10);
    const r = rows.find((x) => x.day === day);
    return { day, requests: r?.requests ?? 0, errors: r?.errors ?? 0, avgMs: r && r.requests ? Math.round(r.totalMs / r.requests) : null };
  });
  return {
    requests,
    errors,
    errorRate: requests ? errors / requests : 0,
    avgMs: requests ? Math.round(totalMs / requests) : null,
    p50: percentile(buckets, 0.5),
    p95: percentile(buckets, 0.95),
    buckets,
    series,
    families: Object.entries(families).sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
}

/** Pipeline monitoring (OBS-5). */
export async function jobStats(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select({ status: schema.jobs.status, kind: schema.jobs.kind, error: schema.jobs.error, startedAt: schema.jobs.startedAt, finishedAt: schema.jobs.finishedAt })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.workspaceId, workspaceId), gte(schema.jobs.createdAt, since)));
  const finished = rows.filter((r) => r.finishedAt && r.startedAt);
  const durations = finished.filter((r) => r.status === 'ready').map((r) => r.finishedAt!.getTime() - r.startedAt!.getTime()).sort((a, b) => a - b);
  const pick = (p: number) => (durations.length ? durations[Math.min(durations.length - 1, Math.floor(p * durations.length))] : null);
  const failures = rows.filter((r) => r.status === 'failed');
  const reasons = new Map<string, number>();
  for (const f of failures) {
    const reason = (f.error ?? 'Unknown').split(/[.:]/)[0].slice(0, 80);
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  return {
    total: rows.length,
    ready: rows.filter((r) => r.status === 'ready').length,
    failed: failures.length,
    running: rows.filter((r) => r.status === 'processing' || r.status === 'queued').length,
    failureRate: finished.length ? failures.length / finished.length : 0,
    p50Ms: pick(0.5),
    p95Ms: pick(0.95),
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
  };
}
