import { BarChart } from '@/components/bar-chart';
import { Card, CardHeader, PageHeader, Stat } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { BUCKET_LABELS, cssStats, jobStats } from '@/lib/stats';

export const metadata = { title: 'Monitoring' };

const secs = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);
const pct = (n: number) => `${(n * 100).toFixed(n && n < 0.01 ? 2 : 1)}%`;

export default async function MonitoringPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const actor = await getWorkspaceActor(ws);
  const [css, jobs] = await Promise.all([cssStats(actor.workspace.id), jobStats(actor.workspace.id)]);
  const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <>
      <PageHeader title="Monitoring" description="CSS API health and processing pipeline for this workspace." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="CSS API · last 14 days" description="Origin requests only. Requests answered from the CDN cache never reach the origin, so these are cache misses and revalidations." />
          <div className="grid grid-cols-2 gap-5 px-5 py-4 sm:grid-cols-5">
            <Stat label="Origin requests" value={css.requests.toLocaleString()} />
            <Stat label="p50 latency" value={css.p50 ? `${css.p50} ms` : '—'} />
            <Stat label="p95 latency" value={css.p95 ? `${css.p95} ms` : '—'} hint="Target < 300 ms on a miss" />
            <Stat label="Average" value={css.avgMs !== null ? `${css.avgMs} ms` : '—'} />
            <Stat label="Error rate" value={pct(css.errorRate)} hint={`${css.errors} bad requests`} />
          </div>
          <div className="grid gap-6 border-t border-line px-5 py-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-[13px] font-medium text-ink-2">Requests per day</h3>
              <BarChart label="CSS API requests per day" data={css.series.map((s) => ({ key: s.day, label: day(s.day), value: s.requests }))} />
            </div>
            <div>
              <h3 className="mb-3 text-[13px] font-medium text-ink-2">Latency distribution (ms)</h3>
              <BarChart label="CSS API latency distribution" data={css.buckets.map((n, i) => ({ key: BUCKET_LABELS[i], label: `${BUCKET_LABELS[i]} ms`, value: n }))} />
            </div>
          </div>
          {css.families.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <h3 className="mb-2 text-[13px] font-medium text-ink-2">Most requested families</h3>
              <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {css.families.map(([name, n]) => (
                  <li key={name} className="flex justify-between border-b border-line/60 py-1">
                    <span className="text-ink">{name}</span>
                    <span className="text-muted tabular-nums">{n.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Processing pipeline · last 30 days" />
          <div className="grid grid-cols-2 gap-5 px-5 py-4 sm:grid-cols-5">
            <Stat label="Jobs" value={jobs.total} hint={jobs.running ? `${jobs.running} running` : undefined} />
            <Stat label="Succeeded" value={jobs.ready} />
            <Stat label="Failure rate" value={pct(jobs.failureRate)} hint={`${jobs.failed} failed`} />
            <Stat label="p50 duration" value={secs(jobs.p50Ms)} />
            <Stat label="p95 duration" value={secs(jobs.p95Ms)} hint="Target < 60 s for 10 files" />
          </div>
          {jobs.reasons.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <h3 className="mb-2 text-[13px] font-medium text-ink-2">Failure reasons</h3>
              <ul className="space-y-1 text-sm">
                {jobs.reasons.map(([reason, n]) => (
                  <li key={reason} className="flex justify-between gap-4">
                    <span className="text-ink">{reason}</span>
                    <span className="text-muted tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
