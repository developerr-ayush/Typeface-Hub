'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { JobProgress } from '../job-progress';
import { Alert, Badge, Button, Card, Checkbox, cx, Input, Select, Spinner } from '../ui';

interface GoogleFamily {
  family: string;
  id: string;
  category: string;
  subsets: string[];
  variants: string[];
  axes: { tag: string; min: number; max: number; default: number }[];
  licence: string;
}

const CATEGORIES: [string, string][] = [
  ['all', 'All categories'],
  ['sans-serif', 'Sans serif'],
  ['serif', 'Serif'],
  ['display', 'Display'],
  ['handwriting', 'Handwriting'],
  ['monospace', 'Monospace'],
];
const PAGE = 36;

function cssUrl(families: string[], text?: string) {
  const q = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ''}`;
}

export function GoogleTab({ ws, defaultMode, selfHostOnly }: { ws: string; defaultMode: 'external' | 'import'; selfHostOnly: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [variable, setVariable] = useState(false);
  const [items, setItems] = useState<GoogleFamily[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GoogleFamily | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await api<{ items: GoogleFamily[]; total: number }>(ws, `/api/v1/google?q=${encodeURIComponent(q)}&category=${category}&variable=${variable}&limit=${PAGE}`).catch(() => null);
      if (res) {
        setItems(res.items);
        setTotal(res.total);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [ws, q, category, variable]);

  const loadMore = async () => {
    setLoading(true);
    const res = await api<{ items: GoogleFamily[] }>(ws, `/api/v1/google?q=${encodeURIComponent(q)}&category=${category}&variable=${variable}&limit=${PAGE}&offset=${items.length}`);
    setItems((i) => [...i, ...res.items]);
    setLoading(false);
  };

  // One Google request for all visible names, limited to the characters needed.
  const previewHref = useMemo(() => {
    if (!items.length) return null;
    const text = [...new Set(items.map((i) => i.family).join('') + 'Aa')].join('');
    return cssUrl(items.map((i) => i.family), text);
  }, [items]);

  if (selected) {
    return <GoogleFamilyPanel ws={ws} family={selected} defaultMode={selfHostOnly ? 'import' : defaultMode} selfHostOnly={selfHostOnly} onBack={() => setSelected(null)} onCreated={(slug) => router.push(`/w/${ws}/families/${slug}?tab=review`)} />;
  }

  return (
    <div className="space-y-4">
      {previewHref && <link rel="stylesheet" href={previewHref} />}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="g-search" className="sr-only">
            Search Google Fonts
          </label>
          <Input id="g-search" type="search" placeholder="Search Google Fonts, e.g. Inter" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <label htmlFor="g-cat" className="sr-only">
          Category
        </label>
        <Select id="g-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <div className="px-1">
          <Checkbox label="Variable only" checked={variable} onChange={setVariable} />
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        {loading && <Spinner className="size-3.5" />}
        {total.toLocaleString()} families
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <li key={f.family}>
            <button
              type="button"
              onClick={() => setSelected(f)}
              className="flex h-full w-full flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:border-accent/50 hover:shadow-md"
            >
              <span className="truncate text-[26px] leading-tight text-ink" style={{ fontFamily: `'${f.family}', system-ui` }}>
                {f.family}
              </span>
              <span className="mt-2 flex flex-wrap gap-1">
                <Badge>{f.category}</Badge>
                {f.axes.some((a) => a.tag === 'wght') ? <Badge tone="accent">Variable</Badge> : <Badge>{f.variants.length} styles</Badge>}
                {f.variants.some((v) => v.endsWith('i')) && <Badge>Italic</Badge>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {items.length < total && (
        <div className="flex justify-center">
          <Button onClick={loadMore} loading={loading}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function GoogleFamilyPanel({
  ws,
  family,
  defaultMode,
  selfHostOnly,
  onBack,
  onCreated,
}: {
  ws: string;
  family: GoogleFamily;
  defaultMode: 'external' | 'import';
  selfHostOnly: boolean;
  onBack: () => void;
  onCreated: (slug: string) => void;
}) {
  const wght = family.axes.find((a) => a.tag === 'wght');
  const hasItalic = family.variants.some((v) => v.endsWith('i'));
  const staticWeights = [...new Set(family.variants.map((v) => parseInt(v, 10)))].sort((a, b) => a - b);
  const [mode, setMode] = useState<'external' | 'import'>(defaultMode);
  const [styles, setStyles] = useState<('normal' | 'italic')[]>(['normal']);
  const [weights, setWeights] = useState<number[]>(wght ? [] : staticWeights.filter((w) => w === 400 || w === 700).length ? staticWeights.filter((w) => w === 400 || w === 700) : [staticWeights[0]]);
  const [limit, setLimit] = useState(false);
  const [range, setRange] = useState<[number, number]>(wght ? [wght.min, wght.max] : [400, 700]);
  const [licence, setLicence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [sample, setSample] = useState('The quick brown fox jumps over the lazy dog');

  const href = wght
    ? `https://fonts.googleapis.com/css2?family=${family.family.replace(/ /g, '+')}:${hasItalic ? `ital,wght@0,${wght.min}..${wght.max};1,${wght.min}..${wght.max}` : `wght@${wght.min}..${wght.max}`}&display=swap`
    : `https://fonts.googleapis.com/css2?family=${family.family.replace(/ /g, '+')}:ital,wght@${[...family.variants].map((v) => `${v.endsWith('i') ? 1 : 0},${parseInt(v, 10)}`).sort().join(';')}&display=swap`;
  const previewWeights = wght ? [wght.min, 400, 700, wght.max].filter((w, i, a) => w >= wght.min && w <= wght.max && a.indexOf(w) === i) : staticWeights;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        family: family.family,
        mode,
        styles,
        weights: wght ? [wght.min, wght.max] : weights,
        axisLimits: mode === 'import' && wght && limit ? { wght: { min: range[0], max: range[1] } } : undefined,
        licenceConfirmed: licence,
      };
      const res = await api<{ family?: { slug: string }; job?: { id: string } }>(ws, '/api/v1/families/google', { body });
      if (res.family) onCreated(res.family.slug);
      if (res.job) setJobId(res.job.id);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (jobId) return <JobProgress ws={ws} jobId={jobId} />;

  return (
    <div className="space-y-4">
      <link rel="stylesheet" href={href} />
      <Button size="sm" variant="ghost" onClick={onBack}>
        ← Back to results
      </Button>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-2xl text-ink" style={{ fontFamily: `'${family.family}', system-ui, sans-serif` }}>
              {family.family}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge>{family.category}</Badge>
              {wght ? <Badge tone="accent">Variable · wght {wght.min}–{wght.max}</Badge> : <Badge>{staticWeights.length} weights</Badge>}
              {family.axes.filter((a) => a.tag !== 'wght' && a.tag !== 'ital').map((a) => (
                <Badge key={a.tag}>
                  {a.tag} {a.min}–{a.max}
                </Badge>
              ))}
              <Badge>{family.licence.toUpperCase()}</Badge>
              <Badge>{family.subsets.length} subsets</Badge>
            </div>
          </div>
          <div className="px-5 py-4">
            <label htmlFor="g-sample" className="sr-only">
              Sample text
            </label>
            <Input id="g-sample" value={sample} onChange={(e) => setSample(e.target.value)} />
            <div className="mt-4 space-y-3">
              {previewWeights.map((w) => (
                <div key={w} className="flex items-baseline gap-4">
                  <span className="w-10 shrink-0 text-xs text-muted tabular-nums">{w}</span>
                  <p className="truncate text-3xl text-ink" style={{ fontFamily: `'${family.family}', system-ui, sans-serif`, fontWeight: w }}>
                    {sample}
                  </p>
                </div>
              ))}
              {hasItalic && (
                <div className="flex items-baseline gap-4">
                  <span className="w-10 shrink-0 text-xs text-muted">Italic</span>
                  <p className="truncate text-3xl text-ink italic" style={{ fontFamily: `'${family.family}', system-ui, sans-serif` }}>
                    {sample}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
        <Card className="h-fit p-5">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">How should it be delivered?</legend>
            <div className="mt-3 space-y-2">
              {(
                [
                  ['external', 'Load external', 'Served by Google Fonts. Quickest to set up; adds a third-party request.'],
                  ['import', 'Import as internal', 'Files are downloaded once, converted and served from your own CSS API.'],
                ] as const
              ).map(([v, l, d]) => (
                <label
                  key={v}
                  className={cx(
                    'flex cursor-pointer gap-2.5 rounded-lg border p-3',
                    mode === v ? 'border-accent bg-accent-soft/60' : 'border-line',
                    v === 'external' && selfHostOnly && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input type="radio" name="mode" value={v} checked={mode === v} disabled={v === 'external' && selfHostOnly} onChange={() => setMode(v)} className="mt-0.5 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{l}</span>
                    <span className="block text-xs text-muted">{v === 'external' && selfHostOnly ? 'Disabled: this workspace is set to self-host only.' : d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink">Styles</legend>
            <div className="mt-2 flex gap-4">
              <Checkbox label="Roman" checked={styles.includes('normal')} onChange={(v) => setStyles((s) => (v ? [...new Set([...s, 'normal' as const])] : s.filter((x) => x !== 'normal')))} />
              {hasItalic && <Checkbox label="Italic" checked={styles.includes('italic')} onChange={(v) => setStyles((s) => (v ? [...new Set([...s, 'italic' as const])] : s.filter((x) => x !== 'italic')))} />}
            </div>
          </fieldset>

          {!wght && (
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-ink">Weights</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {staticWeights.map((w) => (
                  <Checkbox key={w} label={String(w)} checked={weights.includes(w)} onChange={(v) => setWeights((s) => (v ? [...s, w].sort((a, b) => a - b) : s.filter((x) => x !== w)))} />
                ))}
              </div>
            </fieldset>
          )}

          {wght && mode === 'import' && (
            <div className="mt-5 space-y-2">
              <Checkbox label="Cap the weight range" description="Re-instances the variable font to fewer weights to cut file size." checked={limit} onChange={setLimit} />
              {limit && (
                <div className="flex items-center gap-2 pl-6">
                  <Input type="number" aria-label="Minimum weight" min={wght.min} max={range[1]} value={range[0]} onChange={(e) => setRange([Number(e.target.value), range[1]])} className="h-8 w-20" />
                  <span className="text-muted">–</span>
                  <Input type="number" aria-label="Maximum weight" min={range[0]} max={wght.max} value={range[1]} onChange={(e) => setRange([range[0], Number(e.target.value)])} className="h-8 w-20" />
                </div>
              )}
            </div>
          )}

          {mode === 'import' && (
            <div className="mt-5">
              <Checkbox checked={licence} onChange={setLicence} label={`I confirm the ${family.licence.toUpperCase()} licence allows self-hosting`} description="Google Fonts are open-source licensed; self-hosting is allowed." />
            </div>
          )}

          {error && (
            <div className="mt-4">
              <Alert tone="bad">{error}</Alert>
            </div>
          )}
          <Button
            variant="primary"
            className="mt-5 w-full"
            loading={busy}
            disabled={!styles.length || (!wght && !weights.length) || (mode === 'import' && !licence)}
            onClick={submit}
          >
            {mode === 'import' ? 'Import & process' : 'Add to library'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
