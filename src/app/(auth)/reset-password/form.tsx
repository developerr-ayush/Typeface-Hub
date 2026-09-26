'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { api } from '@/lib/client';

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!token) {
    return (
      <div className="space-y-4">
        <Alert tone="bad">This reset link is incomplete. Open the link from your email again, or ask for a new one.</Alert>
        <Link href="/forgot-password" className="block text-center text-sm font-medium text-accent hover:underline">
          Ask for a new link
        </Link>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const form = new FormData(e.currentTarget);
        const password = form.get('password') as string;
        if (password !== form.get('confirm')) {
          setError('The passwords don’t match.');
          return;
        }
        setLoading(true);
        try {
          const res = await api<{ workspace: { slug: string } | null }>(null, '/api/auth/reset', { body: { token, password } });
          router.replace(res.workspace ? `/w/${res.workspace.slug}` : '/workspaces/new');
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setLoading(false);
        }
      }}
    >
      <div>
        <h1 className="text-lg font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">You&apos;ll be signed out on your other devices.</p>
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      <Field label="New password" hint="At least 8 characters.">
        {(id) => <Input id={id} name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />}
      </Field>
      <Field label="Confirm new password">{(id) => <Input id={id} name="confirm" type="password" autoComplete="new-password" minLength={8} required />}</Field>
      <Button type="submit" variant="primary" className="w-full" loading={loading}>
        Save password
      </Button>
      {error?.includes('expired') && (
        <Link href="/forgot-password" className="block text-center text-sm font-medium text-accent hover:underline">
          Ask for a new link
        </Link>
      )}
    </form>
  );
}
