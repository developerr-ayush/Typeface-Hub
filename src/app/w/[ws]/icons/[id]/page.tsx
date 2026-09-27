import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteIconFontButton } from '@/components/delete-icon-font';
import { IconEditor } from '@/components/icon-editor';
import { PageHeader } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { requestOrigin } from '@/lib/delivery';
import { HttpError } from '@/lib/http';
import { getIconFont } from '@/lib/icons/workspace';

export const metadata = { title: 'Icon font' };

export default async function IconFontPage({ params }: { params: Promise<{ ws: string; id: string }> }) {
  const { ws, id } = await params;
  const actor = await getWorkspaceActor(ws);
  const font = await getIconFont(actor.workspace.id, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const origin = await requestOrigin();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/w/${ws}/icons`} className="hover:text-ink">
            ← Icon fonts
          </Link>
        }
        title={font.config.name}
        description="Pick icons, name them, then publish. Published fonts are served from one stylesheet; the ZIP has the files to self-host."
        actions={actor.can('delete') ? <DeleteIconFontButton ws={ws} id={font.id} name={font.config.name} /> : undefined}
      />
      <IconEditor
        mode="workspace"
        ws={ws}
        id={font.id}
        initial={font.config}
        published={font.published}
        cssUrl={`${origin}/fonts/${ws}/icons/${font.slug}.css`}
        canEdit={actor.can('edit')}
        canPublish={actor.can('publish')}
      />
    </>
  );
}
