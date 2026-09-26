'use client';

import { useState } from 'react';
import { Alert, Button, Card, CardHeader, Checkbox, cx, Input, Select } from '../ui';
import type { FamilyViewData, VersionData } from './shared';

type Characters = 'full' | 'split' | 'latin' | 'latin-ext' | 'custom';

const CHARACTER_OPTIONS: [Characters, string, string][] = [
  ['latin-ext', 'Latin + Latin Extended', 'Western and Central European languages. Good default.'],
  ['latin', 'Basic Latin only', 'English and most Western European text. Smallest files.'],
  ['split', 'Split by script', 'One file per script with unicode-range, so browsers load only what a page uses.'],
  ['full', 'Full font', 'Every character the font has, in one file per format.'],
  ['custom', 'Only these characters', 'For logos and headlines.'],
];

export function DownloadKit({ data, version }: { data: FamilyViewData; version: VersionData }) {
  const { family, ws } = data;
  const external = !version.faces.some((f) => f.files.length);
  const variableFaces = version.faces.filter((f) => f.axes.length);
  const wMin = Math.min(...version.faces.map((f) => f.weightMin));
  const wMax = Math.max(...version.faces.map((f) => f.weightMax));
  const weightChoices = [100, 200, 300, 400, 500, 600, 700, 800, 900].filter((w) => w >= wMin && w <= wMax);

  const [formats, setFormats] = useState<string[]>(['woff2', 'woff']);
  const [faceIds, setFaceIds] = useState<string[]>(version.faces.map((f) => f.id));
  const [characters, setCharacters] = useState<Characters>('latin-ext');
  const [customText, setCustomText] = useState('');
  const [variable, setVariable] = useState<'variable' | 'static'>('variable');
  const [staticWeights, setStaticWeights] = useState<number[]>(weightChoices.filter((w) => w === 400 || w === 700));
  const [pathPrefix, setPathPrefix] = useState('../fonts/');
  const [display, setDisplay] = useState(family.display);
  const [fallback, setFallback] = useState(true);
  const [demo, setDemo] = useState(true);
  const [tokens, setTokens] = useState(data.usage.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/families/${family.id}/kit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace': ws },
        body: JSON.stringify({
          versionId: version.id,
          formats,
          faceIds,
          characters,
          customText: characters === 'custom' ? customText : undefined,
          variable,
          staticWeights: variable === 'static' ? staticWeights : undefined,
          pathPrefix,
          display,
          fallback,
          unicodeRange: true,
          demo,
          tokens,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `${family.slug}-webfont-kit.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (external) {
    return (
      <Card id="kit">
        <CardHeader title="Download kit" description="Font files and CSS to use in any project, without the CSS API." />
        <div className="px-5 py-4 text-sm text-muted">This family is delivered by an external provider, so there are no files to download. Import it as internal to get a kit.</div>
      </Card>
    );
  }

  const count = (variable === 'static' && variableFaces.length ? faceIds.reduce((n, id) => n + (variableFaces.some((f) => f.id === id) ? staticWeights.length : 1), 0) : faceIds.length) * formats.length;

  return (
    <Card id="kit">
      <CardHeader
        title="Download kit"
        description={`Font files, a ready-made stylesheet and a demo page for v${version.number}. Copy them into any project and use them like normal files, without the CSS API.`}
      />
      <div className="grid gap-6 px-5 py-4 lg:grid-cols-2">
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-2">Formats</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Checkbox label="WOFF2" description="All modern browsers" checked={formats.includes('woff2')} onChange={(v) => setFormats((f) => toggle(f, 'woff2', v))} />
              <Checkbox label="WOFF" description="Older browsers" checked={formats.includes('woff')} onChange={(v) => setFormats((f) => toggle(f, 'woff', v))} />
              <Checkbox label="TTF / OTF" description="Desktop apps, email, native" checked={formats.includes('sfnt')} onChange={(v) => setFormats((f) => toggle(f, 'sfnt', v))} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-2">Faces</legend>
            <div className="grid grid-cols-2 gap-2">
              {version.faces.map((f) => (
                <Checkbox key={f.id} label={f.name} checked={faceIds.includes(f.id)} onChange={(v) => setFaceIds((ids) => toggle(ids, f.id, v))} />
              ))}
            </div>
          </fieldset>

          {variableFaces.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">Variable font</legend>
              <div className="space-y-2">
                {(
                  [
                    ['variable', 'Keep as variable', 'One file per style covering every weight.'],
                    ['static', 'Export static weights', 'Separate files per weight, for tools without variable font support.'],
                  ] as const
                ).map(([v, l, d]) => (
                  <label key={v} className={cx('flex cursor-pointer gap-2.5 rounded-lg border p-3', variable === v ? 'border-accent bg-accent-soft/60' : 'border-line')}>
                    <input type="radio" name="kit-variable" checked={variable === v} onChange={() => setVariable(v)} className="mt-0.5 accent-[var(--color-accent)]" />
                    <span>
                      <span className="block text-sm font-medium text-ink">{l}</span>
                      <span className="block text-xs text-muted">{d}</span>
                    </span>
                  </label>
                ))}
                {variable === 'static' && (
                  <div className="grid grid-cols-5 gap-2 pt-1 pl-1">
                    {weightChoices.map((w) => (
                      <Checkbox key={w} label={String(w)} checked={staticWeights.includes(w)} onChange={(v) => setStaticWeights((s) => toggle(s, w, v).sort((a, b) => a - b))} />
                    ))}
                  </div>
                )}
              </div>
            </fieldset>
          )}
        </div>

        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-2">Characters</legend>
            <div className="space-y-1.5">
              {CHARACTER_OPTIONS.map(([v, l, d]) => (
                <label key={v} className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="radio" name="kit-chars" checked={characters === v} onChange={() => setCharacters(v)} className="mt-1 accent-[var(--color-accent)]" />
                  <span>
                    <span className="font-medium text-ink">{l}</span>
                    <span className="block text-xs text-muted">{d}</span>
                  </span>
                </label>
              ))}
              {characters === 'custom' && <Input aria-label="Characters to keep" placeholder="SOUTHERN BRAVE 0123456789" value={customText} onChange={(e) => setCustomText(e.target.value)} className="mt-1" />}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink-2">Font path in CSS</span>
              <Input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink-2">font-display</span>
              <Select value={display} onChange={(e) => setDisplay(e.target.value)}>
                {['swap', 'optional', 'fallback', 'block', 'auto'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </label>
          </div>

          <div className="space-y-2">
            <Checkbox label="Fallback face" description="Metric-matched local font to reduce layout shift" checked={fallback} onChange={setFallback} />
            <Checkbox label="Demo page" description="demo.html previews every face" checked={demo} onChange={setDemo} />
            <Checkbox label="Typography tokens" description={data.usage.length ? 'tokens.css with this workspace’s font roles and text styles' : 'Not used in any tokens yet'} checked={tokens} onChange={setTokens} disabled={!data.usage.length} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
        <Button variant="primary" loading={busy} disabled={!formats.length || !faceIds.length || (variable === 'static' && variableFaces.length > 0 && !staticWeights.length)} onClick={download}>
          {busy ? 'Building kit…' : 'Download ZIP'}
        </Button>
        <span className="text-xs text-muted">
          About {count} font file{count === 1 ? '' : 's'}
          {characters === 'split' ? ' per script' : ''} · {family.licence.type ? `${family.licence.type} licence` : 'check the licence allows web embedding'}
        </span>
        {error && (
          <div className="w-full">
            <Alert tone="bad">{error}</Alert>
          </div>
        )}
      </div>
    </Card>
  );
}
