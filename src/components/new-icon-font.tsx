'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Button, useToast } from './ui';

export function NewIconFontButton({ ws, variant = 'primary' }: { ws: string; variant?: 'primary' | 'secondary' }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      loading={busy}
      onClick={async () => {
        const name = prompt('Name of the icon font (letters, digits and “-”)', 'icons');
        if (!name) return;
        setBusy(true);
        try {
          const row = await api<{ id: string }>(ws, '/api/v1/icon-fonts', { body: { name: name.trim().replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'icons' } });
          router.push(`/w/${ws}/icons/${row.id}`);
        } catch (e) {
          toast((e as Error).message, 'bad');
          setBusy(false);
        }
      }}
    >
      New icon font
    </Button>
  );
}
