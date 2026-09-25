import { Badge } from './ui';

const familyTone = { processing: 'accent', failed: 'bad', draft: 'warn', published: 'good', archived: 'neutral' } as const;
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={familyTone[status as keyof typeof familyTone] ?? 'neutral'} dot>
      {status[0].toUpperCase() + status.slice(1)}
    </Badge>
  );
}

const jobTone = { queued: 'neutral', processing: 'accent', ready: 'good', failed: 'bad' } as const;
export function JobBadge({ status }: { status: string }) {
  return (
    <Badge tone={jobTone[status as keyof typeof jobTone] ?? 'neutral'} dot>
      {status === 'ready' ? 'Ready' : status[0].toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function SourceBadge({ source, delivery }: { source: string; delivery?: string }) {
  const label = source === 'google' ? 'Google Fonts' : source === 'custom_url' ? 'Stylesheet URL' : 'Uploaded';
  return (
    <Badge tone="neutral">
      {label}
      {delivery === 'external' ? ' · external' : ''}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return <Badge tone={type === 'variable' ? 'accent' : 'neutral'}>{type === 'variable' ? 'Variable' : 'Static'}</Badge>;
}
