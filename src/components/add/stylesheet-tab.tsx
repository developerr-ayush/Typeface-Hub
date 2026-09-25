'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { JobProgress } from '../job-progress';
import { Alert, Badge, Button, Card, Checkbox, cx, Field, Input, Textarea } from '../ui';

interface Preview {
  families: { family: string; faces: { weight: string; style: string; formats: string[] }[] }[];
  faces: number;
  needsBaseUrl: boolean;
}

export function StylesheetTab({ ws, selfHostOnly }: { ws: string; selfHostOnly: boolean }) {
  const router = useRouter();
  const [source, setSource] = useState<'url' | 'css'>('url');
  const [url, setUrl] = useState('');
  const [css, setCss] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<'import' | 'external'>('import');
  const [licence, setLicence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  async function inspect() {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await api<Preview>(ws, '/api/v1/families/custom-url/preview', {
        body: source === 'url' ? { url } : { css, baseUrl: baseUrl || undefined },
      });
      setPreview(res);
      setPicked(res.families.map((f) => f.family));
      if (source === 'css') setMode('import');
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ job?: { id: string }; families?: { slug: string }[] }>(ws, '/api/v1/families/custom-url', {
        body: {
          ...(source === 'url' ? { url } : { css, baseUrl: baseUrl || undefined, legacy: true }),
          mode,
          families: picked,
          licenceConfirmed: licence,
        },
      });
      if (res.job) setJobId(res.job.id);
      if (res.families?.[0]) router.push(`/w/${ws}/families/${res.families[0].slug}?tab=review`);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (jobId) return <JobProgress ws={ws} jobId={jobId} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card className="p-5">
        <div className="mb-4 inline-flex rounded-lg border border-line bg-canvas p-0.5" role="radiogroup" aria-label="Source">
          {(
            [
              ['url', 'Stylesheet URL'],
              ['css', 'Paste CSS (legacy import)'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={source === v}
              onClick={() => {
                setSource(v);
                setPreview(null);
              }}
              className={cx('rounded-md px-3 py-1.5 text-[13px] font-medium', source === v ? 'bg-surface text-ink shadow-sm' : 'text-muted')}
            >
              {l}
            </button>
          ))}
        </div>
        {source === 'url' ? (
          <Field label="Stylesheet URL" hint="Adobe Fonts, a CDN or any CSS file with @font-face rules.">
            {(id) => <Input id={id} type="url" placeholder="https://use.typekit.net/abc1234.css" value={url} onChange={(e) => setUrl(e.target.value)} />}
          </Field>
        ) : (
          <div className="space-y-4">
            <Field label="CSS" hint="Paste the stored CSS of an existing font (for example a FanXP / Transfonter stylesheet). EOT and SVG sources are ignored.">
              {(id) => (
                <Textarea
                  id={id}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={"@font-face {\n  font-family: 'Montserrat';\n  src: url('Montserrat-Bold.woff2') format('woff2'), url('Montserrat-Bold.ttf') format('truetype');\n  font-weight: 700;\n}"}
                  value={css}
                  onChange={(e) => setCss(e.target.value)}
                />
              )}
            </Field>
            <Field label="Base URL of the font files" hint="Needed when the CSS uses relative URLs, e.g. https://cdn.example.com/static-assets/fonts/typography/">
              {(id) => <Input id={id} type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…" />}
            </Field>
          </div>
        )}
        <Button className="mt-4" onClick={inspect} loading={busy && !preview} disabled={source === 'url' ? !url : !css}>
          Read stylesheet
        </Button>
        {error && (
          <div className="mt-4">
            <Alert tone="bad">{error}</Alert>
          </div>
        )}
        {preview && (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">
              Found {preview.families.length} famil{preview.families.length === 1 ? 'y' : 'ies'} ({preview.faces} @font-face rules)
            </h3>
            {preview.needsBaseUrl && <Alert tone="warn">The CSS uses relative URLs. Add the base URL above so the files can be downloaded.</Alert>}
            {preview.families.map((f) => (
              <div key={f.family} className="rounded-lg border border-line p-3">
                <Checkbox label={f.family} checked={picked.includes(f.family)} onChange={(v) => setPicked((p) => (v ? [...p, f.family] : p.filter((x) => x !== f.family)))} />
                <div className="mt-2 flex flex-wrap gap-1 pl-6">
                  {f.faces.map((face) => (
                    <Badge key={`${face.weight}${face.style}`}>
                      {face.weight} {face.style !== 'normal' ? face.style : ''} · {face.formats.join('/')}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="h-fit p-5">
        <fieldset disabled={!preview}>
          <legend className="text-sm font-semibold text-ink">Delivery</legend>
          <div className="mt-3 space-y-2">
            {(
              [
                ['import', 'Import as internal', 'Download the best source per face (TTF/OTF, else WOFF2) and process it like an upload.'],
                ['external', 'Load external', 'Keep serving from the provider; the CSS API imports their stylesheet.'],
              ] as const
            ).map(([v, l, d]) => {
              const disabled = v === 'external' && (source === 'css' || selfHostOnly);
              return (
                <label key={v} className={cx('flex cursor-pointer gap-2.5 rounded-lg border p-3', mode === v ? 'border-accent bg-accent-soft/60' : 'border-line', disabled && 'cursor-not-allowed opacity-50')}>
                  <input type="radio" name="css-mode" checked={mode === v} disabled={disabled} onChange={() => setMode(v)} className="mt-0.5 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{l}</span>
                    <span className="block text-xs text-muted">{d}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {mode === 'import' && (
            <div className="mt-4">
              <Checkbox checked={licence} onChange={setLicence} label="I confirm we are licensed to self-host these fonts" />
            </div>
          )}
          <Button variant="primary" className="mt-5 w-full" loading={busy && !!preview} disabled={!preview || !picked.length || (mode === 'import' && !licence)} onClick={submit}>
            {mode === 'import' ? `Import ${picked.length} famil${picked.length === 1 ? 'y' : 'ies'}` : 'Add to library'}
          </Button>
        </fieldset>
      </Card>
    </div>
  );
}
