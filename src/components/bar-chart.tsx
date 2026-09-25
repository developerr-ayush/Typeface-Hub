'use client';

import { useState } from 'react';

/** Single-series bar chart: thin rounded bars, recessive axis, hover tooltip, and a table for screen readers. */
export function BarChart({ data, label, format = (n) => n.toLocaleString(), height = 140 }: { data: { key: string; label: string; value: number }[]; label: string; format?: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="relative">
      <div className="flex items-end gap-[2px]" style={{ height }} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.key} className="group relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}>
            <div
              className="w-full rounded-t-[4px] transition-colors"
              style={{ height: `${Math.max(d.value ? 2 : 0, (d.value / max) * 100)}%`, background: hover === i ? 'var(--color-accent-strong)' : 'var(--color-accent)', opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 h-px bg-line" />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap text-ink shadow-md"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          <span className="text-muted">{data[hover].label}</span> · <span className="font-semibold tabular-nums">{format(data[hover].value)}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
