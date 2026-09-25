'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, CodeBlock, Input, Modal, timeAgo, useToast } from './ui';

interface Key {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

const SCOPES: [string, string][] = [
  ['delivery', 'Delivery: read published fonts, tokens and SDUI'],
  ['read', 'Read: everything in the management API'],
  ['write', 'Write: add fonts, edit drafts, families and tokens'],
  ['publish', 'Publish: publish, roll back and archive'],
];

export function ApiKeys({ ws, initial }: { ws: string; initial: Key[] }) {
  const toast = useToast();
  const [keys, setKeys] = useState(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['delivery']);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<Key & { token: string }>(ws, '/api/v1/api-keys', { body: { name, scopes } });
      setToken(res.token);
      setKeys((k) => [{ ...res, prefix: res.token.slice(0, 12), createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false }, ...k]);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader
        title="API keys"
        description="Delivery keys are read-only and safe for build pipelines; management keys can change the library."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setOpen(true);
              setToken(null);
              setName('');
              setScopes(['delivery']);
            }}
          >
            New key
          </Button>
        }
      />
      {keys.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No keys yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  {k.name}
                  {k.revoked && <Badge tone="bad">Revoked</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  <code>{k.prefix}…</code> · {k.scopes.join(', ')} · created {timeAgo(k.createdAt)} · {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : 'never used'}
                </div>
              </div>
              {!k.revoked && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Revoke “${k.name}”? Anything using it stops working immediately.`)) return;
                    try {
                      await api(ws, `/api/v1/api-keys/${k.id}`, { method: 'DELETE' });
                      setKeys((all) => all.map((x) => (x.id === k.id ? { ...x, revoked: true } : x)));
                      toast('Key revoked.');
                    } catch (e) {
                      toast((e as Error).message, 'bad');
                    }
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={token ? 'Copy your key now' : 'New API key'}
        description={token ? 'This is the only time the full key is shown.' : undefined}
        footer={
          token ? (
            <Button variant="primary" onClick={() => setOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={busy} disabled={!name.trim() || !scopes.length} onClick={create}>
                Create key
              </Button>
            </>
          )
        }
      >
        {token ? (
          <CodeBlock code={token} label="API key" />
        ) : (
          <div className="space-y-4">
            <Input aria-label="Key name" placeholder="e.g. Render API (production)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="space-y-2">
              {SCOPES.map(([s, l]) => (
                <Checkbox key={s} label={l} checked={scopes.includes(s)} onChange={(v) => setScopes((x) => (v ? [...x, s] : x.filter((y) => y !== s)))} />
              ))}
            </div>
            {error && <Alert tone="bad">{error}</Alert>}
          </div>
        )}
      </Modal>
    </Card>
  );
}
