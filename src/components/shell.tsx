'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './logo';
import { cx } from './ui';

const icons: Record<string, React.ReactNode> = {
  library: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h2A1.5 1.5 0 0 1 9 5.5v13A1.5 1.5 0 0 1 7.5 20h-2A1.5 1.5 0 0 1 4 18.5zM11 5.5A1.5 1.5 0 0 1 12.5 4h2A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5zM17.6 6.2l1.9-.6a1.5 1.5 0 0 1 1.9 1l3 10" />,
  add: <path d="M12 5v14M5 12h14" />,
  type: <path d="M4 7V5h16v2M9 19h6M12 5v14" />,
  jobs: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2" />,
  code: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {icons[name]}
    </svg>
  );
}

export function Shell({
  ws,
  workspaces,
  user,
  role,
  runningJobs,
  children,
}: {
  ws: { slug: string; name: string };
  workspaces: { slug: string; name: string }[];
  user: { name: string; email: string };
  role: string;
  runningJobs: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const base = `/w/${ws.slug}`;
  const nav = [
    { href: base, label: 'Library', icon: 'library', exact: true },
    { href: `${base}/add`, label: 'Add font', icon: 'add' },
    { href: `${base}/typography`, label: 'Typography', icon: 'type' },
    { href: `${base}/jobs`, label: 'Jobs', icon: 'jobs', badge: runningJobs || undefined },
    { href: `${base}/developers`, label: 'Developers', icon: 'code' },
    { href: `${base}/monitoring`, label: 'Monitoring', icon: 'chart' },
    { href: `${base}/activity`, label: 'Activity', icon: 'activity' },
    { href: `${base}/settings`, label: 'Settings', icon: 'settings' },
  ];
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href || pathname.startsWith(`${base}/families`) : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3">
        <Link href="/" className="block">
          <Logo className="text-[15px]" />
        </Link>
      </div>
      <div className="px-3 pb-3">
        <label className="sr-only" htmlFor="ws-switch">
          Workspace
        </label>
        <select
          id="ws-switch"
          value={ws.slug}
          onChange={(e) => (e.target.value === '__new' ? router.push('/workspaces/new') : router.push(`/w/${e.target.value}`))}
          className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm font-medium text-ink shadow-sm"
        >
          {workspaces.map((w) => (
            <option key={w.slug} value={w.slug}>
              {w.name}
            </option>
          ))}
          <option value="__new">+ New workspace…</option>
        </select>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Workspace">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(n.href, n.exact) ? 'page' : undefined}
            className={cx(
              'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
              isActive(n.href, n.exact) ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
            )}
          >
            <Icon name={n.icon} />
            <span className="flex-1">{n.label}</span>
            {n.badge && <span className="rounded-full bg-accent px-1.5 text-[11px] leading-4 font-semibold text-white">{n.badge}</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-line px-4 py-3">
        <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
        <div className="truncate text-xs text-muted">
          {user.email} · {role}
        </div>
        <button
          type="button"
          className="mt-2 text-xs font-medium text-muted hover:text-ink"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.replace('/login');
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-canvas lg:block">{sidebar}</aside>
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo className="text-[15px]" />
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium" aria-expanded={open}>
          Menu
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-canvas shadow-xl">{sidebar}</div>
        </div>
      )}
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
