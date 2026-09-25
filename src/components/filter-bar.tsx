'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Input, Select } from './ui';

export function FilterBar({ filters }: { filters: { name: string; label: string; options: [string, string][] }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q) update('q', q);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <label htmlFor="lib-search" className="sr-only">
          Search families
        </label>
        <Input id="lib-search" type="search" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        <svg className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      {filters.map((f) => (
        <div key={f.name}>
          <label htmlFor={`f-${f.name}`} className="sr-only">
            {f.label}
          </label>
          <Select id={`f-${f.name}`} value={params.get(f.name) ?? ''} onChange={(e) => update(f.name, e.target.value)} className="w-auto min-w-[130px]">
            <option value="">{f.label}</option>
            {f.options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}
