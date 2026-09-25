'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, formatBytes, timeAgo, useToast } from '../ui';
import type { FamilyViewData } from './shared';

export function VersionsPanel({ data, onChange, onView }: { data: FamilyViewData; onChange: () => void; onView: (id: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const { family, ws } = data;

  async function act(id: string, fn: () => Promise<unknown>, message: string) {
    setBusy(id);
    try {
      await fn();
      toast(message);
      onChange();
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
    setBusy(null);
  }

  return (
    <Card>
      <ol className="divide-y divide-line">
        {data.versions.map((v) => {
          const live = v.id === family.currentVersionId;
          const bytes = v.faces.flatMap((f) => f.files).filter((f) => f.format === 'woff2').reduce((a, b) => a + b.bytes, 0);
          return (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">v{v.number}</span>
                  <Badge tone={live ? 'good' : v.status === 'draft' ? 'warn' : v.status === 'failed' ? 'bad' : 'neutral'} dot>
                    {live ? 'Live' : v.status}
                  </Badge>
                </div>
                <div className="mt-0.5 text-[13px] text-muted">
                  {v.note ? `${v.note} · ` : ''}
                  {v.faces.length} face{v.faces.length === 1 ? '' : 's'}
                  {bytes ? ` · ${formatBytes(bytes)} WOFF2` : ' · external'} · created {timeAgo(v.createdAt)}
                  {v.author ? ` by ${v.author}` : ''}
                  {v.publishedAt ? ` · published ${timeAgo(v.publishedAt)}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => onView(v.id)}>
                  View
                </Button>
                {v.status === 'draft' && data.can.publish && (
                  <Button size="sm" variant="primary" loading={busy === v.id} onClick={() => act(v.id, () => api(ws, `/api/v1/families/${family.id}/versions/${v.id}/publish`, { body: {} }), `v${v.number} published.`)}>
                    Publish
                  </Button>
                )}
                {v.status === 'archived' && data.can.publish && (
                  <Button
                    size="sm"
                    loading={busy === v.id}
                    onClick={() => {
                      if (confirm(`Roll back ${family.displayName} to v${v.number}? All pages using it switch immediately.`)) {
                        act(v.id, () => api(ws, `/api/v1/families/${family.id}/rollback`, { body: { version: v.id } }), `Rolled back to v${v.number}.`);
                      }
                    }}
                  >
                    Roll back to v{v.number}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {data.can.upload && (
        <div className="border-t border-line px-5 py-3 text-[13px] text-muted">
          To add a new version, upload files with the same family name ({family.cssName}) from{' '}
          <a href={`/w/${ws}/add`} className="font-medium text-accent hover:underline">
            Add font
          </a>
          . They land here as a draft.
        </div>
      )}
    </Card>
  );
}
