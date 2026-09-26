'use client';

import { useMemo, useState } from 'react';
import { Alert, Card, CardHeader, Checkbox, CodeBlock, Select } from '../ui';
import { DownloadKit } from './download-kit';
import type { FamilyViewData, VersionData } from './shared';

export function EmbedPanel({ data, version, kitVersion }: { data: FamilyViewData; version: VersionData; kitVersion?: VersionData }) {
  const { family, origin, ws } = data;
  const variable = version.faces.find((f) => f.axes.length);
  const options = useMemo(() => {
    const out: { key: string; label: string; ital: 0 | 1; w: string }[] = [];
    for (const f of version.faces) {
      const ital = f.style === 'italic' ? 1 : 0;
      if (f.axes.length) {
        for (const w of [100, 200, 300, 400, 500, 600, 700, 800, 900].filter((w) => w >= f.weightMin && w <= f.weightMax)) {
          out.push({ key: `${ital}-${w}`, label: `${w}${ital ? ' italic' : ''}`, ital, w: String(w) });
        }
      } else out.push({ key: `${ital}-${f.weightMin}`, label: `${f.weightMin}${ital ? ' italic' : ''}`, ital, w: String(f.weightMin) });
    }
    return [...new Map(out.map((o) => [o.key, o])).values()].sort((a, b) => a.ital - b.ital || +a.w - +b.w);
  }, [version]);

  const [picked, setPicked] = useState<string[]>(() => options.filter((o) => o.ital === 0 && (o.w === '400' || o.w === '700')).map((o) => o.key).slice(0, 2).concat(options.length && !options.some((o) => o.w === '400' || o.w === '700') ? [options[0].key] : []));
  const [range, setRange] = useState(false);
  const [display, setDisplay] = useState(family.display);

  const chosen = options.filter((o) => picked.includes(o.key));
  const hasItalic = chosen.some((o) => o.ital);
  const name = family.cssName.replace(/ /g, '+');
  let spec = '';
  if (range && variable) {
    const r = `${variable.weightMin}..${variable.weightMax}`;
    const styles = [...new Set(version.faces.map((f) => (f.style === 'italic' ? 1 : 0)))].sort();
    spec = styles.length > 1 || styles[0] === 1 ? `:ital,wght@${styles.map((s) => `${s},${r}`).join(';')}` : `:wght@${r}`;
  } else if (chosen.length) {
    spec = hasItalic ? `:ital,wght@${chosen.map((o) => `${o.ital},${o.w}`).join(';')}` : `:wght@${chosen.map((o) => o.w).join(';')}`;
  }
  const cssUrl = `${origin}/fonts/${ws}/css?family=${name}${spec}&display=${display}`;
  const latin = version.faces
    .filter((f) => chosen.some((o) => o.ital === (f.style === 'italic' ? 1 : 0) && +o.w >= f.weightMin && +o.w <= f.weightMax))
    .flatMap((f) => f.files)
    .find((f) => f.format === 'woff2' && (f.subset === 'latin' || f.subset === 'all'));
  const stack = `'${family.cssName}', ${family.delivery === 'internal' ? `'${family.cssName} Fallback', ` : ''}${family.fallbackStack.join(', ')}`;
  const html = [
    family.delivery === 'external' && family.external?.provider === 'google' && '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    latin && family.delivery === 'internal' && `<link rel="preload" href="${origin}/fonts/files/${latin.name}" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="${cssUrl}">`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-6">
      {family.status !== 'published' && <Alert tone="warn" title="Not published yet">The CSS API only serves published versions. Publish a version from the Review tab first.</Alert>}
      <Card>
        <CardHeader title="Embed in any site" description="The CSS API returns only the faces you request, split by unicode-range so browsers download only the scripts a page renders." />
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-start gap-6">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">Faces</legend>
              <div className="grid grid-cols-3 gap-x-5 gap-y-2 sm:grid-cols-5">
                {options.map((o) => (
                  <Checkbox key={o.key} label={o.label} checked={picked.includes(o.key)} disabled={range} onChange={(v) => setPicked((p) => (v ? [...p, o.key] : p.filter((x) => x !== o.key)))} />
                ))}
              </div>
              {variable && (
                <div className="mt-3">
                  <Checkbox label={`Whole weight range (${variable.weightMin}–${variable.weightMax}) in one request`} checked={range} onChange={setRange} />
                </div>
              )}
            </fieldset>
            <div>
              <label htmlFor="embed-display" className="mb-2 block text-[13px] font-medium text-ink-2">
                display
              </label>
              <Select id="embed-display" value={display} onChange={(e) => setDisplay(e.target.value)} className="w-32">
                {['swap', 'optional', 'fallback', 'block', 'auto'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </div>
          </div>
          <CodeBlock label="HTML" code={html} />
          <CodeBlock label="CSS" code={`font-family: ${stack};`} />
          <p className="text-xs text-muted">
            Preview:{' '}
            <a href={cssUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              open the generated stylesheet
            </a>
            . File URLs are content-hashed and cached for a year; the stylesheet is cached briefly and refreshes within minutes of a publish.
          </p>
        </div>
      </Card>
      <DownloadKit key={(kitVersion ?? version).id} data={data} version={kitVersion ?? version} />
    </div>
  );
}
