'use client';

import { Input, Select } from './ui';

export interface AxisInfo {
  tag: string;
  name?: string;
  min: number;
  max: number;
  default: number;
}
export type AxisSetting = { mode: 'keep' } | { mode: 'range'; min: number; max: number } | { mode: 'pin'; value: number };

const LABELS: Record<string, { name: string; hint: string }> = {
  wght: { name: 'Weight', hint: 'Cap it to the weights you use, e.g. 300–700.' },
  wdth: { name: 'Width', hint: 'Below 100 is condensed, above 100 is expanded. Pin to 100 if you only use normal width.' },
  opsz: { name: 'Optical size', hint: 'Browsers match it to the font size automatically (font-optical-sizing: auto). Pin it to one size to shrink the file.' },
  slnt: { name: 'Slant', hint: 'Angle of the oblique style. Pin to 0 if you never use it.' },
  ital: { name: 'Italic', hint: 'Usually 0 or 1.' },
  GRAD: { name: 'Grade', hint: 'Changes thickness without changing width, e.g. for dark mode.' },
};

export const axisLabel = (a: Pick<AxisInfo, 'tag' | 'name'>) => LABELS[a.tag]?.name ?? a.name ?? a.tag;

/** Merge the axes of several variable fonts into one control per tag. */
export function mergeAxes(lists: AxisInfo[][]): AxisInfo[] {
  const map = new Map<string, AxisInfo>();
  for (const list of lists)
    for (const a of list) {
      const prev = map.get(a.tag);
      map.set(a.tag, prev ? { ...prev, min: Math.min(prev.min, a.min), max: Math.max(prev.max, a.max) } : { ...a });
    }
  const order = ['wght', 'wdth', 'opsz', 'slnt', 'ital'];
  return [...map.values()].sort((a, b) => (order.indexOf(a.tag) + 1 || 99) - (order.indexOf(b.tag) + 1 || 99) || a.tag.localeCompare(b.tag));
}

/** Convert UI settings into the API's `axes` option (only axes that change something). */
export function toAxesOption(settings: Record<string, AxisSetting>) {
  const out: Record<string, { min: number; max: number } | number> = {};
  for (const [tag, s] of Object.entries(settings)) {
    if (s.mode === 'range') out[tag] = { min: s.min, max: s.max };
    if (s.mode === 'pin') out[tag] = s.value;
  }
  return Object.keys(out).length ? out : undefined;
}

export function AxisControls({ axes, value, onChange, staticMode }: { axes: AxisInfo[]; value: Record<string, AxisSetting>; onChange: (v: Record<string, AxisSetting>) => void; staticMode?: boolean }) {
  // In static mode weight comes from the chosen static weights; the other axes are pinned.
  const shown = axes.filter((a) => a.tag !== 'ital' && !(staticMode && a.tag === 'wght'));
  if (!shown.length) return null;
  const step = (a: AxisInfo) => (a.max - a.min > 20 ? 1 : 0.1);
  return (
    <div className="space-y-3">
      {shown.map((a) => {
        const s = value[a.tag] ?? { mode: 'keep' };
        const set = (next: AxisSetting) => onChange({ ...value, [a.tag]: next });
        const label = LABELS[a.tag];
        return (
          <div key={a.tag} className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {axisLabel(a)} <code className="text-xs text-muted">{a.tag}</code>
                </div>
                <div className="text-xs text-muted tabular-nums">
                  {a.min}–{a.max}, default {a.default}
                </div>
              </div>
              <Select
                aria-label={`${axisLabel(a)} setting`}
                value={s.mode}
                onChange={(e) => {
                  const mode = e.target.value as AxisSetting['mode'];
                  set(mode === 'keep' ? { mode } : mode === 'range' ? { mode, min: a.min, max: a.max } : { mode, value: a.default });
                }}
                className="h-8 w-40"
              >
                <option value="keep">{staticMode ? 'Use default' : 'Keep full range'}</option>
                {!staticMode && <option value="range">Limit range</option>}
                <option value="pin">Pin to value</option>
              </Select>
            </div>
            {s.mode === 'range' && (
              <div className="mt-2 flex items-center gap-2">
                <Input aria-label={`${axisLabel(a)} minimum`} type="number" min={a.min} max={a.max} step={step(a)} value={s.min} onChange={(e) => set({ ...s, min: Number(e.target.value) })} className="h-8 w-24" />
                <span className="text-muted">to</span>
                <Input aria-label={`${axisLabel(a)} maximum`} type="number" min={a.min} max={a.max} step={step(a)} value={s.max} onChange={(e) => set({ ...s, max: Number(e.target.value) })} className="h-8 w-24" />
              </div>
            )}
            {s.mode === 'pin' && (
              <div className="mt-2 flex items-center gap-3">
                <input aria-label={`${axisLabel(a)} value`} type="range" min={a.min} max={a.max} step={step(a)} value={s.value} onChange={(e) => set({ mode: 'pin', value: Number(e.target.value) })} className="flex-1 accent-[var(--color-accent)]" />
                <Input aria-label={`${axisLabel(a)} value (number)`} type="number" min={a.min} max={a.max} step={step(a)} value={s.value} onChange={(e) => set({ mode: 'pin', value: Number(e.target.value) })} className="h-8 w-24" />
              </div>
            )}
            {label && s.mode !== 'keep' && <p className="mt-2 text-xs text-muted">{label.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
