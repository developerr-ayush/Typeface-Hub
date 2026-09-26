'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Alert, Button, Card, CardHeader, Field, Input, useToast } from './ui';

export function AccountForms({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [nameError, setNameError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Profile" description={`Signed in as ${email}`} />
        <form
          className="space-y-4 px-5 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy('name');
            setNameError(null);
            try {
              await api(null, '/api/auth/account', { method: 'PATCH', body: { name: new FormData(e.currentTarget).get('name') } });
              toast('Name updated.');
              router.refresh();
            } catch (err) {
              setNameError((err as Error).message);
            }
            setBusy(null);
          }}
        >
          {nameError && <Alert tone="bad">{nameError}</Alert>}
          <Field label="Name">{(id) => <Input id={id} name="name" defaultValue={name} required />}</Field>
          <Button type="submit" variant="primary" loading={busy === 'name'}>
            Save
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Password" description="Changing it signs you out on your other devices." />
        <form
          className="space-y-4 px-5 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const form = new FormData(formEl);
            setPwError(null);
            if (form.get('next') !== form.get('confirm')) {
              setPwError('The new passwords don’t match.');
              return;
            }
            setBusy('pw');
            try {
              await api(null, '/api/auth/password', { body: { current: form.get('current'), next: form.get('next') } });
              formEl.reset();
              toast('Password changed.');
            } catch (err) {
              setPwError((err as Error).message);
            }
            setBusy(null);
          }}
        >
          {pwError && <Alert tone="bad">{pwError}</Alert>}
          <Field label="Current password">{(id) => <Input id={id} name="current" type="password" autoComplete="current-password" required />}</Field>
          <Field label="New password" hint="At least 8 characters.">
            {(id) => <Input id={id} name="next" type="password" autoComplete="new-password" minLength={8} required />}
          </Field>
          <Field label="Confirm new password">{(id) => <Input id={id} name="confirm" type="password" autoComplete="new-password" minLength={8} required />}</Field>
          <Button type="submit" variant="primary" loading={busy === 'pw'}>
            Change password
          </Button>
        </form>
      </Card>
    </div>
  );
}
