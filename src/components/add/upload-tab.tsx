'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/client';
import { JobProgress } from '../job-progress';
import { Alert, Badge, Button, Card, Checkbox, cx, formatBytes, Input, Spinner } from '../ui';

interface Ref {
  key: string;
  filename: string;
}
interface Analyzed extends Ref {
  ok: boolean;
  error?: string;
  fix?: string;
  bytes: number;
  format?: string;
  family?: string;
  subfamily?: string;
  weight?: number;
  style?: 'normal' | 'italic';
  isVariable?: boolean;
  axes?: { tag: string; min: number; max: number; default: number }[];
  namedInstances?: string[];
  glyphCount?: number;
  scripts?: string[];
  warnings: string[];
  skip?: boolean;
  skipReason?: string;
  duplicateOf?: string;
  fromZip?: string;
  licence?: string;
}

const ACCEPT = '.ttf,.otf,.woff,.woff2,.zip';

export function UploadTab({ ws, workspaceId, mode }: { ws: string; workspaceId: string; mode: 'blob' | 'direct' }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'analyzing' | 'review' | 'processing'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [files, setFiles] = useState<Analyzed[]>([]);
  const [families, setFamilies] = useState<Record<string, string>>({}); // key → family name
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [licence, setLicence] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function uploadAll(list: File[]) {
    setError(null);
    const bad = list.filter((f) => !/\.(ttf|otf|woff2?|zip)$/i.test(f.name));
    const good = list.filter((f) => /\.(ttf|otf|woff2?|zip)$/i.test(f.name));
    if (bad.length) setNotes([`Skipped ${bad.map((f) => f.name).join(', ')}: only TTF, OTF, WOFF, WOFF2 and ZIP files are accepted. EOT, SVG and CSS files are not needed.`]);
    if (!good.length) return;
    const tooBig = good.find((f) => f.size > 20 * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} is larger than 20 MB.`);
      return;
    }
    setPhase('uploading');
    setProgress({ done: 0, total: good.length });
    try {
      let refs: Ref[] = [];
      if (mode === 'blob') {
        const { upload } = await import('@vercel/blob/client');
        refs = await Promise.all(
          good.map(async (file) => {
            const blob = await upload(`uploads/${workspaceId}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-()[\] ]+/g, '_')}`, file, {
              access: 'public',
              handleUploadUrl: '/api/v1/uploads/blob',
              headers: { 'X-Workspace': ws },
              contentType: 'application/octet-stream',
            });
            setProgress((p) => ({ ...p, done: p.done + 1 }));
            return { key: blob.url, filename: file.name };
          }),
        );
      } else {
        for (let i = 0; i < good.length; i += 8) {
          const form = new FormData();
          good.slice(i, i + 8).forEach((f) => form.append('files', f));
          const res = await api<{ files: Ref[] }>(ws, '/api/v1/uploads', { body: form });
          refs.push(...res.files);
          setProgress((p) => ({ ...p, done: Math.min(p.total, i + 8) }));
        }
      }
      setPhase('analyzing');
      const res = await api<{ files: Analyzed[]; notes: string[] }>(ws, '/api/v1/uploads/analyze', { body: { files: refs } });
      setFiles((prev) => [...prev, ...res.files]);
      setFamilies((prev) => ({ ...prev, ...Object.fromEntries(res.files.filter((f) => f.ok).map((f) => [f.key, f.family!])) }));
      setNotes((n) => [...n, ...res.notes]);
      setPhase('review');
    } catch (e) {
      setError((e as Error).message);
      setPhase(files.length ? 'review' : 'idle');
    }
  }

  const usable = files.filter((f) => f.ok && !f.skip);
  const groups = [...new Set(usable.map((f) => families[f.key]))];
  const familyNames = [...new Set(Object.values(families))];

  async function process() {
    setError(null);
    try {
      const res = await api<{ job: { id: string } }>(ws, '/api/v1/families/uploads', {
        body: { files: usable.map((f) => ({ key: f.key, filename: f.filename, family: families[f.key].trim() })), licenceConfirmed: licence },
      });
      setJobId(res.job.id);
      setPhase('processing');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (phase === 'processing' && jobId) {
    return (
      <div className="space-y-4">
        <JobProgress ws={ws} jobId={jobId} />
        <Button
          onClick={() => {
            setFiles([]);
            setFamilies({});
            setNotes([]);
            setJobId(null);
            setLicence(false);
            setPhase('idle');
          }}
        >
          Upload more fonts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          uploadAll([...e.dataTransfer.files]);
        }}
        className={cx(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          drag ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface',
        )}
      >
        {phase === 'uploading' || phase === 'analyzing' ? (
          <div className="flex items-center gap-3 text-sm text-ink-2" role="status">
            <Spinner className="size-5 text-accent" />
            {phase === 'uploading' ? `Uploading ${progress.done}/${progress.total}…` : 'Reading font metadata…'}
          </div>
        ) : (
          <>
            <div className="text-[15px] font-semibold text-ink">Drop font files here</div>
            <p className="mt-1 max-w-md text-sm text-muted">
              TTF, OTF, WOFF, WOFF2 or a ZIP (for example an old Transfonter export), up to 20 MB each. One source file per weight is enough; we create WOFF2 and WOFF.
            </p>
            <Button variant="primary" className="mt-4" onClick={() => input.current?.click()}>
              Choose files
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              aria-label="Choose font files"
              onChange={(e) => {
                uploadAll([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {error && <Alert tone="bad">{error}</Alert>}
      {notes.map((n) => (
        <Alert key={n} tone="neutral">
          {n}
        </Alert>
      ))}

      {files.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">Detected faces</h2>
              <p className="text-[13px] text-muted">
                Files are grouped by their typographic family name. Edit the family name to regroup a file.
              </p>
            </div>
            <Badge tone="accent">
              {groups.length} famil{groups.length === 1 ? 'y' : 'ies'} · {usable.length} file{usable.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <datalist id="family-names">
            {familyNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Family</th>
                  <th className="px-3 py-2 font-medium">Style</th>
                  <th className="px-3 py-2 font-medium">Weight</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.key} className={cx('border-b border-line last:border-0 align-top', (!f.ok || f.skip) && 'bg-canvas/70')}>
                    <td className="px-5 py-3">
                      <div className="max-w-[220px] truncate font-medium text-ink" title={f.filename}>
                        {f.filename}
                      </div>
                      <div className="text-xs text-muted">
                        {f.format?.toUpperCase() ?? '—'} · {formatBytes(f.bytes)}
                        {f.fromZip && ` · from ${f.fromZip}`}
                      </div>
                    </td>
                    {f.ok ? (
                      <>
                        <td className="px-3 py-3">
                          <label className="sr-only" htmlFor={`fam-${f.key}`}>
                            Family for {f.filename}
                          </label>
                          <Input
                            id={`fam-${f.key}`}
                            list="family-names"
                            value={families[f.key] ?? ''}
                            onChange={(e) => setFamilies((m) => ({ ...m, [f.key]: e.target.value }))}
                            disabled={f.skip}
                            className="h-8 min-w-[160px]"
                          />
                        </td>
                        <td className="px-3 py-3 text-ink-2">
                          {f.subfamily}
                          <div className="text-xs text-muted">{f.style}</div>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink-2">
                          {f.isVariable ? (
                            <Badge tone="accent">Variable</Badge>
                          ) : (
                            f.weight
                          )}
                          {f.isVariable && (
                            <div className="mt-1 text-xs text-muted">{f.axes?.map((a) => `${a.tag} ${a.min}–${a.max}`).join(', ')}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted">
                          <div>
                            {f.glyphCount} glyphs · {f.scripts?.slice(0, 4).join(', ')}
                            {(f.scripts?.length ?? 0) > 4 ? '…' : ''}
                          </div>
                          {f.isVariable && f.namedInstances?.length ? <div>{f.namedInstances.length} named instances</div> : null}
                          {f.skip && <div className="mt-1 text-warn">{f.skipReason}</div>}
                          {f.duplicateOf && <div className="mt-1 text-warn">This exact file is already in {f.duplicateOf}. Uploading it again creates a new version.</div>}
                          {f.warnings.map((w) => (
                            <div key={w} className="mt-1 text-warn">
                              {w}
                            </div>
                          ))}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-3 py-3">
                        <div className="text-sm text-bad">{f.error}</div>
                        {f.fix && <div className="text-xs text-muted">{f.fix}</div>}
                      </td>
                    )}
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setFiles((l) => l.filter((x) => x.key !== f.key))} aria-label={`Remove ${f.filename}`}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-4 border-t border-line px-5 py-4">
            <Checkbox
              checked={licence}
              onChange={setLicence}
              label="I confirm we are licensed to self-host and serve these fonts on the web"
              description="Required before processing. You can record licence details (type, owner, domains, expiry) on each family afterwards."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={!usable.length || !licence || groups.some((g) => !g?.trim())} onClick={process}>
                Process {usable.length} file{usable.length === 1 ? '' : 's'}
              </Button>
              <span className="text-xs text-muted">Validates, converts to WOFF2 + WOFF and subsets by script. Families are created as drafts for review.</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
