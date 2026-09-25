import type { Axis, ExternalConfig, FallbackMetrics, Licence, VersionReport } from '@/lib/db/schema';

export interface FaceData {
  id: string;
  name: string;
  style: 'normal' | 'italic';
  weightMin: number;
  weightMax: number;
  stretchMin: number;
  stretchMax: number;
  axes: Axis[];
  namedInstances: { name: string; coords: Record<string, number> }[];
  glyphCount: number;
  scripts: string[];
  metrics: FallbackMetrics | null;
  masterBytes: number;
  masterFormat: string | null;
  sourceFile: string | null;
  files: { name: string; format: string; subset: string; bytes: number; glyphs: number }[];
}
export interface VersionData {
  id: string;
  number: number;
  status: string;
  note: string | null;
  author: string | null;
  createdAt: string;
  publishedAt: string | null;
  report: VersionReport | null;
  alias: string;
  faces: FaceData[];
}
export interface FamilyViewData {
  ws: string;
  origin: string;
  family: {
    id: string;
    slug: string;
    displayName: string;
    cssName: string;
    source: string;
    delivery: string;
    type: string;
    category: string;
    fallbackStack: string[];
    display: string;
    tags: string[];
    status: string;
    currentVersionId: string | null;
    external: ExternalConfig | null;
    licence: Licence;
    createdAt: string;
    updatedAt: string;
  };
  versions: VersionData[];
  usage: { theme: string; role: string; styles: string[] }[];
  events: { id: number; action: string; actor: string; label: string | null; at: string; after: Record<string, unknown> | null }[];
  can: { upload: boolean; edit: boolean; publish: boolean; licence: boolean; delete: boolean };
  initialTab?: string;
  initialVersion?: string;
}

export const fontStack = (alias: string, fallback: string[]) => `'${alias}', ${fallback.map((f) => (/[\s]/.test(f) ? `'${f}'` : f)).join(', ')}`;

export function weightLabel(f: Pick<FaceData, 'weightMin' | 'weightMax'>) {
  return f.weightMin === f.weightMax ? String(f.weightMin) : `${f.weightMin}–${f.weightMax}`;
}
