'use client';

import { useMemo, useState } from 'react';
import { Card, Checkbox, cx, Select, Textarea } from '../ui';
import { fontStack, type FamilyViewData, type VersionData } from './shared';

const REGISTERED = new Set(['wght', 'wdth', 'ital', 'slnt', 'opsz']);

function Slider({ label, min, max, step = 1, value, onChange, suffix }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void; suffix?: string }) {
  const id = `s-${label.replace(/\W/g, '')}`;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-ink-2">
          {label}
        </label>
        <span className="text-muted tabular-nums">
          {+value.toFixed(2)}
          {suffix}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-accent)]" />
    </div>
  );
}

export function TesterPanel({ family, version }: { family: FamilyViewData['family']; version: VersionData }) {
  const hasItalic = version.faces.some((f) => f.style === 'italic');
  const variable = version.faces.find((f) => f.axes.length);
  const staticWeights = [...new Set(version.faces.filter((f) => !f.axes.length).map((f) => f.weightMin))].sort((a, b) => a - b);
  const wMin = Math.min(...version.faces.map((f) => f.weightMin));
  const wMax = Math.max(...version.faces.map((f) => f.weightMax));
  const instances = variable?.namedInstances.filter((n) => n.coords.wght !== undefined) ?? [];

  const [text, setText] = useState('Southern Brave clinch it in the final over');
  const [size, setSize] = useState(48);
  const [weight, setWeight] = useState(Math.min(Math.max(400, wMin), wMax));
  const [italic, setItalic] = useState(false);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [tracking, setTracking] = useState(0);
  const [dark, setDark] = useState(false);
  const [snap, setSnap] = useState(true);
  const customAxes = useMemo(() => (variable?.axes ?? []).filter((a) => !REGISTERED.has(a.tag)), [variable]);
  const [axes, setAxes] = useState<Record<string, number>>(() => Object.fromEntries((variable?.axes ?? []).map((a) => [a.tag, a.default])));

  const setW = (v: number) => {
    if (variable && snap && instances.length) {
      const nearest = instances.reduce((a, b) => (Math.abs(b.coords.wght - v) < Math.abs(a.coords.wght - v) ? b : a));
      if (Math.abs(nearest.coords.wght - v) <= 25) v = nearest.coords.wght;
    }
    setWeight(v);
  };
  const currentInstance = instances.find((n) => n.coords.wght === weight);

  // Registered axes map to CSS properties; only custom axes use font-variation-settings (VAR-6).
  const style: React.CSSProperties = {
    fontFamily: fontStack(version.alias, family.fallbackStack),
    fontSize: size,
    fontWeight: weight,
    fontStyle: italic ? 'italic' : 'normal',
    lineHeight,
    letterSpacing: `${tracking}em`,
    ...(axes.wdth !== undefined && { fontStretch: `${axes.wdth}%` }),
    ...(axes.opsz !== undefined && { fontOpticalSizing: 'auto' as const }),
    ...(customAxes.length && { fontVariationSettings: customAxes.map((a) => `'${a.tag}' ${axes[a.tag]}`).join(', ') }),
  };
  const cssOut = [
    `font-family: ${style.fontFamily};`,
    `font-size: ${size / 16}rem;`,
    `font-weight: ${weight};`,
    italic && 'font-style: italic;',
    `line-height: ${lineHeight};`,
    tracking && `letter-spacing: ${tracking}em;`,
    style.fontStretch && `font-stretch: ${style.fontStretch};`,
    style.fontVariationSettings && `font-variation-settings: ${style.fontVariationSettings};`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className={cx('min-h-[360px] overflow-hidden transition-colors', dark ? 'bg-[#101216]' : 'bg-surface')}>
        <label htmlFor="tester-text" className="sr-only">
          Sample text
        </label>
        <Textarea
          id="tester-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className={cx('min-h-[360px] resize-y border-0 bg-transparent p-6 shadow-none focus:ring-0', dark ? 'text-white' : 'text-ink')}
          style={style}
        />
      </Card>
      <Card className="h-fit space-y-4 p-5">
        <Slider label="Size" min={10} max={160} value={size} onChange={setSize} suffix="px" />
        {variable ? (
          <>
            <Slider label={`Weight${currentInstance ? ` · ${currentInstance.name}` : ''}`} min={wMin} max={wMax} value={weight} onChange={setW} />
            {instances.length > 0 && <Checkbox label="Snap to named instances" checked={snap} onChange={setSnap} />}
            {variable.axes
              .filter((a) => a.tag !== 'wght' && a.tag !== 'ital')
              .map((a) => (
                <Slider key={a.tag} label={`${a.name ?? a.tag} (${a.tag})`} min={a.min} max={a.max} step={a.max - a.min > 20 ? 1 : 0.1} value={axes[a.tag]} onChange={(v) => setAxes((x) => ({ ...x, [a.tag]: v }))} />
              ))}
          </>
        ) : (
          <div>
            <label htmlFor="tester-weight" className="text-xs font-medium text-ink-2">
              Weight
            </label>
            <Select id="tester-weight" value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="mt-1">
              {staticWeights.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Slider label="Line height" min={0.8} max={2.4} step={0.05} value={lineHeight} onChange={setLineHeight} />
        <Slider label="Letter spacing" min={-0.1} max={0.3} step={0.005} value={tracking} onChange={setTracking} suffix="em" />
        <div className="flex flex-wrap gap-4">
          {hasItalic && <Checkbox label="Italic" checked={italic} onChange={setItalic} />}
          <Checkbox label="Dark background" checked={dark} onChange={setDark} />
        </div>
        <pre className="overflow-x-auto rounded-lg bg-canvas p-3 text-[11.5px] leading-relaxed text-ink-2">{cssOut.replace(version.alias, family.cssName)}</pre>
      </Card>
    </div>
  );
}
