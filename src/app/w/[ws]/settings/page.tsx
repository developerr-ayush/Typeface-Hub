import { WorkspaceSettingsForm } from '@/components/workspace-settings';
import { Alert, PageHeader } from '@/components/ui';
import { usingBlob, usingPrivateBlob } from '@/lib/storage';
import { getWorkspaceActor } from '@/lib/context';
import { roleDescriptions } from '@/lib/permissions';
import { listMembers } from '@/lib/workspaces';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const actor = await getWorkspaceActor(ws);
  const members = await listMembers(actor.workspace.id);
  return (
    <>
      <PageHeader title="Settings" description={`Workspace slug: ${actor.workspace.slug}`} />
      {actor.can('settings') && usingBlob() && !usingPrivateBlob() && (
        <div className="mb-6">
          <Alert tone="warn" title="Original font files are in a public store">
            Uploaded masters are stored at unguessable but public URLs. Create a private Vercel Blob store and set BLOB_PRIVATE_READ_WRITE_TOKEN to keep them private.
          </Alert>
        </div>
      )}
      <WorkspaceSettingsForm
        ws={ws}
        me={actor.user.id}
        canEdit={actor.can('settings')}
        name={actor.workspace.name}
        settings={actor.workspace.settings}
        members={members.map((m) => ({ ...m, since: m.since.toISOString() }))}
        roleDescriptions={roleDescriptions}
      />
    </>
  );
}
