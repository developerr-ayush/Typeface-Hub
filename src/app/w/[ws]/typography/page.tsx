import { and, eq, ne } from 'drizzle-orm';
import { externalPreviewLink, PreviewStyles } from '@/components/font-preview';
import { TokenEditor } from '@/components/token-editor';
import { PageHeader } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { facesForVersions, previewAlias, previewCss, requestOrigin } from '@/lib/delivery';
import { listThemes, getTokenSet } from '@/lib/typography';

export const metadata = { title: 'Typography' };

export default async function TypographyPage({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ theme?: string }> }) {
  const { ws } = await params;
  const { theme = 'default' } = await searchParams;
  const actor = await getWorkspaceActor(ws);
  const [themes, set] = await Promise.all([listThemes(actor.workspace.id), getTokenSet(actor.workspace.id, theme)]);
  const fams = await db
    .select()
    .from(schema.families)
    .where(and(eq(schema.families.workspaceId, actor.workspace.id), ne(schema.families.status, 'archived')))
    .orderBy(schema.families.displayName);
  const withVersion = fams.filter((f) => f.currentVersionId);
  const faces = await facesForVersions(withVersion.map((f) => f.currentVersionId!));

  const css = withVersion
    .filter((f) => faces.get(f.currentVersionId!)?.some((x) => x.files.length))
    .map((f) => previewCss(previewAlias(f.id), faces.get(f.currentVersionId!) ?? [], { subsets: ['latin', 'latin-ext', 'all'] }))
    .join('\n');
  const links = withVersion
    .filter((f) => f.delivery === 'external')
    .map((f) => externalPreviewLink(f))
    .filter(Boolean) as string[];

  return (
    <>
      <PreviewStyles css={css} links={links} />
      <PageHeader
        title="Typography"
        description="Font roles and text styles for this workspace. Widgets reference roles like “heading”, so a rebrand is one change here."
      />
      <TokenEditor
        ws={ws}
        origin={await requestOrigin()}
        canEdit={actor.can('edit')}
        themes={themes.includes(theme) ? themes : [...themes, theme]}
        theme={theme}
        initial={{ roles: set.roles, textStyles: set.textStyles, breakpoints: set.breakpoints }}
        saved={Boolean(set.updatedAt)}
        families={fams.map((f) => {
          const fc = f.currentVersionId ? faces.get(f.currentVersionId) ?? [] : [];
          const internal = fc.some((x) => x.files.length);
          return {
            id: f.id,
            name: f.displayName,
            cssName: f.cssName,
            status: f.status,
            delivery: f.delivery,
            fallbackStack: f.fallbackStack,
            preview: f.currentVersionId ? (internal ? previewAlias(f.id) : f.cssName) : null,
            weights: fc.flatMap((x) => (x.axes.length ? [[x.weightMin, x.weightMax] as [number, number]] : [[x.weightMin, x.weightMin] as [number, number]])),
            italic: fc.some((x) => x.style === 'italic'),
          };
        })}
      />
    </>
  );
}
