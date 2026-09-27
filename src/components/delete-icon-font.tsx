'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Button, useToast } from './ui';

export function DeleteIconFontButton({ ws, id, name }: { ws: string; id: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      loading={busy}
      onClick={async () => {
        if (!confirm(`Delete the icon font “${name}”? Sites using its stylesheet will stop showing the icons.`)) return;
        setBusy(true);
        try {
          await api(ws, `/api/v1/icon-fonts/${id}`, { method: 'DELETE' });
          router.push(`/w/${ws}/icons`);
          router.refresh();
        } catch (e) {
          toast((e as Error).message, 'bad');
          setBusy(false);
        }
      }}
    >
      Delete
    </Button>
  );
}
