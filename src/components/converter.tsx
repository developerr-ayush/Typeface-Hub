'use client';

import { useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, cx, formatBytes, Input, Select, Spinner } from './ui';

type Characters = 'full' | 'split' | 'latin' | 'latin-ext' | 'custom';
interface Summary {
  families: { family: string; faces: { name: string; weight: string; style: string; variable: boolean; file: string }[] }[];
  skipped: { file: string; reason: string }[];
  files: number;
}

const ACCEPT = '.ttf,.otf,.woff,.woff2,.zip';
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export function Converter({ mode, limits }: { mode: 'blob' | 'direct'; limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number } }) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [formats, setFormats] = useState<string[]>(['woff2', 'woff']);
  const [characters, setCharacters] = useState<Characters>('latin-ext');
  const [customText, setCustomText] = useState('');
  const [variable, setVariable] = useState<'variable' | 'static'>('variable');
  const [staticWeights, setStaticWeights] = useState<number[]>([400, 700]);
  const [pathPrefix, setPathPrefix] = useState('../fonts/');
  const [display, setDisplay] = useState('swap');
  const [fallback, setFallback] = useState(true);
  const [demo, setDemo] = useState(true);
  const [licence, setLicence] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'converting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [result, setResult] = useState<{ summary: Summary | null; filename: string; bytes: number } | null>(null);

  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
  const total = files.reduce((a, f) => a + f.size, 0);

  function add(list: File[]) {
    setError(null);
    setResult(null);
    const ok = list.filter((f) => /\.(ttf|otf|woff2?|zip)$/i.test(f.name));
    const rejected = list.filter((f) => !ok.includes(f));
    const tooBig = ok.filter((f) => f.size > limits.maxFileBytes);
    setNotes([
      ...(rejected.length ? [`Skipped ${rejected.map((f) => f.name).join(', ')}: only TTF, OTF, WOFF, WOFF2 and ZIP files work. EOT and SVG fonts aren't needed any more.`] : []),
      ...(tooBig.length ? [`Skipped ${tooBig.map((f) => f.name).join(', ')}: larger than ${limits.maxFileBytes / 1024 / 1024} MB.`] : []),
    ]);
    setFiles((prev) => {
      const next = [...prev, ...ok.filter((f) => f.size <= limits.maxFileBytes && !prev.some((p) => p.name === f.name && p.size === f.size))];
      if (next.length > limits.maxFiles) setError(`Convert up to ${limits.maxFiles} files at a time.`);
      return next.slice(0, limits.maxFiles);
    });
  }

  async function convert() {
    setError(null);
    setResult(null);
    const options = {
      formats,
      characters,
      customText: characters === 'custom' ? customText : undefined,
      variable,
      staticWeights: variable === 'static' ? staticWeights : undefined,
      pathPrefix,
      display,
      fallback,
      demo,
    };
    try {
      let res: Response;
      if (mode === 'blob') {
        setPhase('uploading');
        const { upload } = await import('@vercel/blob/client');
        const uploaded = await Promise.all(
          files.map(async (f) => {
            const blob = await upload(`convert/${crypto.randomUUID()}/${f.name.replace(/[^\w.\-()[\] ]+/g, '_')}`, f, {
              access: 'public',
              handleUploadUrl: '/api/convert/upload',
              contentType: 'application/octet-stream',
            });
            return { url: blob.url, filename: f.name };
          }),
        );
        setPhase('converting');
        res = await fetch('/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: uploaded, options, licenceConfirmed: licence }) });
      } else {
        setPhase('converting');
        const form = new FormData();
        files.forEach((f) => form.append('files', f));
        form.append('options', JSON.stringify(options));
        form.append('licenceConfirmed', String(licence));
        res = await fetch('/api/convert', { method: 'POST', body: form });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? (res.status === 413 ? 'The upload is too large.' : `Conversion failed (${res.status}).`));
      }
      const blob = await res.blob();
      const filename = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'webfont-kit.zip';
      let summary: Summary | null = null;
      try {
        const raw = res.headers.get('X-Convert-Summary');
        if (raw) summary = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
      } catch {
        summary = null;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResult({ summary, filename, bytes: blob.size });
    } catch (e) {
      setError((e as Error).message);
    }
    setPhase('idle');
  }

  const busy = phase !== 'idle';
  const ready = files.length > 0 && formats.length > 0 && licence && !(characters === 'custom' && !customText.trim()) && !(variable === 'static' && !staticWeights.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            add([...e.dataTransfer.files]);
          }}
          className={cx('flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors', drag ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface')}
        >
          <div className="text-lg font-semibold text-ink">Drop your fonts here</div>
          <p className="mt-1 max-w-md text-sm text-muted">
            TTF, OTF, WOFF, WOFF2 or a ZIP. Up to {limits.maxFiles} files, {limits.maxFileBytes / 1024 / 1024} MB each. Files are deleted as soon as your kit is ready.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => input.current?.click()}>
            Choose fonts
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            aria-label="Choose font files"
            onChange={(e) => {
              add([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </div>

        {notes.map((n) => (
          <Alert key={n} tone="neutral">
            {n}
          </Alert>
        ))}

        {files.length > 0 && (
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold">
                {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(total)}
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setFiles([])}>
                Clear
              </Button>
            </div>
            <ul className="divide-y divide-line">
              {files.map((f) => (
                <li key={`${f.name}${f.size}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-ink" title={f.name}>
                    {f.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                    {formatBytes(f.size)}
                    <button type="button" className="font-medium hover:text-ink" onClick={() => setFiles((l) => l.filter((x) => x !== f))} aria-label={`Remove ${f.name}`}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {error && <Alert tone="bad">{error}</Alert>}

        {result && (
          <Card className="border-good/30 p-5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">Your kit is downloading</h2>
              <Badge tone="good">
                {result.filename} · {formatBytes(result.bytes)}
              </Badge>
            </div>
            {result.summary && (
              <div className="mt-3 space-y-3 text-sm">
                {result.summary.families.map((fam) => (
                  <div key={fam.family}>
                    <div className="font-medium text-ink">{fam.family}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {fam.faces.map((f) => (
                        <Badge key={f.file} tone={f.variable ? 'accent' : 'neutral'}>
                          {f.variable ? `Variable ${f.weight}` : f.weight} {f.style !== 'normal' ? f.style : ''}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-muted">{result.summary.files} font files, a stylesheet{demo ? ', a demo page' : ''} and a README with the 3 steps to use them.</p>
                {result.summary.skipped.length > 0 && (
                  <Alert tone="warn" title="Some files were skipped">
                    <ul className="mt-1 list-disc pl-5">
                      {result.summary.skipped.map((s) => (
                        <li key={s.file + s.reason}>
                          {s.file}: {s.reason}
                        </li>
                      ))}
                    </ul>
                  </Alert>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      <Card className="h-fit space-y-5 p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Formats</legend>
          <div className="space-y-2">
            <Checkbox label="WOFF2" description="Smallest; all modern browsers" checked={formats.includes('woff2')} onChange={(v) => setFormats((f) => toggle(f, 'woff2', v))} />
            <Checkbox label="WOFF" description="Older browsers" checked={formats.includes('woff')} onChange={(v) => setFormats((f) => toggle(f, 'woff', v))} />
            <Checkbox label="TTF / OTF" description="Desktop apps, email, native apps" checked={formats.includes('sfnt')} onChange={(v) => setFormats((f) => toggle(f, 'sfnt', v))} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Characters</legend>
          <Select aria-label="Characters" value={characters} onChange={(e) => setCharacters(e.target.value as Characters)}>
            <option value="latin-ext">Latin + Latin Extended</option>
            <option value="latin">Basic Latin only (smallest)</option>
            <option value="split">Split by script (unicode-range)</option>
            <option value="full">Full font</option>
            <option value="custom">Only these characters…</option>
          </Select>
          {characters === 'custom' && <Input aria-label="Characters to keep" className="mt-2" placeholder="THE QUICK BROWN FOX 0123456789" value={customText} onChange={(e) => setCustomText(e.target.value)} />}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Variable fonts</legend>
          <Select aria-label="Variable fonts" value={variable} onChange={(e) => setVariable(e.target.value as 'variable')}>
            <option value="variable">Keep as variable</option>
            <option value="static">Export static weights</option>
          </Select>
          {variable === 'static' && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {WEIGHTS.map((w) => (
                <Checkbox key={w} label={String(w)} checked={staticWeights.includes(w)} onChange={(v) => setStaticWeights((s) => toggle(s, w, v).sort((a, b) => a - b))} />
              ))}
            </div>
          )}
        </fieldset>

        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-ink">CSS options</summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Font path in CSS</span>
              <Input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">font-display</span>
              <Select value={display} onChange={(e) => setDisplay(e.target.value)}>
                {['swap', 'optional', 'fallback', 'block', 'auto'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </label>
            <Checkbox label="Fallback face" description="Resized local font to reduce layout shift" checked={fallback} onChange={setFallback} />
            <Checkbox label="Demo page" checked={demo} onChange={setDemo} />
          </div>
        </details>

        <div className="border-t border-line pt-4">
          <Checkbox checked={licence} onChange={setLicence} label="I’m allowed to convert these fonts and use them on the web" description="Check your font licence. Open-source fonts (OFL, Apache) are fine." />
        </div>

        <Button variant="primary" className="w-full" disabled={!ready || busy} onClick={convert}>
          {busy ? (
            <>
              <Spinner className="size-4" /> {phase === 'uploading' ? 'Uploading…' : 'Converting…'}
            </>
          ) : (
            'Convert & download'
          )}
        </Button>
      </Card>
    </div>
  );
}
