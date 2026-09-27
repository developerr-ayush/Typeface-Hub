import Link from 'next/link';
import { NewIconFontButton } from '@/components/new-icon-font';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { formatBytes, timeAgo } from '@/lib/format';
import { getWorkspaceActor } from '@/lib/context';
import { listIconFonts } from '@/lib/icons/workspace';

export const metadata = { title: 'Icon fonts' };

export default async function IconFontsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const actor = await getWorkspaceActor(ws);
  const fonts = await listIconFonts(actor.workspace.id);
  const canEdit = actor.can('edit');
  return (
    <>
      <PageHeader
        title="Icon fonts"
        description="Build icon fonts from open-source sets or your own SVGs, publish them, and use them on every site with one stylesheet link. Fontello config.json files open here too."
        actions={canEdit && fonts.length > 0 ? <NewIconFontButton ws={ws} /> : undefined}
      />
      {fonts.length === 0 ? (
        <EmptyState
          title="No icon fonts yet"
          description="Pick icons from Font Awesome, Material Design Icons, Bootstrap Icons and more, or upload SVGs. Each font gets its own stylesheet link when you publish it."
          action={canEdit ? <NewIconFontButton ws={ws} /> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fonts.map((f) => (
            <Link key={f.id} href={`/w/${ws}/icons/${f.id}`} className="group">
              <Card className="h-full p-4 transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-ink">{f.config.name}</h2>
                    <p className="font-mono text-xs text-muted">{f.config.suffix ? `name${f.config.prefix}` : `${f.config.prefix}name`}</p>
                  </div>
                  {f.published ? <Badge tone="good" dot>Published</Badge> : <Badge>Draft</Badge>}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 text-ink" aria-hidden>
                  {f.config.glyphs.slice(0, 16).map((g) => (
                    <svg key={g.uid} viewBox={`0 0 ${g.width ?? 1000} 1000`} className="h-5 fill-current">
                      {g.d && <path d={g.d} />}
                    </svg>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted">
                  {f.config.glyphs.length} icons
                  {f.published && ` · ${formatBytes(f.published.bytes)} WOFF2`} · updated {timeAgo(f.updatedAt)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
