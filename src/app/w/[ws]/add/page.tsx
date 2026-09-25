import { redirect } from 'next/navigation';
import { AddFontTabs } from '@/components/add/add-tabs';
import { PageHeader } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { usingBlob } from '@/lib/storage';

export const metadata = { title: 'Add font' };

export default async function AddFontPage({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { ws } = await params;
  const { tab } = await searchParams;
  const actor = await getWorkspaceActor(ws);
  if (!actor.can('upload')) redirect(`/w/${ws}`);
  return (
    <>
      <PageHeader
        title="Add font"
        description="Pick a source. Every path ends on a review screen before anything is published."
      />
      <AddFontTabs
        ws={ws}
        workspaceId={actor.workspace.id}
        uploadMode={usingBlob() ? 'blob' : 'direct'}
        googleMode={actor.workspace.settings.googleMode}
        selfHostOnly={actor.workspace.settings.selfHostOnly}
        initialTab={tab === 'google' || tab === 'css' ? tab : 'upload'}
      />
    </>
  );
}
