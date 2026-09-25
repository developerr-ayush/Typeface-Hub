'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api } from '@/lib/client';
import type { Breakpoints, RoleToken, TextStyle } from '@/lib/db/schema';
import { a11yWarnings, fluidSize, scaleSteps, tokensToCss, tokensToJson, type FamilyLookup } from '@/lib/tokens';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, CodeBlock, cx, Input, Modal, Select, Tabs, useToast } from './ui';

interface Fam {
  id: string;
  name: string;
  cssName: string;
  status: string;
  delivery: string;
  fallbackStack: string[];
  preview: string | null;
  weights: [number, number][];
  italic: boolean;
}
interface TokenState {
  roles: Record<string, RoleToken>;
  textStyles: Record<string, TextStyle>;
  breakpoints: Breakpoints;
}

const num = (v: string, fallback: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback);

export function TokenEditor({ ws, origin, canEdit, themes, theme, initial, saved, families }: { ws: string; origin: string; canEdit: boolean; themes: string[]; theme: string; initial: TokenState; saved: boolean; families: Fam[] }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<TokenState>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<'css' | 'json' | 'sdui'>('css');
  const [sdui, setSdui] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState<string | null>(null);
  const [base, setBase] = useState(1);
  const [ratio, setRatio] = useState(1.25);
  const [previewBp, setPreviewBp] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  const update = (fn: (s: TokenState) => TokenState) => {
    setState(fn);
    setDirty(true);
  };
  const famById = (id: string | null) => families.find((f) => f.id === id);

  const lookup: FamilyLookup = useMemo(
    () => new Map(families.filter((f) => f.status === 'published').map((f) => [f.id, { cssName: f.cssName, fallbackStack: f.fallbackStack, hasFallbackFace: f.delivery === 'internal', delivery: f.delivery }])),
    [families],
  );
  const input = { theme, ...state };
  const css = useMemo(() => tokensToCss(input, lookup), [state, lookup]); // eslint-disable-line react-hooks/exhaustive-deps
  const json = useMemo(() => JSON.stringify(tokensToJson(input, lookup), null, 2), [state, lookup]); // eslint-disable-line react-hooks/exhaustive-deps
  const warnings = a11yWarnings(state.textStyles);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(ws, `/api/v1/tokens/${theme}`, { method: 'PUT', body: state });
      setDirty(false);
      setSdui(null);
      toast('Tokens saved. The token stylesheet updates within a minute.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
  }

  async function loadSdui() {
    setOut('sdui');
    try {
      const res = await api(ws, `/api/v1/sdui?theme=${theme}`);
      setSdui(JSON.stringify(res, null, 2));
    } catch (e) {
      setSdui(`// ${(e as Error).message}`);
    }
  }

  const applyScale = () => {
    const steps = scaleSteps(base, ratio);
    update((s) => ({
      ...s,
      textStyles: Object.fromEntries(
        Object.entries(s.textStyles).map(([k, v]) => {
          if (k === 'body') return [k, { ...v, size: { mobile: base, tablet: base, desktop: base } }];
          const desktop = steps[k];
          if (!desktop) return [k, v];
          const mobile = +(base * Math.pow(Math.min(ratio, 1.2), Object.keys(steps).indexOf(k) + 1)).toFixed(3);
          return [k, { ...v, size: { mobile, tablet: +((mobile + desktop) / 2).toFixed(3), desktop } }];
        }),
      ),
    }));
  };

  const previewSize = (s: TextStyle) => (s.fluid && previewBp !== 'tablet' ? s.size[previewBp] : s.size[previewBp]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="theme" className="text-[13px] text-muted">
            Theme
          </label>
          <Select id="theme" value={theme} onChange={(e) => (e.target.value === '__new' ? setNewTheme('') : router.push(`?theme=${e.target.value}`))} className="w-48">
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            {canEdit && <option value="__new">+ New theme…</option>}
          </Select>
          {!saved && <Badge tone="warn">Not saved yet</Badge>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {theme !== 'default' && (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!confirm(`Delete theme “${theme}”?`)) return;
                  await api(ws, `/api/v1/tokens/${theme}`, { method: 'DELETE' });
                  router.push('?theme=default');
                  router.refresh();
                }}
              >
                Delete theme
              </Button>
            )}
            <Button variant="primary" onClick={save} loading={saving} disabled={!dirty && saved}>
              {dirty || !saved ? 'Save tokens' : 'Saved'}
            </Button>
          </div>
        )}
      </div>
      {error && <Alert tone="bad">{error}</Alert>}

      <Card>
        <CardHeader title="Font roles" description="Each role maps to a family and a fallback stack. Only published families are delivered." />
        <div className="divide-y divide-line">
          {Object.entries(state.roles).map(([role, token]) => {
            const fam = famById(token.familyId);
            return (
              <div key={role} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[120px_1fr_1fr_auto]">
                <code className="text-[13px] font-medium text-ink">--font-{role}</code>
                <Select
                  aria-label={`Family for ${role}`}
                  value={token.familyId ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => update((s) => ({ ...s, roles: { ...s.roles, [role]: { ...s.roles[role], familyId: e.target.value || null } } }))}
                >
                  <option value="">System fallback only</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.status !== 'published' ? ` (${f.status})` : ''}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label={`Fallback for ${role}`}
                  placeholder={fam ? fam.fallbackStack.join(', ') : 'system-ui, sans-serif'}
                  value={token.fallback?.join(', ') ?? ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update((s) => ({
                      ...s,
                      roles: { ...s.roles, [role]: { ...s.roles[role], fallback: e.target.value ? e.target.value.split(',').map((x) => x.trim()).filter(Boolean) : undefined } },
                    }))
                  }
                />
                <div className="flex items-center gap-2">
                  {fam?.preview && (
                    <span className="text-xl text-ink" style={{ fontFamily: `'${fam.preview}', ${fam.fallbackStack.join(',')}` }}>
                      Aa
                    </span>
                  )}
                  {fam && fam.status !== 'published' && <Badge tone="warn">not live</Badge>}
                  {canEdit && !['heading', 'body'].includes(role) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove role ${role}`}
                      disabled={Object.values(state.textStyles).some((s) => s.role === role)}
                      title={Object.values(state.textStyles).some((s) => s.role === role) ? 'A text style uses this role' : undefined}
                      onClick={() =>
                        update((s) => {
                          const roles = { ...s.roles };
                          delete roles[role];
                          return { ...s, roles };
                        })
                      }
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {canEdit && (
          <div className="border-t border-line px-5 py-3">
            <AddName
              label="Add role"
              placeholder="e.g. accent"
              taken={Object.keys(state.roles)}
              onAdd={(name) => update((s) => ({ ...s, roles: { ...s.roles, [name]: { familyId: null } } }))}
            />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Text styles"
          description="Sizes in rem for mobile, tablet and desktop. Turn on fluid to interpolate with clamp() instead of breakpoints."
          actions={
            <div className="flex items-center gap-1 rounded-lg border border-line bg-canvas p-0.5" role="radiogroup" aria-label="Preview breakpoint">
              {(['mobile', 'tablet', 'desktop'] as const).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={previewBp === b} onClick={() => setPreviewBp(b)} className={cx('rounded-md px-2.5 py-1 text-xs font-medium', previewBp === b ? 'bg-surface shadow-sm' : 'text-muted')}>
                  {b}
                </button>
              ))}
            </div>
          }
        />
        {canEdit && (
          <div className="flex flex-wrap items-end gap-3 border-b border-line bg-canvas/60 px-5 py-3 text-sm">
            <span className="font-medium text-ink-2">Type scale</span>
            <label className="flex items-center gap-2 text-xs text-muted">
              Base (rem)
              <Input type="number" step="0.0625" min="0.5" value={base} onChange={(e) => setBase(num(e.target.value, 1))} className="h-8 w-20" />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              Ratio
              <Select value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="h-8 w-44">
                {[
                  [1.125, 'Major second 1.125'],
                  [1.2, 'Minor third 1.2'],
                  [1.25, 'Major third 1.25'],
                  [1.333, 'Perfect fourth 1.333'],
                  [1.414, 'Augmented fourth 1.414'],
                  [1.5, 'Perfect fifth 1.5'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </label>
            <Button size="sm" onClick={applyScale}>
              Apply to headings
            </Button>
          </div>
        )}
        <div className="divide-y divide-line">
          {Object.entries(state.textStyles).map(([name, s]) => {
            const fam = famById(state.roles[s.role]?.familyId ?? null);
            const set = (patch: Partial<TextStyle>) => update((st) => ({ ...st, textStyles: { ...st.textStyles, [name]: { ...st.textStyles[name], ...patch } } }));
            const size = previewSize(s);
            const weights = fam?.weights ?? [];
            const missingWeight = fam && weights.length > 0 && !weights.some(([a, b]) => s.weight >= a && s.weight <= b);
            return (
              <div key={name} className="px-5 py-4">
                <div
                  className="mb-3 truncate text-ink"
                  style={{
                    fontFamily: fam?.preview ? `'${fam.preview}', ${fam.fallbackStack.join(',')}` : 'system-ui',
                    fontSize: `${Math.min(size, 4)}rem`,
                    fontWeight: s.weight,
                    fontStyle: s.style,
                    lineHeight: s.lineHeight,
                    letterSpacing: `${s.letterSpacing}em`,
                    textTransform: s.transform,
                  }}
                >
                  {name === 'body' || name === 'caption' ? 'Fans packed the stands as the final over began.' : name === 'button' ? 'Buy tickets' : name === 'label' ? 'Match centre' : 'Southern Brave win by 7 runs'}
                </div>
                <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-[64px_minmax(96px,1fr)_76px_96px_68px_68px_68px_64px_76px_minmax(104px,1fr)_auto]">
                  <legend className="sr-only">{name}</legend>
                  <div className="self-center">
                    <code className="text-[13px] font-semibold text-ink">{name}</code>
                  </div>
                  <Labeled label="Role">
                    <Select value={s.role} onChange={(e) => set({ role: e.target.value })} className="h-8">
                      {Object.keys(state.roles).map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                  </Labeled>
                  <Labeled label="Weight">
                    <Input type="number" min={1} max={1000} step={50} value={s.weight} onChange={(e) => set({ weight: Math.round(num(e.target.value, 400)) })} className={cx('h-8', missingWeight && 'border-warn')} />
                  </Labeled>
                  <Labeled label="Style">
                    <Select value={s.style} onChange={(e) => set({ style: e.target.value as 'normal' })} className="h-8">
                      <option value="normal">normal</option>
                      <option value="italic">italic</option>
                    </Select>
                  </Labeled>
                  {(['mobile', 'tablet', 'desktop'] as const).map((bp) => (
                    <Labeled key={bp} label={bp === 'mobile' ? 'Mobile' : bp === 'tablet' ? 'Tablet' : 'Desktop'}>
                      <Input
                        type="number"
                        step="0.0625"
                        min="0.25"
                        value={s.size[bp]}
                        disabled={s.fluid && bp === 'tablet'}
                        onChange={(e) => set({ size: { ...s.size, [bp]: num(e.target.value, s.size[bp]) } })}
                        className="h-8"
                      />
                    </Labeled>
                  ))}
                  <Labeled label="Line h.">
                    <Input type="number" step="0.05" min="0.8" value={s.lineHeight} onChange={(e) => set({ lineHeight: num(e.target.value, 1.2) })} className="h-8" />
                  </Labeled>
                  <Labeled label="Tracking (em)">
                    <Input type="number" step="0.005" value={s.letterSpacing} onChange={(e) => set({ letterSpacing: num(e.target.value, 0) })} className="h-8" />
                  </Labeled>
                  <Labeled label="Transform">
                    <Select value={s.transform} onChange={(e) => set({ transform: e.target.value as 'none' })} className="h-8">
                      {['none', 'uppercase', 'lowercase', 'capitalize'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </Labeled>
                  <div className="flex items-end gap-3 pb-1.5">
                    <Checkbox label="Fluid" checked={Boolean(s.fluid)} onChange={(v) => set({ fluid: v })} />
                  </div>
                </fieldset>
                <div className="mt-1 text-[11px] text-muted">
                  {s.fluid ? fluidSize(s.size.mobile, s.size.desktop, state.breakpoints) : `${s.size.mobile * 16}px → ${s.size.tablet * 16}px → ${s.size.desktop * 16}px`}
                  {missingWeight && <span className="text-warn"> · {fam?.name} has no {s.weight} weight; browsers will synthesise or pick the nearest.</span>}
                </div>
              </div>
            );
          })}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-6 border-t border-line px-5 py-3">
            <AddName
              label="Add text style"
              placeholder="e.g. display-xl"
              taken={Object.keys(state.textStyles)}
              onAdd={(name) => update((s) => ({ ...s, textStyles: { ...s.textStyles, [name]: { ...s.textStyles.body, role: 'body' } } }))}
            />
            <div className="flex items-center gap-2 text-xs text-muted">
              Breakpoints: tablet ≥
              <Input aria-label="Tablet breakpoint" type="number" value={state.breakpoints.tablet} onChange={(e) => update((s) => ({ ...s, breakpoints: { ...s.breakpoints, tablet: Math.round(num(e.target.value, 768)) } }))} className="h-8 w-20" />
              px, desktop ≥
              <Input aria-label="Desktop breakpoint" type="number" value={state.breakpoints.desktop} onChange={(e) => update((s) => ({ ...s, breakpoints: { ...s.breakpoints, desktop: Math.round(num(e.target.value, 1200)) } }))} className="h-8 w-20" />
              px
            </div>
          </div>
        )}
      </Card>

      {warnings.length > 0 && (
        <Alert tone="warn" title="Accessibility checks">
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card>
        <CardHeader title="Output" description={dirty ? 'Preview of unsaved changes. Save to publish them to the API.' : 'What developers consume from the API.'} />
        <div className="px-5 pb-5">
          <Tabs
            className="mb-4"
            value={out}
            onChange={(t) => (t === 'sdui' ? loadSdui() : setOut(t))}
            tabs={[
              { id: 'css', label: 'CSS variables' },
              { id: 'json', label: 'JSON tokens' },
              { id: 'sdui', label: 'SDUI (saved)' },
            ]}
          />
          {out === 'css' && (
            <>
              <CodeBlock label={`${origin}/fonts/${ws}/tokens.css?theme=${theme}`} code={css} />
            </>
          )}
          {out === 'json' && <CodeBlock label={`GET /api/v1/tokens/${theme}?format=json`} code={json} />}
          {out === 'sdui' && <CodeBlock label={`GET /api/v1/sdui?theme=${theme}`} code={sdui ?? 'Loading…'} />}
        </div>
      </Card>

      <Modal
        open={newTheme !== null}
        onClose={() => setNewTheme(null)}
        title="New theme"
        description="Starts as a copy of the current theme, for example a women’s team or a sub-brand."
        footer={
          <>
            <Button onClick={() => setNewTheme(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!newTheme || !/^[a-z0-9][a-z0-9-]*$/.test(newTheme)}
              onClick={async () => {
                try {
                  await api(ws, `/api/v1/tokens/${newTheme}`, { method: 'PUT', body: state });
                  setNewTheme(null);
                  router.push(`?theme=${newTheme}`);
                  router.refresh();
                } catch (e) {
                  toast((e as Error).message, 'bad');
                }
              }}
            >
              Create theme
            </Button>
          </>
        }
      >
        <Input aria-label="Theme name" placeholder="womens-team" value={newTheme ?? ''} onChange={(e) => setNewTheme(e.target.value.toLowerCase())} autoFocus />
        <p className="mt-1 text-xs text-muted">Lowercase letters, numbers and dashes.</p>
      </Modal>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function AddName({ label, placeholder, taken, onAdd }: { label: string; placeholder: string; taken: string[]; onAdd: (name: string) => void }) {
  const [value, setValue] = useState('');
  const valid = /^[a-z][a-z0-9-]{0,30}$/.test(value) && !taken.includes(value);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onAdd(value);
        setValue('');
      }}
    >
      <Input aria-label={label} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value.toLowerCase())} className="h-8 w-40" />
      <Button size="sm" type="submit" disabled={!valid}>
        {label}
      </Button>
    </form>
  );
}
