import Link from 'next/link';
import { Logo } from './logo';

const nav = [
  { href: '/#features', label: 'Product' },
  { href: '/convert', label: 'Converter' },
  { href: '/docs', label: 'Docs' },
  { href: '/about', label: 'About' },
];

export function SiteHeader({ user, active }: { user?: { name: string } | null; active?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Typeface Hub home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active === n.href ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 font-medium ${active === n.href ? 'text-ink' : 'text-ink-2 hover:bg-black/5 hover:text-ink'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {user ? (
            <Link href="/" className="rounded-lg bg-ink px-3.5 py-2 font-medium text-white hover:bg-black">
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 font-medium text-ink-2 hover:bg-black/5 sm:block">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-lg bg-ink px-3.5 py-2 font-medium text-white hover:bg-black">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line/60 px-2 py-1 text-sm md:hidden" aria-label="Main (mobile)">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-3 py-1.5 font-medium text-ink-2">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

const footer = [
  { title: 'Product', links: [['Features', '/#features'], ['Free converter', '/convert'], ['Sign up', '/signup'], ['Changelog', '/changelog']] },
  { title: 'Docs', links: [['Introduction', '/docs'], ['Quick start', '/docs/quick-start'], ['CSS API', '/docs/css-api'], ['REST API', '/docs/rest-api']] },
  { title: 'Company', links: [['About', '/about'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['GitHub', 'https://github.com/developerr-ayush/Typeface-Hub']] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">Font management and delivery: add a font once, ship only what each page renders.</p>
        </div>
        {footer.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-muted sm:px-6">
          <span>© {new Date().getFullYear()} Typeface Hub</span>
          <span>Fonts are the property of their designers and foundries. Check each licence before using a font.</span>
        </div>
      </div>
    </footer>
  );
}
