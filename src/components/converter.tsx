'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AxisControls, axisLabel, mergeAxes, toAxesOption, type AxisInfo, type AxisSetting } from './axis-controls';
import { Alert, Badge, Button, Card, Checkbox, cx, formatBytes, Input, Select, Spinner } from './ui';

type Characters = 'full' | 'split' | 'latin' | 'latin-ext' | 'custom';
interface Summary {
  families: { family: string; faces: { name: string; weight: string; style: string; variable: boolean; file: string }[] }[];
  skipped: { file: string; reason: string }[];
  files: number;
}
interface Inspected {
  file: string;
  fromZip?: string;
  ok: boolean;
  error?: string;
  family?: string;
  subfamily?: string;
  style?: 'normal' | 'italic';
  weight?: number;
  format?: string;
  bytes: number;
  isVariable?: boolean;
  axes?: AxisInfo[];
  namedInstances?: string[];
  glyphs?: number;
  scripts?: string[];
}
interface Entry {
  id: string;
  file: File;
  url?: string; // Vercel Blob URL once uploaded (cleared after conversion, which deletes it)
  status: 'reading' | 'ready' | 'error';
  error?: string;
  fonts: Inspected[];
}

const ACCEPT = '.ttf,.otf,.woff,.woff2,.zip';
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const PANGRAM = 'The quick brown fox jumps over the lazy dog';

async function uploadToBlob(file: File) {
  const { upload } = await import('@vercel/blob/client');
  const blob = await upload(`convert/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-()[\] ]+/g, '_')}`, file, {
    access: 'public',
    handleUploadUrl: '/api/convert/upload',
    contentType: 'application/octet-stream',
  });
  return blob.url;
}

export function Converter({ mode, limits }: { mode: 'blob' | 'direct'; limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number } }) {
  const input = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drag, setDrag] = useState(false);
  const [formats, setFormats] = useState<string[]>(['woff2', 'woff']);
  const [characters, setCharacters] = useState<Characters>('latin-ext');
  const [customText, setCustomText] = useState('');
  const [variable, setVariable] = useState<'variable' | 'static'>('variable');
  const [staticWeights, setStaticWeights] = useState<number[]>([400, 700]);
  const [axisSettings, setAxisSettings] = useState<Record<string, AxisSetting>>({});
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
  const fonts = entries.flatMap((e) => e.fonts);
  const okFonts = fonts.filter((f) => f.ok);
  const variableFonts = okFonts.filter((f) => f.isVariable);
  const axes = useMemo(() => mergeAxes(variableFonts.map((f) => f.axes ?? [])), [variableFonts.map((f) => f.file).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = entries.reduce((a, e) => a + e.file.size, 0);
  const reading = entries.some((e) => e.status === 'reading');

  async function inspect(batch: Entry[]) {
    try {
      let res: Response;
      if (mode === 'blob') {
        const withUrls = await Promise.all(batch.map(async (e) => ({ ...e, url: e.url ?? (await uploadToBlob(e.file)) })));
        setEntries((all) => all.map((e) => withUrls.find((w) => w.id === e.id) ?? e));
        res = await fetch('/api/convert/inspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: withUrls.map((e) => ({ url: e.url, filename: e.file.name })) }) });
      } else {
        const form = new FormData();
        batch.forEach((e) => form.append('files', e.file));
        res = await fetch('/api/convert/inspect', { method: 'POST', body: form });
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `Could not read the fonts (${res.status}).`);
      const found = body.fonts as Inspected[];
      setEntries((all) =>
        all.map((e) => {
          if (!batch.some((b) => b.id === e.id)) return e;
          const mine = found.filter((f) => f.file === e.file.name || f.fromZip === e.file.name);
          const bad = mine.length > 0 && mine.every((f) => !f.ok);
          return { ...e, status: bad ? 'error' : 'ready', error: bad ? mine[0].error : undefined, fonts: mine };
        }),
      );
    } catch (err) {
      setEntries((all) => all.map((e) => (batch.some((b) => b.id === e.id) ? { ...e, status: 'error', error: (err as Error).message } : e)));
    }
  }

  function add(list: File[]) {
    setError(null);
    setResult(null);
    const ok = list.filter((f) => /\.(ttf|otf|woff2?|zip)$/i.test(f.name) && f.size <= limits.maxFileBytes);
    const rejected = list.filter((f) => !/\.(ttf|otf|woff2?|zip)$/i.test(f.name));
    const tooBig = list.filter((f) => /\.(ttf|otf|woff2?|zip)$/i.test(f.name) && f.size > limits.maxFileBytes);
    setNotes([
      ...(rejected.length ? [`Skipped ${rejected.map((f) => f.name).join(', ')}: only TTF, OTF, WOFF, WOFF2 and ZIP files work. EOT and SVG fonts aren't needed any more.`] : []),
      ...(tooBig.length ? [`Skipped ${tooBig.map((f) => f.name).join(', ')}: larger than ${limits.maxFileBytes / 1024 / 1024} MB.`] : []),
    ]);
    const fresh = ok
      .filter((f) => !entries.some((e) => e.file.name === f.name && e.file.size === f.size))
      .slice(0, Math.max(0, limits.maxFiles - entries.length))
      .map((file) => ({ id: crypto.randomUUID(), file, status: 'reading' as const, fonts: [] }));
    if (entries.length + ok.length > limits.maxFiles) setError(`Convert up to ${limits.maxFiles} files at a time.`);
    if (!fresh.length) return;
    setEntries((all) => [...all, ...fresh]);
    inspect(fresh);
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
      axes: toAxesOption(axisSettings),
      pathPrefix,
      display,
      fallback,
      demo,
    };
    const usable = entries.filter((e) => e.status === 'ready');
    try {
      let res: Response;
      if (mode === 'blob') {
        setPhase('uploading');
        const uploaded = await Promise.all(usable.map(async (e) => ({ url: e.url ?? (await uploadToBlob(e.file)), filename: e.file.name })));
        setPhase('converting');
        res = await fetch('/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: uploaded, options, licenceConfirmed: licence }) });
        // The server deletes uploads after converting; upload again next time.
        setEntries((all) => all.map((e) => ({ ...e, url: undefined })));
      } else {
        setPhase('converting');
        const form = new FormData();
        usable.forEach((e) => form.append('files', e.file));
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
  const ready =
    okFonts.length > 0 && !reading && formats.length > 0 && licence && !(characters === 'custom' && !customText.trim()) && !(variable === 'static' && variableFonts.length > 0 && !staticWeights.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-4">
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
          className={cx('flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-colors', entries.length ? 'py-6' : 'py-12', drag ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface')}
        >
          <div className="text-lg font-semibold text-ink">{entries.length ? 'Drop more fonts' : 'Drop your fonts here'}</div>
          <p className="mt-1 max-w-md text-sm text-muted">
            TTF, OTF, WOFF, WOFF2 or a ZIP. Up to {limits.maxFiles} files, {limits.maxFileBytes / 1024 / 1024} MB each. Files are deleted as soon as your kit is ready.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => input.current?.click()}>
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

        {entries.length > 0 && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold">
                {entries.length} file{entries.length === 1 ? '' : 's'} · {formatBytes(total)}
                {okFonts.length > 0 && (
                  <span className="ml-2 font-normal text-muted">
                    {variableFonts.length} variable · {okFonts.length - variableFonts.length} static
                  </span>
                )}
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setEntries([])}>
                Clear
              </Button>
            </div>
            <ul className="divide-y divide-line">
              {entries.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink" title={e.file.name}>
                        {e.file.name}
                      </div>
                      <div className="text-xs text-muted">{formatBytes(e.file.size)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {e.status === 'reading' && (
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <Spinner className="size-3.5" /> Reading…
                        </span>
                      )}
                      <button type="button" className="text-xs font-medium text-muted hover:text-ink" onClick={() => setEntries((l) => l.filter((x) => x.id !== e.id))} aria-label={`Remove ${e.file.name}`}>
                        Remove
                      </button>
                    </div>
                  </div>
                  {e.status === 'error' && <div className="mt-1 text-xs text-bad">{e.error}</div>}
                  {e.fonts.map((f) => (
                    <div key={f.file} className="mt-2 flex flex-wrap items-center gap-1.5">
                      {f.fromZip && <span className="text-xs text-muted">{f.file}:</span>}
                      {f.ok ? (
                        <>
                          <span className="text-sm text-ink">
                            {f.family} <span className="text-muted">{f.subfamily}</span>
                          </span>
                          {f.isVariable ? <Badge tone="accent">Variable</Badge> : <Badge>Static · {f.weight}</Badge>}
                          {f.style === 'italic' && <Badge>Italic</Badge>}
                          <Badge>{f.format?.toUpperCase()}</Badge>
                          {f.axes?.map((a) => (
                            <Badge key={a.tag} tone="accent" className="font-normal">
                              {axisLabel(a)} {a.min}–{a.max}
                            </Badge>
                          ))}
                          {f.isVariable && f.namedInstances && f.namedInstances.length > 0 && <span className="text-xs text-muted">{f.namedInstances.length} named instances</span>}
                        </>
                      ) : (
                        <span className="text-xs text-bad">{f.error}</span>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {entries.some((e) => e.status === 'ready' && /\.(ttf|otf|woff2?)$/i.test(e.file.name)) && (
          <Preview entries={entries.filter((e) => e.status === 'ready' && /\.(ttf|otf|woff2?)$/i.test(e.file.name))} settings={axisSettings} variable={variable} staticWeights={staticWeights} />
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
          <legend className="mb-1 text-sm font-semibold text-ink">Variable fonts</legend>
          {variableFonts.length === 0 ? (
            <p className="text-xs text-muted">{okFonts.length ? 'None of your fonts are variable.' : 'Axis settings appear here when you add a variable font.'}</p>
          ) : (
            <div className="space-y-3">
              <Select aria-label="Variable fonts" value={variable} onChange={(e) => setVariable(e.target.value as 'variable')}>
                <option value="variable">Keep as variable</option>
                <option value="static">Export static weights</option>
              </Select>
              {variable === 'static' && (
                <div className="grid grid-cols-3 gap-2">
                  {WEIGHTS.map((w) => (
                    <Checkbox key={w} label={String(w)} checked={staticWeights.includes(w)} onChange={(v) => setStaticWeights((s) => toggle(s, w, v).sort((a, b) => a - b))} />
                  ))}
                </div>
              )}
              <p className="text-xs text-muted">{variable === 'static' ? 'Values for the other axes in every static file:' : 'Limit or pin axes you don’t need to make files smaller:'}</p>
              <AxisControls axes={axes} value={axisSettings} onChange={setAxisSettings} staticMode={variable === 'static'} />
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

/* ------------------------------------------------------------------ */
/* Live preview: fonts load straight from the dropped files            */
/* ------------------------------------------------------------------ */

function Preview({ entries, settings, variable, staticWeights }: { entries: Entry[]; settings: Record<string, AxisSetting>; variable: 'variable' | 'static'; staticWeights: number[] }) {
  const fonts = entries.flatMap((e) => e.fonts.filter((f) => f.ok).map((f) => ({ entry: e, font: f })));
  const [selected, setSelected] = useState(0);
  const pick = fonts[Math.min(selected, fonts.length - 1)];
  const [loaded, setLoaded] = useState<string | null>(null);
  const [text, setText] = useState(PANGRAM);
  const [size, setSize] = useState(56);
  const [values, setValues] = useState<Record<string, number>>({});
  const [dark, setDark] = useState(false);
  const alias = pick ? `th-preview-${pick.entry.id.slice(0, 8)}` : '';

  // Load the chosen file into the page with the FontFace API (nothing is uploaded for this).
  useEffect(() => {
    if (!pick) return;
    let cancelled = false;
    pick.entry.file.arrayBuffer().then(async (buf) => {
      try {
        const face = new FontFace(alias, buf);
        await face.load();
        if (cancelled) return;
        document.fonts.add(face);
        setLoaded(alias);
      } catch {
        setLoaded(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pick?.entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const axes = pick?.font.axes?.filter((a) => a.tag !== 'ital') ?? [];
  // What the downloaded font will allow for each axis.
  const allowed = (a: AxisInfo): [number, number] => {
    if (variable === 'static' && a.tag === 'wght') return staticWeights.length ? [Math.min(...staticWeights), Math.max(...staticWeights)] : [a.default, a.default];
    const s = settings[a.tag];
    if (!s || s.mode === 'keep') return variable === 'static' ? [a.default, a.default] : [a.min, a.max];
    if (s.mode === 'pin') return [s.value, s.value];
    return [Math.max(a.min, Math.min(s.min, s.max)), Math.min(a.max, Math.max(s.min, s.max))];
  };
  const valueOf = (a: AxisInfo) => {
    const [lo, hi] = allowed(a);
    const v = values[a.tag] ?? (a.tag === 'wght' ? 400 : a.default);
    if (variable === 'static' && a.tag === 'wght') return staticWeights.reduce((best, w) => (Math.abs(w - v) < Math.abs(best - v) ? w : best), staticWeights[0] ?? 400);
    return Math.min(hi, Math.max(lo, v));
  };
  const settingsCss = axes.map((a) => `'${a.tag}' ${+valueOf(a).toFixed(2)}`).join(', ');

  if (!pick) return null;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Preview</h2>
          <p className="text-xs text-muted">{axes.length ? 'Sliders stop where your axis settings cut the font, so you see exactly what the download can do.' : 'Loaded straight from your file.'}</p>
        </div>
        {fonts.length > 1 && (
          <Select aria-label="Font to preview" value={Math.min(selected, fonts.length - 1)} onChange={(e) => setSelected(Number(e.target.value))} className="h-8 w-auto max-w-[260px]">
            {fonts.map((f, i) => (
              <option key={`${f.entry.id}${f.font.file}`} value={i}>
                {f.font.family} {f.font.subfamily}
                {f.font.isVariable ? ' (variable)' : ''}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className={cx('px-5 py-6 transition-colors', dark ? 'bg-[#101216] text-white' : 'text-ink')}>
        <label htmlFor="preview-text" className="sr-only">
          Preview text
        </label>
        <textarea
          id="preview-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="w-full resize-y border-0 bg-transparent p-0 leading-tight outline-none focus:ring-0"
          style={{
            fontFamily: loaded ? `'${loaded}', system-ui` : 'system-ui',
            fontSize: size,
            fontStyle: pick.font.style,
            fontVariationSettings: axes.length ? settingsCss : undefined,
            fontWeight: axes.length ? undefined : pick.font.weight,
          }}
        />
        {!loaded && <p className="mt-2 text-xs text-muted">Your browser could not load this file for preview; conversion still works.</p>}
      </div>
      <div className="grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-2">
        <Slider label="Size" min={10} max={160} step={1} value={size} onChange={setSize} suffix="px" />
        {axes.map((a) => {
          const [lo, hi] = allowed(a);
          const locked = lo === hi;
          return (
            <Slider
              key={a.tag}
              label={`${axisLabel(a)} (${a.tag})`}
              min={a.min}
              max={a.max}
              step={a.max - a.min > 20 ? 1 : 0.1}
              value={valueOf(a)}
              onChange={(v) => setValues((x) => ({ ...x, [a.tag]: v }))}
              range={[lo, hi]}
              note={locked ? (variable === 'static' && a.tag === 'wght' ? 'snaps to your static weights' : `pinned at ${lo}`) : lo !== a.min || hi !== a.max ? `kept ${lo}–${hi}` : undefined}
            />
          );
        })}
        <div className="flex items-end gap-4 sm:col-span-2">
          <Checkbox label="Dark background" checked={dark} onChange={setDark} />
          {axes.length > 0 && <code className="truncate text-xs text-muted">font-variation-settings: {settingsCss};</code>}
        </div>
      </div>
    </Card>
  );
}

function Slider({ label, min, max, step, value, onChange, suffix, range, note }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; suffix?: string; range?: [number, number]; note?: string }) {
  const id = `pv-${label.replace(/\W/g, '')}`;
  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <label htmlFor={id} className="font-medium text-ink-2">
          {label}
        </label>
        <span className="text-muted tabular-nums">
          {+value.toFixed(2)}
          {suffix}
          {note && <span className="ml-1 text-accent">· {note}</span>}
        </span>
      </div>
      <div className="relative mt-1">
        {range && (range[0] !== min || range[1] !== max) && (
          <div className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/25" style={{ left: `${pct(range[0])}%`, width: `${Math.max(1, pct(range[1]) - pct(range[0]))}%` }} aria-hidden />
        )}
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="relative w-full accent-[var(--color-accent)]" />
      </div>
    </div>
  );
}
