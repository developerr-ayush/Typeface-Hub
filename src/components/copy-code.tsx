'use client';

import { useEffect } from 'react';

/** Wires up the Copy buttons rendered inside Markdown code blocks. */
export function CopyCodeButtons() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.copy-code') as HTMLButtonElement | null;
      if (!btn) return;
      const code = btn.closest('.code')?.querySelector('code')?.textContent ?? '';
      navigator.clipboard?.writeText(code).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = 'Copy'), 1200);
      });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
