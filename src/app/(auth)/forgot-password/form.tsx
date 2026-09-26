'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { api } from '@/lib/client';

export function ForgotForm() {
  const [sent, setSent] = useState<{ link?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-sm text-muted">If an account uses that address, we&apos;ve sent a link to reset the password. It works for one hour.</p>
        <p className="text-xs text-muted">Running Typeface Hub yourself without email set up? The link is written to the server log (for Docker: <code>docker compose logs app</code>).</p>
        {sent.link && (
          <Alert tone="neutral" title="Test mode">
            <a className="break-all text-accent underline" href={sent.link}>
              {sent.link}
            </a>
          </Alert>
        )}
        <Link href="/login" className="block text-center text-sm font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const email = new FormData(e.currentTarget).get('email') as string;
          setSent(await api<{ link?: string }>(null, '/api/auth/forgot', { body: { email } }));
        } catch (err) {
          setError((err as Error).message);
        }
        setLoading(false);
      }}
    >
      <div>
        <h1 className="text-lg font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      <Field label="Email">{(id) => <Input id={id} name="email" type="email" autoComplete="email" required autoFocus />}</Field>
      <Button type="submit" variant="primary" className="w-full" loading={loading}>
        Send reset link
      </Button>
      <Link href="/login" className="block text-center text-sm font-medium text-accent hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
