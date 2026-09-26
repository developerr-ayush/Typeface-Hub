'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea, useToast } from '../ui';
import type { FamilyViewData } from './shared';

export function SettingsPanel({ data, onChange }: { data: FamilyViewData; onChange: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const { family, ws, can } = data;
  const [form, setForm] = useState({
    displayName: family.displayName,
    cssName: family.cssName,
    category: family.category,
    fallbackStack: family.fallbackStack.join(', '),
    display: family.display,
    tags: family.tags.join(', '),
  });
  const [lic, setLic] = useState({
    type: family.licence.type ?? '',
    owner: family.licence.owner ?? '',
    allowedDomains: (family.licence.allowedDomains ?? []).join(', '),
    expiresAt: family.licence.expiresAt?.slice(0, 10) ?? '',
    documentUrl: family.licence.documentUrl ?? '',
    notes: family.licence.notes ?? '',
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  async function save(section: string, body: object) {
    setSaving(section);
    setError(null);
    try {
      await api(ws, `/api/v1/families/${family.id}`, { method: 'PATCH', body });
      toast('Saved.');
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(null);
  }

  async function archive(archived: boolean) {
    try {
      await api(ws, `/api/v1/families/${family.id}/archive`, { body: { archived } });
      toast(archived ? 'Family archived. It is no longer served.' : 'Family restored.');
      onChange();
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  }

  async function remove() {
    if (!confirm(`Delete ${family.displayName} and every version? This cannot be undone.`)) return;
    try {
      await api(ws, `/api/v1/families/${family.id}`, { method: 'DELETE' });
      toast(`${family.displayName} deleted.`);
      router.push(`/w/${ws}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  }

  const detected = family.licence.detected;

  return (
    <div className="space-y-6">
      {error && <Alert tone="bad">{error}</Alert>}
      <Card>
        <CardHeader title="Details" description="How the family is named, grouped and loaded." />
        <form
          className="grid gap-4 px-5 py-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save('details', { ...form, fallbackStack: list(form.fallbackStack), tags: list(form.tags) });
          }}
        >
          <fieldset disabled={!can.edit} className="contents">
            <Field label="Display name">{(id) => <Input id={id} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />}</Field>
            <Field label="CSS family name" hint="The name used in font-family and in CSS API URLs. Changing it breaks existing URLs.">
              {(id) => <Input id={id} value={form.cssName} onChange={(e) => setForm({ ...form, cssName: e.target.value })} required />}
            </Field>
            <Field label="Category">
              {(id) => (
                <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {['sans-serif', 'serif', 'display', 'handwriting', 'monospace'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="font-display" hint="swap for text; optional for non-critical display fonts.">
              {(id) => (
                <Select id={id} value={form.display} onChange={(e) => setForm({ ...form, display: e.target.value })}>
                  {['swap', 'optional', 'fallback', 'block', 'auto'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Fallback stack" hint="Comma separated, e.g. system-ui, sans-serif. A metric-matched “Fallback” face is added automatically.">
              {(id) => <Input id={id} value={form.fallbackStack} onChange={(e) => setForm({ ...form, fallbackStack: e.target.value })} />}
            </Field>
            <Field label="Tags" hint="Comma separated, e.g. Brand fonts.">
              {(id) => <Input id={id} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />}
            </Field>
            {can.edit && (
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" loading={saving === 'details'}>
                  Save details
                </Button>
              </div>
            )}
          </fieldset>
        </form>
      </Card>

      <Card>
        <CardHeader title="Licence" description="Record who owns the licence and where the font may be served." />
        <form
          className="grid gap-4 px-5 py-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save('licence', {
              licence: {
                type: lic.type || undefined,
                owner: lic.owner,
                allowedDomains: list(lic.allowedDomains),
                expiresAt: lic.expiresAt || null,
                documentUrl: lic.documentUrl,
                notes: lic.notes,
              },
            });
          }}
        >
          <fieldset disabled={!can.licence} className="contents">
            <Field label="Licence type">
              {(id) => (
                <Select id={id} value={lic.type} onChange={(e) => setLic({ ...lic, type: e.target.value })}>
                  <option value="">Not recorded</option>
                  {['OFL', 'Apache', 'UFL', 'commercial', 'client-owned', 'other'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Owner">{(id) => <Input id={id} value={lic.owner} onChange={(e) => setLic({ ...lic, owner: e.target.value })} placeholder="Client or foundry" />}</Field>
            <Field label="Allowed domains" hint="Comma separated. * means anywhere.">
              {(id) => <Input id={id} value={lic.allowedDomains} onChange={(e) => setLic({ ...lic, allowedDomains: e.target.value })} placeholder="example.com, *.example.com" />}
            </Field>
            <Field label="Expires">{(id) => <Input id={id} type="date" value={lic.expiresAt} onChange={(e) => setLic({ ...lic, expiresAt: e.target.value })} />}</Field>
            <Field label="Licence document URL">{(id) => <Input id={id} value={lic.documentUrl} onChange={(e) => setLic({ ...lic, documentUrl: e.target.value })} />}</Field>
            <Field label="Notes">{(id) => <Textarea id={id} rows={2} value={lic.notes} onChange={(e) => setLic({ ...lic, notes: e.target.value })} />}</Field>
            {(detected?.license || detected?.licenseUrl || detected?.copyright) && (
              <div className="rounded-lg bg-canvas p-3 text-xs text-muted sm:col-span-2">
                <div className="mb-1 font-medium text-ink-2">Found in the font file</div>
                {detected.copyright && <div>{detected.copyright}</div>}
                {detected.license && <div className="line-clamp-3">{detected.license}</div>}
                {detected.licenseUrl && <div>{detected.licenseUrl}</div>}
                {detected.vendor && <div>Vendor: {detected.vendor}</div>}
              </div>
            )}
            {family.licence.confirmedAt && (
              <p className="text-xs text-muted sm:col-span-2">
                Self-hosting confirmed by {family.licence.confirmedBy ?? 'a member'} on {new Date(family.licence.confirmedAt).toLocaleDateString()}.
              </p>
            )}
            {can.licence ? (
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" loading={saving === 'licence'}>
                  Save licence
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted sm:col-span-2">Only admins can edit licence records.</p>
            )}
          </fieldset>
        </form>
      </Card>

      <Card>
        <CardHeader title="Where it is used" />
        <div className="px-5 py-4 text-sm">
          {data.usage.length === 0 ? (
            <p className="text-muted">Not used by any typography role.</p>
          ) : (
            <ul className="space-y-1">
              {data.usage.map((u) => (
                <li key={`${u.theme}-${u.role}`}>
                  <span className="font-medium text-ink">{u.role}</span> role in theme <span className="font-medium">{u.theme}</span>
                  {u.styles.length > 0 && <span className="text-muted"> · {u.styles.join(', ')}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {(can.publish || can.delete) && (
        <Card className="border-bad/25">
          <CardHeader title="Danger zone" />
          <div className="flex flex-wrap gap-3 px-5 py-4">
            {can.publish &&
              (family.status === 'archived' ? (
                <Button onClick={() => archive(false)}>Restore family</Button>
              ) : (
                <Button onClick={() => archive(true)} disabled={data.usage.length > 0} title={data.usage.length ? 'Reassign the roles using it first' : undefined}>
                  Archive family
                </Button>
              ))}
            {can.delete && (
              <Button variant="danger" onClick={remove} disabled={data.usage.length > 0}>
                Delete family
              </Button>
            )}
            {data.usage.length > 0 && <p className="w-full text-xs text-muted">This family is in use, so it can’t be archived or deleted until those roles use another family.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
