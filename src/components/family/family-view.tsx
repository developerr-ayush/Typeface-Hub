'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SourceBadge, StatusBadge, TypeBadge } from '../status';
import { Badge, Button, Tabs, timeAgo } from '../ui';
import { EmbedPanel } from './embed';
import { ReviewPanel } from './review';
import { SettingsPanel } from './settings';
import { SpecimenPanel } from './specimen';
import { TesterPanel } from './tester';
import type { FamilyViewData } from './shared';
import { VersionsPanel } from './versions';

export type { FamilyViewData } from './shared';

type Tab = 'specimen' | 'tester' | 'review' | 'versions' | 'use' | 'settings' | 'activity';

export function FamilyView({ data }: { data: FamilyViewData }) {
  const router = useRouter();
  const { family, versions } = data;
  const current = versions.find((v) => v.id === family.currentVersionId) ?? null;
  const draft = versions.find((v) => v.status === 'draft') ?? null;
  const tabIds: Tab[] = ['specimen', 'tester', 'review', 'versions', 'use', 'settings', 'activity'];
  const [tab, setTab] = useState<Tab>(tabIds.includes(data.initialTab as Tab) ? (data.initialTab as Tab) : draft && !current ? 'review' : 'specimen');
  const [versionId, setVersionId] = useState<string>(
    versions.find((v) => v.id === data.initialVersion || String(v.number) === data.initialVersion)?.id ?? current?.id ?? draft?.id ?? versions[0]?.id ?? '',
  );
  const version = versions.find((v) => v.id === versionId) ?? versions[0];

  const change = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url);
  };
  const refresh = () => router.refresh();

  return (
    <div>
      <div className="mb-1 text-[13px] text-muted">
        <Link href={`/w/${data.ws}`} className="hover:text-ink">
          Library
        </Link>{' '}
        / {family.displayName}
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight text-ink" style={{ fontFamily: version ? `'${version.alias}', ${family.fallbackStack.join(', ')}` : undefined }}>
            {family.displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={family.status} />
            <TypeBadge type={family.type} />
            <SourceBadge source={family.source} delivery={family.delivery} />
            {current && <Badge tone="good">Live: v{current.number}</Badge>}
            {draft && <Badge tone="warn">Draft: v{draft.number}</Badge>}
            {family.licence.type ? <Badge>{family.licence.type} licence</Badge> : family.licence.confirmedAt ? <Badge>Self-hosting confirmed</Badge> : <Badge tone="warn">Licence not recorded</Badge>}
            <span className="text-xs text-muted">Updated {timeAgo(family.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {versions.length > 1 && (
            <div>
              <label htmlFor="version-select" className="mr-2 text-[13px] text-muted">
                Viewing
              </label>
              <select id="version-select" value={version?.id} onChange={(e) => setVersionId(e.target.value)} className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-sm">
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.number} · {v.status}
                  </option>
                ))}
              </select>
            </div>
          )}
          {version?.faces.some((f) => f.files.length) && (
            <Button
              size="sm"
              onClick={() => {
                change('use');
                setTimeout(() => document.getElementById('kit')?.scrollIntoView({ behavior: 'smooth' }), 50);
              }}
            >
              Download kit
            </Button>
          )}
        </div>
      </div>
      <Tabs
        className="mb-6"
        value={tab}
        onChange={change}
        tabs={[
          { id: 'specimen', label: 'Specimen' },
          { id: 'tester', label: 'Type tester' },
          { id: 'review', label: draft ? 'Review & publish' : 'Review' },
          { id: 'versions', label: 'Versions', count: versions.length },
          { id: 'use', label: 'Use' },
          { id: 'settings', label: 'Settings' },
          { id: 'activity', label: 'Activity' },
        ]}
      />
      {!version ? (
        <p className="text-sm text-muted">This family has no versions yet.</p>
      ) : (
        <>
          {tab === 'specimen' && <SpecimenPanel family={family} version={version} />}
          {tab === 'tester' && <TesterPanel family={family} version={version} />}
          {tab === 'review' && <ReviewPanel data={data} version={draft && version.status !== 'draft' && !data.initialVersion ? draft : version} current={current} onChange={refresh} onSelect={setVersionId} />}
          {tab === 'versions' && <VersionsPanel data={data} onChange={refresh} onView={(id) => { setVersionId(id); change('specimen'); }} />}
          {tab === 'use' && <EmbedPanel data={data} version={current ?? version} kitVersion={version} />}
          {tab === 'settings' && <SettingsPanel data={data} onChange={refresh} />}
          {tab === 'activity' && (
            <ol className="space-y-2">
              {data.events.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
              {data.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-ink">{e.actor}</span> <span className="text-ink-2">{e.action.replace(/[._]/g, ' ')}</span>{' '}
                    <span className="text-muted">{e.label}</span>
                  </span>
                  <time className="text-xs text-muted" dateTime={e.at} title={new Date(e.at).toLocaleString()}>
                    {timeAgo(e.at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
