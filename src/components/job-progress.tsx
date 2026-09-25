'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { JobBadge } from './status';
import { Alert, Button, Card, formatBytes, Spinner } from './ui';

interface JobResponse {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  step: string | null;
  error: string | null;
  result: { families: { familyId: string; versionId: string; name: string }[] } | null;
  reports: { versionId: string; familyId: string; number: number; status: string; report: { inputBytes: number; outputBytes: number; faces: number; files: number; warnings: string[]; subsets: string[] } | null }[];
}

export function JobProgress({ ws, jobId, familySlugs }: { ws: string; jobId: string; familySlugs?: Record<string, string> }) {
  const router = useRouter();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await api<JobResponse>(ws, `/api/v1/jobs/${jobId}`);
        if (stop) return;
        setJob(j);
        if (j.status === 'ready' || j.status === 'failed') {
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
      timer = setTimeout(tick, 1000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [ws, jobId, router, retrying]);

  const done = job?.status === 'ready';
  return (
    <Card className="p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {!job || job.status === 'processing' || job.status === 'queued' ? <Spinner className="size-4 text-accent" /> : null}
            <h3 className="font-semibold text-ink">{job?.title ?? 'Starting…'}</h3>
          </div>
          <p className="mt-1 text-sm text-muted">{job?.status === 'failed' ? `Stopped at: ${job.step ?? 'start'}` : (job?.step ?? 'Queued')}</p>
        </div>
        {job && <JobBadge status={job.status} />}
      </div>
      {job?.status === 'failed' && (
        <div className="mt-4 space-y-3">
          <Alert tone="bad" title="Processing failed">
            {job.error}
          </Alert>
          <Button
            loading={retrying}
            onClick={async () => {
              setRetrying(true);
              await api(ws, `/api/v1/jobs/${jobId}/retry`, { method: 'POST' }).catch(() => {});
              setJob(null);
              setRetrying(false);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {done && (
        <div className="mt-4 space-y-3">
          {job.reports.map((r) => {
            const name = job.result?.families.find((f) => f.versionId === r.versionId)?.name ?? 'Family';
            const saved = r.report && r.report.inputBytes ? 1 - r.report.outputBytes / r.report.inputBytes : null;
            return (
              <div key={r.versionId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-canvas/60 px-4 py-3">
                <div className="min-w-0 text-sm">
                  <div className="font-medium text-ink">
                    {name} · version {r.number} <span className="font-normal text-muted">({r.status})</span>
                  </div>
                  {r.report && (
                    <div className="mt-0.5 text-muted">
                      {r.report.faces} face{r.report.faces === 1 ? '' : 's'} · {r.report.files} files · {r.report.subsets.join(', ')} · {formatBytes(r.report.inputBytes)} →{' '}
                      {formatBytes(r.report.outputBytes)} WOFF2
                      {saved !== null && saved > 0 && <span className="text-good"> ({Math.round(saved * 100)}% smaller)</span>}
                      {r.report.warnings.length > 0 && <span className="text-warn"> · {r.report.warnings.length} warning{r.report.warnings.length === 1 ? '' : 's'}</span>}
                    </div>
                  )}
                </div>
                <Link
                  href={`/w/${ws}/families/${familySlugs?.[r.familyId] ?? r.familyId}?tab=review`}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-strong"
                >
                  Review &amp; publish
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
