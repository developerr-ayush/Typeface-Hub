import { and, desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { FamilyView, type FamilyViewData } from '@/components/family/family-view';
import { externalPreviewLink, PreviewStyles } from '@/components/font-preview';
import { getWorkspaceActor } from '@/lib/context';
import { db, schema } from '@/lib/db';
import { previewAlias, previewCss, requestOrigin } from '@/lib/delivery';
import { getFamilyDetail } from '@/lib/families';
import { HttpError } from '@/lib/http';

export async function generateMetadata({ params }: { params: Promise<{ ws: string; slug: string }> }) {
  return { title: decodeURIComponent((await params).slug) };
}

export default async function FamilyPage({ params, searchParams }: { params: Promise<{ ws: string; slug: string }>; searchParams: Promise<{ tab?: string; v?: string }> }) {
  const { ws, slug } = await params;
  const sp = await searchParams;
  const actor = await getWorkspaceActor(ws);
  const detail = await getFamilyDetail(actor.workspace.id, decodeURIComponent(slug)).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const { family, versions, usage } = detail;
  const events = await db
    .select()
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.workspaceId, actor.workspace.id), eq(schema.auditEvents.targetId, family.id)))
    .orderBy(desc(schema.auditEvents.id))
    .limit(50);

  const css = versions
    .filter((v) => v.faces.some((f) => f.files.length))
    .map((v) => previewCss(previewAlias(v.id), v.faces))
    .join('\n');
  const external = versions.some((v) => v.faces.length && !v.faces.some((f) => f.files.length)) ? externalPreviewLink(family) : null;

  const data: FamilyViewData = {
    ws,
    origin: await requestOrigin(),
    family: {
      id: family.id,
      slug: family.slug,
      displayName: family.displayName,
      cssName: family.cssName,
      source: family.source,
      delivery: family.delivery,
      type: family.type,
      category: family.category,
      fallbackStack: family.fallbackStack,
      display: family.display,
      tags: family.tags,
      status: family.status,
      currentVersionId: family.currentVersionId,
      external: family.external,
      licence: family.licence,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
    },
    versions: versions.map((v) => ({
      id: v.id,
      number: v.number,
      status: v.status,
      note: v.note,
      author: v.author,
      createdAt: v.createdAt.toISOString(),
      publishedAt: v.publishedAt?.toISOString() ?? null,
      report: v.report,
      alias: v.faces.some((f) => f.files.length) ? previewAlias(v.id) : family.cssName,
      faces: v.faces.map((f) => ({
        id: f.id,
        name: f.name,
        style: f.style,
        weightMin: f.weightMin,
        weightMax: f.weightMax,
        stretchMin: f.stretchMin,
        stretchMax: f.stretchMax,
        axes: f.axes,
        namedInstances: f.namedInstances,
        glyphCount: f.glyphCount,
        scripts: f.scripts,
        metrics: f.metrics,
        masterBytes: f.masterBytes,
        masterFormat: f.masterFormat,
        sourceFile: f.sourceFile,
        files: f.files.map((x) => ({ name: x.name, format: x.format, subset: x.subset, bytes: x.bytes, glyphs: x.glyphs })),
      })),
    })),
    usage,
    events: events.map((e) => ({ id: e.id, action: e.action, actor: e.actorLabel, label: e.targetLabel, at: e.at.toISOString(), after: e.after as Record<string, unknown> | null })),
    can: {
      upload: actor.can('upload'),
      edit: actor.can('edit'),
      publish: actor.can('publish'),
      licence: actor.can('licence'),
      delete: actor.can('delete'),
    },
    initialTab: sp.tab,
    initialVersion: sp.v,
  };

  return (
    <>
      <PreviewStyles css={css} links={external ? [external] : []} />
      <FamilyView data={data} />
    </>
  );
}
