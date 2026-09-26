'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { api } from '@/lib/client';

export function NewWorkspaceForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const name = new FormData(e.currentTarget).get('name') as string;
          const res = await api<{ workspace: { slug: string } }>(null, '/api/workspaces', { body: { name } });
          router.push(`/w/${res.workspace.slug}`);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setLoading(false);
        }
      }}
    >
      <div>
        <h1 className="text-lg font-semibold">New workspace</h1>
        <p className="mt-1 text-sm text-muted">Each workspace has its own private font library, tokens and API keys.</p>
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      <Field label="Workspace name">{(id) => <Input id={id} name="name" required minLength={2} autoFocus placeholder="Acme Studio" />}</Field>
      <Button type="submit" variant="primary" className="w-full" loading={loading}>
        Create workspace
      </Button>
    </form>
  );
}
