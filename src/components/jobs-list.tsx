'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { JobBadge } from './status';
import { Button, Card, EmptyState, timeAgo, useToast } from './ui';

export interface JobRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  step: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: string | null;
  families: { familyId: string; name: string; slug?: string }[];
}

export function JobsList({ ws, jobs, canRetry }: { ws: string; jobs: JobRow[]; canRetry: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const running = jobs.some((j) => j.status === 'queued' || j.status === 'processing');

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 1500);
    return () => clearInterval(t);
  }, [running, router]);

  if (!jobs.length) return <EmptyState title="No jobs yet" description="Uploads, imports and axis limits run as jobs. Their status and reports show up here." />;

  return (
    <Card>
      <ul className="divide-y divide-line">
        {jobs.map((j) => {
          const duration = j.startedAt && j.finishedAt ? (new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime()) / 1000 : null;
          return (
            <li key={j.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <JobBadge status={j.status} />
                    <span className="font-medium text-ink">{j.title}</span>
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {j.status === 'processing' || j.status === 'queued' ? j.step ?? 'Queued' : j.status === 'failed' ? `Failed at: ${j.step}` : 'Done'} · started {timeAgo(j.createdAt)}
                    {j.createdBy ? ` by ${j.createdBy}` : ''}
                    {duration !== null ? ` · ${duration.toFixed(1)} s` : ''}
                    {j.attempts > 1 ? ` · attempt ${j.attempts}` : ''}
                  </div>
                  {j.error && <div className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{j.error}</div>}
                  {j.families.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
                      {j.families.map((f) => (
                        <Link key={f.familyId} href={`/w/${ws}/families/${f.slug ?? f.familyId}?tab=review`} className="font-medium text-accent hover:underline">
                          {f.name} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {canRetry && j.status === 'failed' && (
                  <Button
                    size="sm"
                    loading={busy === j.id}
                    onClick={async () => {
                      setBusy(j.id);
                      try {
                        await api(ws, `/api/v1/jobs/${j.id}/retry`, { method: 'POST' });
                        toast('Retrying…');
                        router.refresh();
                      } catch (e) {
                        toast((e as Error).message, 'bad');
                      }
                      setBusy(null);
                    }}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
