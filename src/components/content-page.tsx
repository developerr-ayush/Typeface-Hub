import { SiteFooter, SiteHeader } from './site-chrome';
import { getUser } from '@/lib/auth';
import { loadContent } from '@/lib/markdown';
import { CopyCodeButtons } from './copy-code';

/** A long-form page rendered from src/content/{file}.md with the site header and footer. */
export async function ContentPage({ file, active, wide }: { file: string; active?: string; wide?: boolean }) {
  const [content, user] = await Promise.all([loadContent(file), getUser().catch(() => null)]);
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SiteHeader user={user} active={active} />
      <main id="main" className="flex-1">
        <div className={`mx-auto px-4 py-14 sm:px-6 ${wide ? 'max-w-4xl' : 'max-w-3xl'}`}>
          {content.meta.updated && <p className="mb-3 text-sm text-muted">Last updated {content.meta.updated}</p>}
          <article className="prose" dangerouslySetInnerHTML={{ __html: content.html }} />
          <CopyCodeButtons />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export async function contentMetadata(file: string) {
  const { meta } = await loadContent(file);
  return { title: meta.title, description: meta.description };
}
