import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export type Role = 'viewer' | 'editor' | 'publisher' | 'admin';
export type FamilySource = 'internal' | 'google' | 'custom_url';
export type Delivery = 'internal' | 'external';
export type FamilyType = 'static' | 'variable';
export type FamilyStatus = 'processing' | 'failed' | 'draft' | 'published' | 'archived';
export type VersionStatus = 'processing' | 'failed' | 'draft' | 'published' | 'archived';
export type JobStatus = 'queued' | 'processing' | 'ready' | 'failed';
export type JobKind = 'upload' | 'google_import' | 'css_import' | 'reprocess';

export interface WorkspaceSettings {
  googleMode: 'external' | 'import';
  selfHostOnly: boolean;
  defaultDisplay: 'swap' | 'optional' | 'fallback' | 'block' | 'auto';
}

export interface Axis {
  tag: string;
  name?: string;
  min: number;
  max: number;
  default: number;
}

export interface FallbackMetrics {
  fallback: string; // local() font used as the metric-adjusted fallback
  sizeAdjust: number; // percentages
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
}

export interface Licence {
  type?: 'OFL' | 'Apache' | 'UFL' | 'commercial' | 'client-owned' | 'other';
  owner?: string;
  allowedDomains?: string[];
  expiresAt?: string | null;
  notes?: string;
  documentUrl?: string;
  detected?: { license?: string; licenseUrl?: string; vendor?: string; copyright?: string };
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface ExternalConfig {
  provider: 'google' | 'css';
  family?: string; // Google family name
  cssUrl?: string; // custom stylesheet URL
  axes?: Axis[];
}

export interface VersionReport {
  inputBytes: number;
  outputBytes: number; // WOFF2 total across subsets
  woffBytes: number;
  faces: number;
  files: number;
  subsets: string[];
  warnings: string[];
  durationMs: number;
  perFace: {
    faceId?: string;
    name: string;
    source: string;
    masterBytes: number;
    woff2Bytes: number;
    woffBytes: number;
    subsets: { subset: string; glyphs: number; woff2: number; woff: number }[];
  }[];
  axisLimits?: Record<string, { min: number; max: number } | number>;
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  settings: jsonb('settings').$type<WorkspaceSettings>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  'memberships',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<Role>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const families = pgTable(
  'families',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    cssName: text('css_name').notNull(), // the font-family name used in CSS and the CSS API
    source: text('source').$type<FamilySource>().notNull(),
    delivery: text('delivery').$type<Delivery>().notNull().default('internal'),
    type: text('type').$type<FamilyType>().notNull().default('static'),
    category: text('category').notNull().default('sans-serif'),
    fallbackStack: jsonb('fallback_stack').$type<string[]>().notNull(),
    display: text('display').notNull().default('swap'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    status: text('status').$type<FamilyStatus>().notNull().default('processing'),
    currentVersionId: uuid('current_version_id'),
    external: jsonb('external').$type<ExternalConfig | null>(),
    licence: jsonb('licence').$type<Licence>().notNull().default({}),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('families_ws_slug').on(t.workspaceId, t.slug),
    index('families_ws_css').on(t.workspaceId, t.cssName),
  ],
);

export const versions = pgTable(
  'versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    status: text('status').$type<VersionStatus>().notNull(),
    jobId: uuid('job_id'),
    note: text('note'),
    report: jsonb('report').$type<VersionReport | null>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('versions_family_number').on(t.familyId, t.number)],
);

export const faces = pgTable(
  'faces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    versionId: uuid('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // subfamily, e.g. "Bold Italic"
    style: text('style').$type<'normal' | 'italic'>().notNull(),
    weightMin: integer('weight_min').notNull(),
    weightMax: integer('weight_max').notNull(),
    stretchMin: integer('stretch_min').notNull().default(100),
    stretchMax: integer('stretch_max').notNull().default(100),
    axes: jsonb('axes').$type<Axis[]>().notNull().default([]),
    namedInstances: jsonb('named_instances').$type<{ name: string; coords: Record<string, number> }[]>().notNull().default([]),
    glyphCount: integer('glyph_count').notNull().default(0),
    scripts: jsonb('scripts').$type<string[]>().notNull().default([]),
    metrics: jsonb('metrics').$type<FallbackMetrics | null>(),
    masterKey: text('master_key'),
    masterBytes: integer('master_bytes').notNull().default(0),
    masterFormat: text('master_format'),
    sha256: text('sha256'),
    sourceFile: text('source_file'),
    // characters present in the font (compressed ranges) for coverage checks
    coverage: text('coverage'),
  },
  (t) => [index('faces_version').on(t.versionId), index('faces_sha').on(t.sha256)],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    faceId: uuid('face_id').notNull().references(() => faces.id, { onDelete: 'cascade' }),
    format: text('format').$type<'woff2' | 'woff'>().notNull(),
    subset: text('subset').notNull(),
    unicodeRange: text('unicode_range'),
    name: text('name').notNull(), // content-hashed file name served at /fonts/files/{name}
    bytes: integer('bytes').notNull(),
    sha256: text('sha256').notNull(),
    glyphs: integer('glyphs').notNull().default(0),
  },
  (t) => [index('files_face').on(t.faceId), index('files_name').on(t.name)],
);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<JobKind>().notNull(),
    status: text('status').$type<JobStatus>().notNull().default('queued'),
    step: text('step'),
    error: text('error'),
    title: text('title').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    result: jsonb('result').$type<{ families: { familyId: string; versionId: string; name: string }[] } | null>(),
    attempts: integer('attempts').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('jobs_ws_created').on(t.workspaceId, t.createdAt)],
);

export interface RoleToken {
  familyId: string | null;
  fallback?: string[];
}
export interface TextStyle {
  role: string;
  weight: number;
  style: 'normal' | 'italic';
  size: { mobile: number; tablet: number; desktop: number }; // rem
  lineHeight: number;
  letterSpacing: number; // em
  transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fluid?: boolean;
}
export interface Breakpoints {
  tablet: number; // px, min-width
  desktop: number;
}

export const tokenSets = pgTable(
  'token_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    theme: text('theme').notNull(),
    roles: jsonb('roles').$type<Record<string, RoleToken>>().notNull(),
    textStyles: jsonb('text_styles').$type<Record<string, TextStyle>>().notNull(),
    breakpoints: jsonb('breakpoints').$type<Breakpoints>().notNull(),
    scale: jsonb('scale').$type<{ base: number; ratio: number } | null>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('token_sets_ws_theme').on(t.workspaceId, t.theme)],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id'),
    actorLabel: text('actor_label').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    targetLabel: text('target_label'),
    before: jsonb('before'),
    after: jsonb('after'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_ws_at').on(t.workspaceId, t.at)],
);

export type ApiScope = 'delivery' | 'read' | 'write' | 'publish';

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  hash: text('hash').notNull().unique(),
  scopes: jsonb('scopes').$type<ApiScope[]>().notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revoked: boolean('revoked').notNull().default(false),
});

// Aggregated CSS API metrics per workspace and UTC day (origin requests only).
export const cssStats = pgTable(
  'css_stats',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    day: text('day').notNull(), // YYYY-MM-DD
    requests: integer('requests').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    totalMs: integer('total_ms').notNull().default(0),
    // latency histogram buckets (ms): <5, <10, <25, <50, <100, <300, <1000, >=1000
    buckets: jsonb('buckets').$type<number[]>().notNull().default([0, 0, 0, 0, 0, 0, 0, 0]),
    families: jsonb('families').$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.day] })],
);
