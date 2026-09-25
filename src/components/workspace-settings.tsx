'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import type { WorkspaceSettings } from '@/lib/db/schema';
import { Alert, Button, Card, CardHeader, Checkbox, Field, Input, Select, useToast } from './ui';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  since: string;
}

export function WorkspaceSettingsForm({ ws, me, canEdit, name, settings, members, roleDescriptions }: { ws: string; me: string; canEdit: boolean; name: string; settings: WorkspaceSettings; members: Member[]; roleDescriptions: Record<string, string> }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ name, ...settings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState({ email: '', role: 'editor' });

  async function call(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    try {
      await fn();
      toast(ok);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="bad">{error}</Alert>}
      <Card>
        <CardHeader title="Workspace" />
        <form
          className="space-y-4 px-5 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            await call(
              () => api(ws, '/api/v1/workspace', { method: 'PATCH', body: { name: form.name, settings: { googleMode: form.googleMode, selfHostOnly: form.selfHostOnly, defaultDisplay: form.defaultDisplay } } }),
              'Settings saved.',
            );
            setSaving(false);
          }}
        >
          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Default for Google Fonts" hint="What “Add” does unless someone picks otherwise.">
              {(id) => (
                <Select id={id} value={form.googleMode} onChange={(e) => setForm({ ...form, googleMode: e.target.value as 'external' })}>
                  <option value="external">Load external (Google CDN)</option>
                  <option value="import">Import as internal (self-host)</option>
                </Select>
              )}
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                label="Self-host only"
                description="Blocks external providers so pages make no third-party font requests (GDPR). Existing external families keep working until changed."
                checked={form.selfHostOnly}
                onChange={(v) => setForm({ ...form, selfHostOnly: v })}
              />
            </div>
          </fieldset>
          {canEdit && (
            <Button type="submit" variant="primary" loading={saving}>
              Save settings
            </Button>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader title="Members" description="Roles control who can add, publish and administer fonts." />
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <div className="text-sm font-medium text-ink">
                  {m.name} {m.id === me && <span className="text-muted">(you)</span>}
                </div>
                <div className="text-xs text-muted">{m.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Role for ${m.name}`}
                  value={m.role}
                  disabled={!canEdit}
                  onChange={(e) => call(() => api(ws, `/api/v1/members/${m.id}`, { method: 'PATCH', body: { role: e.target.value } }), 'Role updated.')}
                  className="h-8 w-32"
                >
                  {Object.keys(roleDescriptions).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
                {canEdit && m.id !== me && (
                  <Button size="sm" variant="ghost" onClick={() => confirm(`Remove ${m.name}?`) && call(() => api(ws, `/api/v1/members/${m.id}`, { method: 'DELETE' }), 'Member removed.')}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {canEdit && (
          <form
            className="flex flex-wrap items-end gap-2 border-t border-line px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              call(() => api(ws, '/api/v1/members', { body: invite }), `${invite.email} added.`).then(() => setInvite({ email: '', role: 'editor' }));
            }}
          >
            <Field label="Add member by email" className="min-w-[240px] flex-1">
              {(id) => <Input id={id} type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@company.com" />}
            </Field>
            <Select aria-label="Role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} className="w-32">
              {Object.keys(roleDescriptions).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <Button type="submit">Add</Button>
          </form>
        )}
        <dl className="grid gap-2 border-t border-line bg-canvas/60 px-5 py-4 text-xs sm:grid-cols-2">
          {Object.entries(roleDescriptions).map(([r, d]) => (
            <div key={r}>
              <dt className="font-semibold text-ink-2 capitalize">{r}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
