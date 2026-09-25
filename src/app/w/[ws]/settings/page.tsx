import { WorkspaceSettingsForm } from '@/components/workspace-settings';
import { PageHeader } from '@/components/ui';
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
