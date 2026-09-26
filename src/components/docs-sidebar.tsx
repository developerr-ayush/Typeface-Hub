'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cx } from './ui';

export function DocsSidebar({ nav, current }: { nav: { title: string; items: { slug: string; title: string }[] }[]; current: string }) {
  const [open, setOpen] = useState(false);
  const links = (
    <nav aria-label="Documentation" className="space-y-6">
      {nav.map((section) => (
        <div key={section.title}>
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{section.title}</div>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.slug}>
                <Link
                  href={item.slug ? `/docs/${item.slug}` : '/docs'}
                  onClick={() => setOpen(false)}
                  aria-current={item.slug === current ? 'page' : undefined}
                  className={cx(
                    'block rounded-md px-2.5 py-1.5 text-[13.5px]',
                    item.slug === current ? 'bg-accent-soft font-medium text-accent-strong' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
                  )}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <div className="pt-6 lg:hidden">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm font-medium">
          {open ? 'Close menu' : 'Docs menu'}
        </button>
        {open && <div className="mt-3 rounded-xl border border-line p-4">{links}</div>}
      </div>
      <aside className="hidden border-r border-line py-10 pr-4 lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin">{links}</div>
      </aside>
    </>
  );
}
