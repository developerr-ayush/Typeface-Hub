'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { api } from '@/lib/client';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await api<{ workspace: { slug: string } | null }>(null, `/api/auth/${mode}`, {
        body: mode === 'signup' ? { name: form.name, email: form.email, password: form.password, workspace: form.workspace || undefined } : { email: form.email, password: form.password },
      });
      router.replace(res.workspace ? `/w/${res.workspace.slug}` : '/workspaces/new');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'login' ? 'Welcome back.' : 'You get a workspace for your fonts straight away.'}
        </p>
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      {mode === 'signup' && (
        <Field label="Your name">{(id) => <Input id={id} name="name" autoComplete="name" required />}</Field>
      )}
      <Field label="Email">{(id) => <Input id={id} name="email" type="email" autoComplete="email" required />}</Field>
      <Field
        label="Password"
        hint={
          mode === 'signup' ? (
            'At least 8 characters.'
          ) : (
            <Link href="/forgot-password" className="font-medium text-accent hover:underline">
              Forgot your password?
            </Link>
          )
        }
      >
        {(id) => <Input id={id} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} required />}
      </Field>
      {mode === 'signup' && (
        <Field label="Workspace name" hint="For example your company or a client property. You can add more later.">
          {(id) => <Input id={id} name="workspace" placeholder="Acme Studio" />}
        </Field>
      )}
      <Button type="submit" variant="primary" className="w-full" loading={loading}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </Button>
      <p className="text-center text-sm text-muted">
        {mode === 'login' ? (
          <>
            New here?{' '}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
