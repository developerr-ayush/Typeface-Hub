'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { JobProgress } from '../job-progress';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, formatBytes, Input, Modal, Select, Stat, useToast } from '../ui';
import { fontStack, weightLabel, type FaceData, type FamilyViewData, type VersionData } from './shared';

export function ReviewPanel({ data, version, current, onChange, onSelect }: { data: FamilyViewData; version: VersionData; current: VersionData | null; onChange: () => void; onSelect: (id: string) => void }) {
  const toast = useToast();
  const { family, ws } = data;
  const isDraft = version.status === 'draft';
  const r = version.report;
  const [publishOpen, setPublishOpen] = useState(false);
  const [licence, setLicence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsLicence = !family.licence.type && !family.licence.confirmedAt;
  const external = !version.faces.some((f) => f.files.length);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await api(ws, `/api/v1/families/${family.id}/versions/${version.id}/publish`, { body: { licenceConfirmed: licence || undefined } });
      toast(`${family.displayName} v${version.number} is live.`);
      setPublishOpen(false);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }
  async function discard() {
    if (!confirm(`Discard draft v${version.number}? Its files are removed from the library.`)) return;
    try {
      const res = await api<{ familyDeleted: boolean }>(ws, `/api/v1/families/${family.id}/versions/${version.id}`, { method: 'DELETE' });
      toast(`Draft v${version.number} discarded.`);
      if (res.familyDeleted) window.location.href = `/w/${ws}`;
      else onChange();
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  }

  const drafts = data.versions.filter((v) => v.status === 'draft' || v.status === 'failed');

  return (
    <div className="space-y-6">
      {drafts.length > 1 && (
        <Alert tone="neutral">
          There are {drafts.length} drafts.{' '}
          <Select aria-label="Choose draft" className="ml-2 inline-block h-7 w-auto" value={version.id} onChange={(e) => onSelect(e.target.value)}>
            {data.versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.number} · {v.status}
              </option>
            ))}
          </Select>
        </Alert>
      )}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Version {version.number}
              <Badge tone={isDraft ? 'warn' : version.status === 'published' ? 'good' : 'neutral'}>{version.status}</Badge>
            </span>
          }
          description={version.note ?? (external ? 'Delivered by an external provider.' : 'Processing report and detected faces.')}
          actions={
            isDraft && (
              <>
                {data.can.upload && (
                  <Button size="sm" variant="ghost" onClick={discard}>
                    Discard draft
                  </Button>
                )}
                {data.can.publish ? (
                  <Button size="sm" variant="primary" onClick={() => setPublishOpen(true)}>
                    Publish v{version.number}
                  </Button>
                ) : (
                  <span className="text-xs text-muted">A publisher needs to publish this draft.</span>
                )}
              </>
            )
          }
        />
        {r && (
          <div className="grid grid-cols-2 gap-5 px-5 py-4 sm:grid-cols-5">
            <Stat label="Faces" value={r.faces} />
            <Stat label="Files" value={r.files} hint="WOFF2 + WOFF" />
            <Stat label="Source size" value={formatBytes(r.inputBytes)} />
            <Stat
              label="WOFF2, all subsets"
              value={formatBytes(r.outputBytes)}
              hint={r.inputBytes ? <span className="text-good">{Math.max(0, Math.round((1 - r.outputBytes / r.inputBytes) * 100))}% smaller</span> : undefined}
            />
            <Stat label="Processed in" value={`${(r.durationMs / 1000).toFixed(1)} s`} />
          </div>
        )}
        {r && r.warnings.length > 0 && (
          <div className="space-y-1 border-t border-line px-5 py-4">
            <h3 className="text-sm font-semibold text-warn">Warnings</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
              {r.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Faces" description={isDraft ? 'Fix any mislabelled weight or style before publishing. Changes only affect the generated CSS.' : 'Published versions are read-only. Upload a new version to change them.'} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">Preview</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Style</th>
                <th className="px-3 py-2 font-medium">Weight</th>
                <th className="px-3 py-2 font-medium">Axes</th>
                <th className="px-3 py-2 font-medium">Subsets</th>
                <th className="px-3 py-2 text-right font-medium">WOFF2</th>
              </tr>
            </thead>
            <tbody>
              {version.faces.map((f) => (
                <FaceRow key={f.id} face={f} version={version} data={data} editable={isDraft && data.can.upload} onSaved={onChange} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!external && version.faces.some((f) => f.axes.length) && data.can.upload && <AxisLimiter data={data} version={version} />}

      {current && current.id !== version.id && <Compare family={family} a={current} b={version} />}

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={`Publish ${family.displayName} v${version.number}?`}
        description={
          current
            ? `Every page and token using ${family.cssName} switches from v${current.number} to v${version.number}. You can roll back in one click.`
            : `${family.cssName} becomes available in the CSS API and the typography editor.`
        }
        footer={
          <>
            <Button onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={needsLicence && !licence} onClick={publish}>
              Publish
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {needsLicence && <Checkbox checked={licence} onChange={setLicence} label="I confirm we are licensed to serve this font on the web" description="No licence has been recorded for this family yet." />}
          {error && <Alert tone="bad">{error}</Alert>}
        </div>
      </Modal>
    </div>
  );
}

function FaceRow({ face, version, data, editable, onSaved }: { face: FaceData; version: VersionData; data: FamilyViewData; editable: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(face.name);
  const [style, setStyle] = useState(face.style);
  const [wMin, setWMin] = useState(face.weightMin);
  const [wMax, setWMax] = useState(face.weightMax);
  const [saving, setSaving] = useState(false);
  const dirty = name !== face.name || style !== face.style || wMin !== face.weightMin || wMax !== face.weightMax;
  const variable = face.axes.length > 0;
  const woff2 = face.files.filter((f) => f.format === 'woff2');
  const subsets = woff2.map((f) => f.subset);

  async function save() {
    setSaving(true);
    try {
      await api(data.ws, `/api/v1/families/${data.family.id}/faces/${face.id}`, { method: 'PATCH', body: { name, style, weightMin: wMin, weightMax: variable ? wMax : wMin } });
      toast('Face updated.');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
    setSaving(false);
  }

  return (
    <tr className="border-b border-line align-middle last:border-0">
      <td className="px-5 py-3">
        <span className="text-2xl whitespace-nowrap text-ink" style={{ fontFamily: fontStack(version.alias, data.family.fallbackStack), fontWeight: variable ? 400 : face.weightMin, fontStyle: face.style }}>
          Ag
        </span>
      </td>
      <td className="px-3 py-3">
        {editable ? <Input aria-label="Face name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-40" /> : <span className="font-medium text-ink">{face.name}</span>}
        {face.sourceFile && <div className="mt-0.5 max-w-[180px] truncate text-xs text-muted" title={face.sourceFile}>{face.sourceFile}</div>}
      </td>
      <td className="px-3 py-3">
        {editable ? (
          <Select aria-label="Style" value={style} onChange={(e) => setStyle(e.target.value as 'normal' | 'italic')} className="h-8 w-28">
            <option value="normal">normal</option>
            <option value="italic">italic</option>
          </Select>
        ) : (
          face.style
        )}
      </td>
      <td className="px-3 py-3 tabular-nums">
        {editable ? (
          <div className="flex items-center gap-1">
            <Input aria-label="Weight" type="number" min={1} max={1000} value={wMin} onChange={(e) => setWMin(Number(e.target.value))} className="h-8 w-20" />
            {variable && (
              <>
                <span className="text-muted">–</span>
                <Input aria-label="Maximum weight" type="number" min={1} max={1000} value={wMax} onChange={(e) => setWMax(Number(e.target.value))} className="h-8 w-20" />
              </>
            )}
          </div>
        ) : (
          weightLabel(face)
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted">
        {variable ? face.axes.map((a) => `${a.tag} ${+a.min.toFixed(2)}–${+a.max.toFixed(2)}`).join(', ') : '—'}
        {face.namedInstances.length > 0 && <div>{face.namedInstances.length} named instances</div>}
      </td>
      <td className="px-3 py-3 text-xs text-muted">{subsets.length ? subsets.join(', ') : 'external'}</td>
      <td className="px-3 py-3 text-right text-xs whitespace-nowrap tabular-nums">
        {woff2.length ? formatBytes(woff2.reduce((a, b) => a + b.bytes, 0)) : '—'}
        {face.masterBytes > 0 && <div className="text-muted">from {formatBytes(face.masterBytes)}</div>}
        {editable && dirty && (
          <Button size="sm" variant="primary" className="mt-1" loading={saving} onClick={save}>
            Save
          </Button>
        )}
      </td>
    </tr>
  );
}

function AxisLimiter({ data, version }: { data: FamilyViewData; version: VersionData }) {
  const axes = version.faces.find((f) => f.axes.length)!.axes;
  const [limits, setLimits] = useState<Record<string, { mode: 'keep' | 'range' | 'pin'; min: number; max: number; value: number }>>(
    Object.fromEntries(axes.map((a) => [a.tag, { mode: 'keep' as const, min: a.min, max: a.max, value: a.default }])),
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = Object.entries(limits).filter(([, l]) => l.mode !== 'keep');

  async function run() {
    setError(null);
    try {
      const axisLimits = Object.fromEntries(active.map(([tag, l]) => [tag, l.mode === 'pin' ? l.value : { min: l.min, max: l.max }]));
      const res = await api<{ job: { id: string } }>(data.ws, `/api/v1/families/${data.family.id}/reprocess`, { body: { versionId: version.id, axisLimits } });
      setJobId(res.job.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader title="Limit variable axes" description="Cap an axis to the range you use, or pin unused axes, to cut file size. Creates a new draft version from the original masters." />
      <div className="space-y-3 px-5 py-4">
        {jobId ? (
          <JobProgress ws={data.ws} jobId={jobId} />
        ) : (
          <>
            {axes.map((a) => {
              const l = limits[a.tag];
              const set = (patch: Partial<typeof l>) => setLimits((x) => ({ ...x, [a.tag]: { ...x[a.tag], ...patch } }));
              return (
                <div key={a.tag} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-40 font-medium text-ink">
                    {a.name ?? a.tag} <span className="text-muted">({a.tag} {a.min}–{a.max})</span>
                  </span>
                  <Select aria-label={`${a.tag} mode`} value={l.mode} onChange={(e) => set({ mode: e.target.value as 'keep' })} className="h-8 w-32">
                    <option value="keep">Keep all</option>
                    <option value="range">Limit range</option>
                    <option value="pin">Pin to value</option>
                  </Select>
                  {l.mode === 'range' && (
                    <span className="flex items-center gap-1">
                      <Input aria-label={`${a.tag} minimum`} type="number" min={a.min} max={a.max} value={l.min} onChange={(e) => set({ min: Number(e.target.value) })} className="h-8 w-20" />–
                      <Input aria-label={`${a.tag} maximum`} type="number" min={a.min} max={a.max} value={l.max} onChange={(e) => set({ max: Number(e.target.value) })} className="h-8 w-20" />
                    </span>
                  )}
                  {l.mode === 'pin' && <Input aria-label={`${a.tag} value`} type="number" min={a.min} max={a.max} value={l.value} onChange={(e) => set({ value: Number(e.target.value) })} className="h-8 w-24" />}
                </div>
              );
            })}
            {error && <Alert tone="bad">{error}</Alert>}
            <Button disabled={!active.length} onClick={run}>
              Create limited version
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Compare({ family, a, b }: { family: FamilyViewData['family']; a: VersionData; b: VersionData }) {
  const [text, setText] = useState('Hamburgefonstiv 0123456789');
  const size = (v: VersionData) => v.faces.flatMap((f) => f.files).filter((f) => f.format === 'woff2' && (f.subset === 'latin' || f.subset === 'all')).reduce((x, y) => x + y.bytes, 0);
  const diff = size(b) - size(a);
  return (
    <Card>
      <CardHeader
        title={`Compare with live v${a.number}`}
        description={
          <>
            Latin WOFF2: {formatBytes(size(a))} → {formatBytes(size(b))}{' '}
            <span className={diff > 0 ? 'text-bad' : 'text-good'}>
              ({diff > 0 ? '+' : diff < 0 ? '−' : ''}
              {formatBytes(Math.abs(diff))})
            </span>
          </>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <Input aria-label="Comparison text" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="grid gap-4 md:grid-cols-2">
          {[a, b].map((v) => (
            <div key={v.id} className="rounded-lg border border-line p-4">
              <div className="mb-2 text-xs text-muted">
                v{v.number} · {v.status}
              </div>
              {[400, 700].map((w) => (
                <p key={w} className="truncate text-3xl text-ink" style={{ fontFamily: fontStack(v.alias, family.fallbackStack), fontWeight: w }}>
                  {text}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
