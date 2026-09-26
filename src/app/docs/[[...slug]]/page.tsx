import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CopyCodeButtons } from '@/components/copy-code';
import { DocsSidebar } from '@/components/docs-sidebar';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { DOCS_NAV, DOCS_PAGES } from '@/content/docs/nav';
import { getUser } from '@/lib/auth';
import { loadContent } from '@/lib/markdown';

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS_PAGES.map((p) => ({ slug: p.slug ? [p.slug] : [] }));
}

async function load(slug?: string[]) {
  const key = slug?.join('/') ?? '';
  const page = DOCS_PAGES.find((p) => p.slug === key);
  if (!page) notFound();
  const content = await loadContent(`docs/${key || 'index'}.md`);
  return { page, content };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page, content } = await load((await params).slug);
  return { title: `${content.meta.title ?? page.title} · Docs`, description: content.meta.description };
}

export default async function DocsPage({ params }: Props) {
  const { slug } = await params;
  const { page, content } = await load(slug);
  const user = await getUser().catch(() => null);
  const index = DOCS_PAGES.findIndex((p) => p.slug === page.slug);
  const prev = DOCS_PAGES[index - 1];
  const next = DOCS_PAGES[index + 1];
  const href = (s: string) => (s ? `/docs/${s}` : '/docs');

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader user={user} active="/docs" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px]">
        <DocsSidebar nav={DOCS_NAV} current={page.slug} />
        <main id="main" className="min-w-0 py-10">
          <div className="mb-2 text-[13px] font-medium text-accent">{page.section}</div>
          <article className="prose max-w-3xl" dangerouslySetInnerHTML={{ __html: content.html }} />
          <CopyCodeButtons />
          <nav className="mt-14 grid max-w-3xl gap-3 border-t border-line pt-6 sm:grid-cols-2" aria-label="Previous and next page">
            {prev ? (
              <Link href={href(prev.slug)} className="rounded-xl border border-line p-4 hover:border-line-strong">
                <div className="text-xs text-muted">Previous</div>
                <div className="font-medium text-ink">{prev.title}</div>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={href(next.slug)} className="rounded-xl border border-line p-4 text-right hover:border-line-strong">
                <div className="text-xs text-muted">Next</div>
                <div className="font-medium text-ink">{next.title}</div>
              </Link>
            )}
          </nav>
          <p className="mt-8 max-w-3xl text-xs text-muted">
            Found something wrong?{' '}
            <a className="text-accent hover:underline" href={`https://github.com/developerr-ayush/Typeface-Hub/edit/main/src/content/docs/${page.slug || 'index'}.md`} target="_blank" rel="noreferrer">
              Edit this page on GitHub
            </a>
            .
          </p>
        </main>
        <aside className="hidden py-10 xl:block">
          {content.headings.length > 1 && (
            <div className="sticky top-24">
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">On this page</div>
              <ul className="space-y-1.5 text-[13px]">
                {content.headings.map((h) => (
                  <li key={h.id} className={h.depth === 3 ? 'pl-3' : ''}>
                    <a href={`#${h.id}`} className="text-ink-2 hover:text-accent">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
      <SiteFooter />
    </div>
  );
}
