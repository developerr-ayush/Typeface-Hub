import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';

export const metadata: Metadata = { title: 'Page not found' };

const links = [
  ['/', 'Home'],
  ['/convert', 'Font converter'],
  ['/icons', 'Icon font generator'],
  ['/docs', 'Docs'],
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <Link href="/" aria-label="Typeface Hub home">
        <LogoMark size={44} />
      </Link>
      <p className="mt-8 text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-muted">This page doesn’t exist, has moved, or belongs to a workspace you’re not a member of.</p>
      <nav className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Suggested pages">
        {links.map(([href, label], i) => (
          <Link
            key={href}
            href={href}
            className={i === 0 ? 'rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong' : 'rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas'}
          >
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
