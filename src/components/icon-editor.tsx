'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { className as iconClass, emptyConfig, hex, MAX_GLYPHS, nextCode, randomUid, toFontelloConfig, uniqueName, validateConfig, type IconFontConfig, type IconGlyph } from '@/lib/icons/config';
import { Alert, Badge, Button, Card, Checkbox, CodeBlock, cx, formatBytes, Input, Select, Spinner, Tabs, timeAgo, useToast } from './ui';

interface SetInfo {
  id: string;
  name: string;
  author: string | null;
  homepage: string | null;
  license: string | null;
  licenseUrl: string | null;
  source: 'fontello' | 'mdi' | 'bootstrap';
  count: number;
}
interface Result {
  uid: string;
  set: string;
  css: string;
  width: number;
  d: string;
}
interface Published {
  hash: string;
  glyphs: number;
  bytes: number;
  publishedAt: string;
}

export type IconEditorProps =
  | { mode: 'public' }
  | {
      mode: 'workspace';
      ws: string;
      id: string;
      initial: IconFontConfig;
      published: Published | null;
      cssUrl: string;
      canEdit: boolean;
      canPublish: boolean;
    };

const STORAGE_KEY = 'th-icon-font-v1';
const PAGE = 120;

function Glyph({ d, width, className }: { d?: string; width?: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${width ?? 1000} 1000`} className={cx('fill-current', className)} aria-hidden>
      {d && <path d={d} />}
    </svg>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function errorMessage(res: Response) {
  const data = await res.json().catch(() => null);
  return data?.error?.message ?? `Request failed (${res.status})`;
}

export function IconEditor(props: IconEditorProps) {
  const toast = useToast();
  const readOnly = props.mode === 'workspace' && !props.canEdit;
  const [config, setConfig] = useState<IconFontConfig>(() => (props.mode === 'workspace' ? props.initial : emptyConfig()));
  const [dirty, setDirty] = useState(false);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [tab, setTab] = useState<'browse' | 'upload'>('browse');
  const [q, setQ] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'build' | 'save' | 'publish' | 'import' | 'upload'>(null);
  const [uploadReport, setUploadReport] = useState<{ file: string; message: string; tone: 'warn' | 'bad' }[]>([]);
  const [published, setPublished] = useState<Published | null>(props.mode === 'workspace' ? props.published : null);
  const [drag, setDrag] = useState(false);
  const svgInput = useRef<HTMLInputElement>(null);
  const configInput = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  /* Load and remember (public mode keeps the font in this browser) ------ */
  useEffect(() => {
    if (props.mode !== 'public') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig({ ...emptyConfig(), ...JSON.parse(raw) });
    } catch {}
    restored.current = true;
  }, [props.mode]);
  useEffect(() => {
    if (props.mode !== 'public' || !restored.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }, [config, props.mode]);
  useEffect(() => {
    if (props.mode !== 'workspace' || !dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, props.mode]);

  useEffect(() => {
    fetch('/api/icons/sets')
      .then((r) => r.json())
      .then((d) => setSets(d.sets ?? []))
      .catch(() => {});
  }, []);

  /* Search --------------------------------------------------------------- */
  const search = useCallback(async (query: string, set: string, offset: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, offset: String(offset), limit: String(PAGE) });
      if (set) params.set('set', set);
      const res = await fetch(`/api/icons/search?${params}`);
      const data = await res.json();
      setTotal(data.total ?? 0);
      setResults((r) => (offset ? [...r, ...(data.glyphs ?? [])] : (data.glyphs ?? [])));
    } catch {
      toast('Could not load icons. Check your connection.', 'bad');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    const t = setTimeout(() => search(q, setFilter, 0), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, setFilter, search]);

  /* Editing -------------------------------------------------------------- */
  const update = (fn: (c: IconFontConfig) => IconFontConfig) => {
    if (readOnly) return;
    setConfig(fn);
    setDirty(true);
  };
  const selected = useMemo(() => new Set(config.glyphs.map((g) => g.uid)), [config.glyphs]);

  const addGlyphs = (items: Omit<IconGlyph, 'code' | 'css'>[], names: string[]) =>
    update((c) => {
      const glyphs = [...c.glyphs];
      const usedNames = glyphs.map((g) => g.css);
      const usedCodes = glyphs.map((g) => g.code);
      items.forEach((item, i) => {
        if (glyphs.length >= MAX_GLYPHS || glyphs.some((g) => g.uid === item.uid)) return;
        const css = uniqueName(names[i], usedNames);
        const code = nextCode(usedCodes);
        usedNames.push(css);
        usedCodes.push(code);
        glyphs.push({ ...item, css, code });
      });
      return { ...c, glyphs };
    });

  const toggle = (r: Result) => {
    if (selected.has(r.uid)) update((c) => ({ ...c, glyphs: c.glyphs.filter((g) => g.uid !== r.uid) }));
    else addGlyphs([{ uid: r.uid, src: r.set, d: r.d, width: r.width }], [r.css]);
  };
  const setGlyph = (uid: string, patch: Partial<IconGlyph>) => update((c) => ({ ...c, glyphs: c.glyphs.map((g) => (g.uid === uid ? { ...g, ...patch } : g)) }));
  const removeGlyph = (uid: string) => update((c) => ({ ...c, glyphs: c.glyphs.filter((g) => g.uid !== uid) }));

  /* SVG upload (converted in the browser) --------------------------------- */
  const onSvgs = async (files: File[]) => {
    const svgs = files.filter((f) => /\.svg$/i.test(f.name) || f.type === 'image/svg+xml');
    if (!svgs.length) return toast('Choose SVG files.', 'warn');
    setBusy('upload');
    const report: typeof uploadReport = [];
    const items: Omit<IconGlyph, 'code' | 'css'>[] = [];
    const names: string[] = [];
    try {
      const { svgToGlyph, iconName, SvgError } = await import('@/lib/icons/svg-to-glyph');
      for (const f of svgs) {
        if (f.size > 1_000_000) {
          report.push({ file: f.name, message: 'Larger than 1 MB, skipped.', tone: 'bad' });
          continue;
        }
        try {
          const g = svgToGlyph(await f.text());
          items.push({ uid: randomUid(), src: 'custom', d: g.d, width: g.width });
          names.push(iconName(f.name));
          for (const w of g.warnings) report.push({ file: f.name, message: w, tone: 'warn' });
        } catch (e) {
          report.push({ file: f.name, message: e instanceof SvgError ? e.message : 'Could not read this SVG.', tone: 'bad' });
        }
      }
      if (items.length) {
        addGlyphs(items, names);
        toast(`Added ${items.length} icon${items.length === 1 ? '' : 's'}.`);
      }
    } finally {
      setUploadReport(report);
      setBusy(null);
    }
  };

  /* Import config.json / ZIP --------------------------------------------- */
  const onImport = async (file: File) => {
    setBusy('import');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/icons/import', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await errorMessage(res));
      const data: { config: IconFontConfig; skipped: { css: string; reason: string }[] } = await res.json();
      if (config.glyphs.length && !confirm(`Replace the ${config.glyphs.length} icons in your font with the ${data.config.glyphs.length} from ${file.name}?`)) return;
      update(() => data.config);
      toast(`Opened ${data.config.glyphs.length} icons from ${file.name}.${data.skipped.length ? ` ${data.skipped.length} could not be used.` : ''}`, data.skipped.length ? 'warn' : 'good');
      setUploadReport(data.skipped.map((s) => ({ file: s.css, message: s.reason, tone: 'warn' })));
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(null);
    }
  };

  /* Build / export -------------------------------------------------------- */
  const fontelloSets = useMemo(() => new Set(sets.filter((s) => s.source === 'fontello').map((s) => s.id)), [sets]);
  const errors = useMemo(() => validateConfig(config), [config]);
  // Bundled icons are looked up on the server by uid, so only uploaded outlines are sent.
  const buildBody = () => ({ ...config, glyphs: config.glyphs.map((g) => (g.src === 'custom' ? g : { ...g, d: undefined, width: undefined })) });

  const buildZip = async () => {
    setBusy('build');
    try {
      const res =
        props.mode === 'workspace' && !dirty
          ? await fetch(`/api/v1/icon-fonts/${props.id}/kit`, { headers: { 'X-Workspace': props.ws } })
          : await fetch('/api/icons/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody()) });
      if (!res.ok) throw new Error(await errorMessage(res));
      download(await res.blob(), `${config.name}-icons.zip`);
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(null);
    }
  };
  const exportConfig = () => {
    const json = JSON.stringify(toFontelloConfig(config, (src) => fontelloSets.has(src)), null, 2);
    download(new Blob([json + '\n'], { type: 'application/json' }), 'config.json');
  };

  const save = async () => {
    if (props.mode !== 'workspace') return;
    setBusy('save');
    try {
      await api(props.ws, `/api/v1/icon-fonts/${props.id}`, { method: 'PUT', body: config });
      setDirty(false);
      toast('Saved.');
      return true;
    } catch (e) {
      toast((e as Error).message, 'bad');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const publish = async () => {
    if (props.mode !== 'workspace') return;
    if (dirty && !(await save())) return;
    setBusy('publish');
    try {
      const res = await api<{ published: Published }>(props.ws, `/api/v1/icon-fonts/${props.id}/publish`, { method: 'POST' });
      setPublished(res.published);
      toast('Published. The stylesheet is live.');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(null);
    }
  };

  const setsById = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);
  const usedSets = useMemo(() => [...new Set(config.glyphs.map((g) => g.src))].map((id) => setsById.get(id)).filter(Boolean) as SetInfo[], [config.glyphs, setsById]);
  const activeSet = setFilter ? setsById.get(setFilter) : null;
  const first = config.glyphs[0];
  const cssLink = props.mode === 'workspace' ? props.cssUrl : `css/${config.name}.css`;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Icon picker ---------------------------------------------------- */}
      <Card className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2">
          <Tabs
            tabs={[
              { id: 'browse', label: 'Icon sets' },
              { id: 'upload', label: 'Upload SVG' },
            ]}
            value={tab}
            onChange={setTab}
            className="border-b-0"
          />
          {!readOnly && (
            <>
              <Button size="sm" variant="ghost" loading={busy === 'import'} onClick={() => configInput.current?.click()}>
                Open config.json or ZIP
              </Button>
              <input
                ref={configInput}
                type="file"
                accept=".json,.zip,application/json,application/zip"
                className="hidden"
                aria-label="Open a Fontello config.json or ZIP"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImport(f);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>
        <div className="border-t border-line p-4">
          {tab === 'browse' ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 11,000+ icons: home, arrow, user…" aria-label="Search icons" className="sm:flex-1" />
                <Select value={setFilter} onChange={(e) => setSetFilter(e.target.value)} aria-label="Icon set" className="sm:w-64">
                  <option value="">All sets</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.count.toLocaleString()})
                    </option>
                  ))}
                </Select>
              </div>
              {activeSet && (
                <p className="mt-2 text-xs text-muted">
                  {activeSet.author && <>By {activeSet.author} · </>}
                  Licence: {activeSet.licenseUrl ? <a className="underline" href={activeSet.licenseUrl} target="_blank" rel="noreferrer">{activeSet.license}</a> : (activeSet.license ?? 'see homepage')}
                  {activeSet.homepage && (
                    <>
                      {' · '}
                      <a className="underline" href={activeSet.homepage} target="_blank" rel="noreferrer">
                        Homepage
                      </a>
                    </>
                  )}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span aria-live="polite">{loading && !results.length ? 'Loading…' : `${total.toLocaleString()} icon${total === 1 ? '' : 's'}${q ? ` for “${q}”` : ''}`}</span>
                {!readOnly && <span>Click to add or remove</span>}
              </div>
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5" data-testid="icon-results">
                {results.map((r) => {
                  const on = selected.has(r.uid);
                  return (
                    <button
                      key={r.uid}
                      type="button"
                      title={`${r.css} · ${setsById.get(r.set)?.name ?? r.set}`}
                      aria-label={`${r.css} (${setsById.get(r.set)?.name ?? r.set})`}
                      aria-pressed={on}
                      disabled={readOnly}
                      onClick={() => toggle(r)}
                      className={cx(
                        'group relative flex flex-col items-center gap-1.5 rounded-lg border px-1 pt-3 pb-1.5 text-ink transition-colors',
                        on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-transparent hover:border-line-strong hover:bg-canvas',
                      )}
                    >
                      <Glyph d={r.d} width={r.width} className="h-7 max-w-full" />
                      <span className="w-full truncate text-center text-[10.5px] text-muted">{r.css}</span>
                      {on && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] text-white" aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
              {results.length < total && (
                <div className="mt-4 text-center">
                  <Button size="sm" loading={loading} onClick={() => search(q, setFilter, results.length)}>
                    Show more
                  </Button>
                </div>
              )}
              {!loading && !results.length && <p className="py-10 text-center text-sm text-muted">No icons match. Try another word, or upload your own SVG.</p>}
            </>
          ) : (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  if (!readOnly) void onSvgs([...e.dataTransfer.files]);
                }}
                className={cx('flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center', drag ? 'border-accent bg-accent-soft' : 'border-line-strong')}
              >
                <p className="font-medium text-ink">Drop SVG icons here</p>
                <p className="mt-1 max-w-md text-sm text-muted">Each file becomes one icon, named after the file. Icons are scaled to the font’s height using their viewBox.</p>
                <Button className="mt-4" loading={busy === 'upload'} disabled={readOnly} onClick={() => svgInput.current?.click()}>
                  Choose SVG files
                </Button>
                <input
                  ref={svgInput}
                  type="file"
                  multiple
                  accept=".svg,image/svg+xml"
                  className="hidden"
                  aria-label="Choose SVG files"
                  onChange={(e) => {
                    void onSvgs([...(e.target.files ?? [])]);
                    e.target.value = '';
                  }}
                />
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-muted">
                <li>• Fonts hold only filled shapes in one colour. Convert strokes to outlines first (Figma: <em>Outline stroke</em>; Illustrator: <em>Object → Path → Outline Stroke</em>).</li>
                <li>• Even-odd holes are converted automatically. Gradients, images, text and colours are ignored.</li>
                <li>• Draw icons on a square canvas (for example 24 × 24) so they line up with each other.</li>
              </ul>
            </div>
          )}
          {uploadReport.length > 0 && (
            <div className="mt-4">
              <Alert tone={uploadReport.some((r) => r.tone === 'bad') ? 'bad' : 'warn'} title="Some icons need attention">
                <ul className="mt-1 space-y-0.5">
                  {uploadReport.map((r, i) => (
                    <li key={i}>
                      <strong>{r.file}</strong>: {r.message}
                    </li>
                  ))}
                </ul>
                <button type="button" className="mt-2 text-xs underline" onClick={() => setUploadReport([])}>
                  Dismiss
                </button>
              </Alert>
            </div>
          )}
        </div>
      </Card>

      {/* Your font ------------------------------------------------------- */}
      <div className="min-w-0 space-y-4 lg:sticky lg:top-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">Your font</h2>
            <Badge tone={config.glyphs.length ? 'accent' : 'neutral'}>
              {config.glyphs.length} icon{config.glyphs.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-[13px] font-medium text-ink-2">
              Font name
              <Input className="mt-1" value={config.name} disabled={readOnly} onChange={(e) => update((c) => ({ ...c, name: e.target.value.replace(/[^a-z0-9-]/gi, '').slice(0, 40) }))} />
            </label>
            <label className="block text-[13px] font-medium text-ink-2">
              {config.suffix ? 'Class suffix' : 'Class prefix'}
              <Input className="mt-1" value={config.prefix} disabled={readOnly} onChange={(e) => update((c) => ({ ...c, prefix: e.target.value.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) }))} />
            </label>
          </div>
          <div className="mt-3">
            <Checkbox
              label="Use a suffix"
              description={`Classes like “home${config.suffix ? config.prefix : '-icon'}” instead of “${config.suffix ? 'icon-' : config.prefix}home”.`}
              checked={config.suffix}
              disabled={readOnly}
              onChange={(v) => update((c) => ({ ...c, suffix: v, prefix: v ? (c.prefix === 'icon-' ? '-icon' : c.prefix) : c.prefix === '-icon' ? 'icon-' : c.prefix }))}
            />
          </div>

          {config.glyphs.length > 0 ? (
            <ul className="mt-4 max-h-[380px] divide-y divide-line overflow-y-auto rounded-lg border border-line scrollbar-thin" aria-label="Icons in your font">
              {config.glyphs.map((g) => (
                <GlyphRow key={g.uid} glyph={g} readOnly={readOnly} setName={setsById.get(g.src)?.name ?? (g.src === 'custom' ? 'Uploaded' : g.src)} onChange={(p) => setGlyph(g.uid, p)} onRemove={() => removeGlyph(g.uid)} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">Pick icons from the sets or upload your own SVGs.</p>
          )}

          {errors.length > 0 && config.glyphs.length > 0 && (
            <div className="mt-3">
              <Alert tone="bad">{errors.slice(0, 3).join(' ')}</Alert>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {props.mode === 'workspace' ? (
              <>
                {props.canEdit && (
                  <Button variant={props.canPublish ? 'secondary' : 'primary'} loading={busy === 'save'} disabled={!dirty || !!busy} onClick={save}>
                    {dirty ? 'Save' : 'Saved'}
                  </Button>
                )}
                {props.canPublish && (
                  <Button variant="primary" loading={busy === 'publish'} disabled={!!busy || errors.length > 0} onClick={publish}>
                    Publish
                  </Button>
                )}
                <Button loading={busy === 'build'} disabled={!!busy || errors.length > 0} onClick={buildZip}>
                  Download ZIP
                </Button>
              </>
            ) : (
              <Button variant="primary" loading={busy === 'build'} disabled={!!busy || errors.length > 0} onClick={buildZip}>
                Download font
              </Button>
            )}
            <Button variant="ghost" disabled={!config.glyphs.length} onClick={exportConfig}>
              config.json
            </Button>
            {!readOnly && config.glyphs.length > 0 && (
              <Button variant="ghost" onClick={() => confirm('Remove every icon from the font?') && update((c) => ({ ...c, glyphs: [] }))}>
                Clear
              </Button>
            )}
          </div>
          {props.mode === 'public' && <p className="mt-2 text-xs text-muted">Your selection is kept in this browser. The ZIP has WOFF2, WOFF and TTF files, CSS, a demo page and a config.json you can open again later.</p>}
        </Card>

        {props.mode === 'workspace' && (
          <Card className="p-4">
            <h2 className="font-semibold text-ink">Delivery</h2>
            {published ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  Published {timeAgo(new Date(published.publishedAt))} · {published.glyphs} icons · {formatBytes(published.bytes)} WOFF2
                  {dirty && ' · unsaved changes'}
                </p>
                <CodeBlock className="mt-3" label="HTML" code={`<link rel="stylesheet" href="${props.cssUrl}">\n\n<i class="${first ? iconClass(config, first.css) : `${config.prefix}name`}" aria-hidden="true"></i>`} />
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">Not published yet. {props.canPublish ? 'Publish to get a stylesheet link for your sites.' : 'Ask a Publisher to publish it.'}</p>
            )}
          </Card>
        )}

        {props.mode === 'public' && first && (
          <Card className="p-4">
            <h2 className="font-semibold text-ink">Use it</h2>
            <CodeBlock className="mt-3" label="HTML" code={`<link rel="stylesheet" href="${cssLink}">\n\n<i class="${iconClass(config, first.css)}" aria-hidden="true"></i>`} />
          </Card>
        )}

        {usedSets.length > 0 && (
          <p className="px-1 text-xs text-muted">
            Licences: {usedSets.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                {s.name} ({s.license ?? 'see homepage'})
              </span>
            ))}
            . The kit’s LICENSE.txt lists them in full; some require attribution.
          </p>
        )}
        {busy === 'build' && (
          <p className="flex items-center gap-2 px-1 text-xs text-muted">
            <Spinner className="size-3" /> Building the font…
          </p>
        )}
      </div>
    </div>
  );
}

function GlyphRow({ glyph, setName, readOnly, onChange, onRemove }: { glyph: IconGlyph; setName: string; readOnly: boolean; onChange: (p: Partial<IconGlyph>) => void; onRemove: () => void }) {
  const [code, setCode] = useState(hex(glyph.code));
  useEffect(() => setCode(hex(glyph.code)), [glyph.code]);
  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-canvas text-ink" title={setName}>
        <Glyph d={glyph.d} width={glyph.width} className="h-5 max-w-6" />
      </span>
      <input
        aria-label="Icon name"
        value={glyph.css}
        disabled={readOnly}
        onChange={(e) => onChange({ css: e.target.value.replace(/[^a-z0-9_-]/gi, '').slice(0, 64) })}
        className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 font-mono text-[12.5px] text-ink hover:border-line focus:border-accent focus:outline-none"
      />
      <span className="text-[11px] text-muted" aria-hidden>
        U+
      </span>
      <input
        aria-label="Code point (hex)"
        value={code}
        disabled={readOnly}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6))}
        onBlur={() => {
          const n = parseInt(code, 16);
          if (Number.isFinite(n) && n >= 0x20 && n <= 0x10ffff) onChange({ code: n });
          else setCode(hex(glyph.code));
        }}
        className="h-7 w-16 rounded-md border border-transparent bg-transparent px-1 font-mono text-[12px] text-ink-2 uppercase hover:border-line focus:border-accent focus:outline-none"
      />
      {!readOnly && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${glyph.css}`} className="grid size-7 place-items-center rounded-md text-muted hover:bg-bad-soft hover:text-bad">
          ×
        </button>
      )}
    </li>
  );
}
