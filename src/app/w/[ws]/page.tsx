import { formatBytes, timeAgo } from '@/lib/format';
import Link from 'next/link';
import { Suspense } from 'react';
import { FilterBar } from '@/components/filter-bar';
import { externalPreviewLink, PreviewStyles } from '@/components/font-preview';
import { SourceBadge, StatusBadge, TypeBadge } from '@/components/status';
import { Badge, ButtonLink, EmptyState, PageHeader } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { previewAlias, previewCss } from '@/lib/delivery';
import { listFamilies } from '@/lib/families';

export const metadata = { title: 'Library' };

type SP = Promise<Record<string, string | undefined>>;

export default async function LibraryPage({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: SP }) {
  const { ws } = await params;
  const sp = await searchParams;
  const actor = await getWorkspaceActor(ws);
  const rows = await listFamilies(actor.workspace.id, {
    q: sp.q,
    source: sp.source,
    type: sp.type,
    status: sp.status,
    licence: sp.licence as 'missing' | 'recorded' | undefined,
    used: sp.used as 'used' | 'unused' | undefined,
  });
  const filtered = Object.values(sp).some(Boolean);

  const css = rows
    .filter((r) => r.family.delivery === 'internal' || r.faces.some((f) => f.files.length))
    .map((r) => previewCss(previewAlias(r.family.id), r.faces, { subsets: ['latin', 'all'] }))
    .join('\n');
  const links = rows
    .filter((r) => r.family.delivery === 'external' && !r.faces.some((f) => f.files.length))
    .map((r) => externalPreviewLink(r.family, `Aa${r.family.displayName}The quick brown fox jumps over the lazy dog`))
    .filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title="Library"
        description="Every family in this workspace. Specimens load only the Latin subset."
        actions={actor.can('upload') && <ButtonLink href={`/w/${ws}/add`} variant="primary">Add font</ButtonLink>}
      />
      <Suspense>
        <FilterBar
          filters={[
            { name: 'source', label: 'All sources', options: [['internal', 'Uploaded'], ['google', 'Google Fonts'], ['custom_url', 'Stylesheet URL']] },
            { name: 'type', label: 'All types', options: [['static', 'Static'], ['variable', 'Variable']] },
            { name: 'status', label: 'Any status', options: [['published', 'Published'], ['draft', 'Draft'], ['processing', 'Processing'], ['failed', 'Failed'], ['archived', 'Archived']] },
            { name: 'licence', label: 'Any licence', options: [['recorded', 'Licence recorded'], ['missing', 'Licence missing']] },
            { name: 'used', label: 'Used or unused', options: [['used', 'Used in tokens'], ['unused', 'Unused']] },
          ]}
        />
      </Suspense>
      <PreviewStyles css={css} links={links} />
      {rows.length === 0 ? (
        filtered ? (
          <EmptyState title="No families match these filters" description="Try a different search or clear the filters." action={<ButtonLink href={`/w/${ws}`}>Clear filters</ButtonLink>} />
        ) : (
          <EmptyState
            title="Your library is empty"
            description="Upload font files, pick from Google Fonts, or import an existing stylesheet. Conversion and subsetting happen automatically."
            action={actor.can('upload') && <ButtonLink href={`/w/${ws}/add`} variant="primary">Add your first font</ButtonLink>}
          />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const f = r.family;
            const fontFamily =
              f.delivery === 'external' && !r.faces.some((x) => x.files.length) ? `'${f.cssName}', ${f.fallbackStack.join(', ')}` : `'${previewAlias(f.id)}', ${f.fallbackStack.join(', ')}`;
            return (
              <li key={f.id}>
                <Link
                  href={`/w/${ws}/families/${f.slug}`}
                  className="group block h-full rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:border-line-strong hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-ink group-hover:text-accent">{f.displayName}</h2>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <StatusBadge status={f.status} />
                        <TypeBadge type={f.type} />
                        <SourceBadge source={f.source} delivery={f.delivery} />
                        {r.pendingDraft && <Badge tone="warn">Draft v{r.latestVersion?.number} pending</Badge>}
                      </div>
                    </div>
                    <span className="text-5xl leading-none text-ink" style={{ fontFamily }} aria-hidden>
                      Aa
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-2 min-h-[3.5rem] text-[22px] leading-snug text-ink-2" style={{ fontFamily }}>
                    The quick brown fox jumps over the lazy dog
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                    <div>
                      <dt className="text-muted">Faces</dt>
                      <dd className="font-medium text-ink tabular-nums">{r.facesCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">WOFF2 size</dt>
                      <dd className="font-medium text-ink tabular-nums">{f.delivery === 'external' && !r.woff2Bytes ? 'External' : formatBytes(r.woff2Bytes)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Used by</dt>
                      <dd className="font-medium text-ink tabular-nums">{r.usage.length ? `${r.usage.length} role${r.usage.length > 1 ? 's' : ''}` : '—'}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
