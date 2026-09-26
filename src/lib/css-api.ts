import type { schema } from './db';
import googleCatalog from '@/data/google-fonts.json';

type Family = typeof schema.families.$inferSelect;
type Face = typeof schema.faces.$inferSelect;
type FileRow = typeof schema.files.$inferSelect;
export type FaceWithFiles = Face & { files: FileRow[] };
export type DeliveryFamily = { family: Family; faces: FaceWithFiles[] };

/* ------------------------------------------------------------------ */
/* Query parsing: Google CSS2 syntax (DLV-1)                           */
/* ------------------------------------------------------------------ */

export type Span = [number, number];
export interface FaceRequest {
  ital: 0 | 1;
  wght: Span | null;
  wdth: Span | null;
  axes: Record<string, Span>; // any other axis, passed through for external providers
}
export interface FamilyRequest {
  name: string;
  tags: string[];
  tuples: FaceRequest[]; // empty = default face
  raw: string;
}

export class CssQueryError extends Error {}

function parseValue(v: string, tag: string): Span {
  const [a, b] = v.split('..').map((x) => Number(x));
  if (!Number.isFinite(a) || (b !== undefined && !Number.isFinite(b))) throw new CssQueryError(`Invalid value “${v}” for axis ${tag}`);
  return [a, b ?? a];
}

export function parseFamilyParam(raw: string): FamilyRequest {
  const [namePart, spec] = raw.split(':');
  const name = namePart.replace(/\+/g, ' ').trim();
  if (!name) throw new CssQueryError('Empty family name');
  if (!spec) return { name, tags: [], tuples: [], raw };
  const [tagPart, valuesPart] = spec.split('@');
  const tags = tagPart.split(',').map((t) => t.trim()).filter(Boolean);
  if (!valuesPart) {
    // "Inter:ital" style shorthand isn't part of CSS2; treat bare tags as all values.
    throw new CssQueryError(`Axis values are missing for “${raw}”. Example: ${name.replace(/ /g, '+')}:wght@400;700`);
  }
  const tuples = valuesPart.split(';').filter(Boolean).map((tuple) => {
    const values = tuple.split(',');
    if (values.length !== tags.length) throw new CssQueryError(`Tuple “${tuple}” does not match axes ${tags.join(',')}`);
    const req: FaceRequest = { ital: 0, wght: null, wdth: null, axes: {} };
    tags.forEach((tag, i) => {
      const span = parseValue(values[i], tag);
      if (tag === 'ital') req.ital = span[0] >= 1 ? 1 : 0;
      else if (tag === 'wght') req.wght = span;
      else if (tag === 'wdth') req.wdth = span;
      else req.axes[tag] = span;
    });
    return req;
  });
  return { name, tags, tuples, raw };
}

export function parseCssQuery(params: URLSearchParams) {
  const families = params.getAll('family').flatMap((f) => f.split('|')).filter(Boolean).map(parseFamilyParam);
  if (!families.length) throw new CssQueryError('Missing “family” parameter. Example: /css?family=Montserrat:wght@400;700');
  const display = params.get('display');
  if (display && !['auto', 'block', 'swap', 'fallback', 'optional'].includes(display)) {
    throw new CssQueryError(`Invalid display value “${display}”`);
  }
  return { families, display };
}

/* ------------------------------------------------------------------ */
/* Face selection                                                     */
/* ------------------------------------------------------------------ */

const overlap = (a: Span, b: Span): Span | null => {
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return lo <= hi ? [lo, hi] : null;
};

export interface Selection {
  face: FaceWithFiles;
  weight: Span;
}

/** Pick the faces of a family that satisfy the requested tuples. */
export function selectFaces(faces: FaceWithFiles[], req: FamilyRequest): { selected: Selection[]; missing: string[] } {
  const tuples: FaceRequest[] = req.tuples.length ? req.tuples : [{ ital: 0, wght: null, wdth: null, axes: {} }];
  const picked = new Map<string, Selection>();
  const missing: string[] = [];

  for (const t of tuples) {
    const style = t.ital ? 'italic' : 'normal';
    const wanted: Span = t.wght ?? [400, 400];
    let candidates = faces.filter((f) => f.style === style);
    if (t.wdth) candidates = candidates.filter((f) => overlap([f.stretchMin, f.stretchMax], t.wdth!));
    let matches = candidates
      .map((face) => ({ face, weight: overlap([face.weightMin, face.weightMax], wanted) }))
      .filter((m): m is Selection => m.weight !== null);

    // No explicit axes requested: fall back to the closest regular face, like Google does for single-style families.
    if (!matches.length && !req.tuples.length && faces.length) {
      const closest = [...faces].sort(
        (a, b) =>
          Number(a.style !== 'normal') - Number(b.style !== 'normal') ||
          distance(a, 400) - distance(b, 400),
      )[0];
      const w = clamp(400, closest.weightMin, closest.weightMax);
      matches = [{ face: closest, weight: [w, w] }];
    }
    if (!matches.length) {
      missing.push(`${style} ${wanted[0] === wanted[1] ? wanted[0] : wanted.join('..')}`);
      continue;
    }
    for (const m of matches) {
      const prev = picked.get(m.face.id);
      picked.set(m.face.id, prev ? { face: m.face, weight: [Math.min(prev.weight[0], m.weight[0]), Math.max(prev.weight[1], m.weight[1])] } : m);
    }
  }
  return { selected: [...picked.values()], missing };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const distance = (f: Pick<Face, 'weightMin' | 'weightMax'>, w: number) => (w < f.weightMin ? f.weightMin - w : w > f.weightMax ? w - f.weightMax : 0);

/* ------------------------------------------------------------------ */
/* CSS generation (DLV-2, VAR-5, DLV-9)                               */
/* ------------------------------------------------------------------ */

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// Declare latin last: for overlapping unicode ranges the last matching rule wins.
const SUBSET_ORDER = ['latin', 'latin-ext', 'vietnamese', 'greek', 'greek-ext', 'cyrillic', 'cyrillic-ext'];
const subsetRank = (s: string) => {
  const i = SUBSET_ORDER.indexOf(s);
  return i < 0 ? (s === 'other' || s === 'all' ? 100 : 50) : i;
};

export function fontFaceRules(
  familyName: string,
  sel: Selection,
  opts: { display: string; fileBase: string; subsets?: string[] },
) {
  const { face } = sel;
  const bySubset = new Map<string, { woff2?: FileRow; woff?: FileRow }>();
  for (const file of face.files) {
    if (opts.subsets && !opts.subsets.includes(file.subset)) continue;
    const entry = bySubset.get(file.subset) ?? {};
    entry[file.format] = file;
    bySubset.set(file.subset, entry);
  }
  const variable = face.axes.length > 0;
  const weight = variable
    ? sel.weight[0] === sel.weight[1]
      ? `${sel.weight[0]}`
      : `${sel.weight[0]} ${sel.weight[1]}`
    : `${face.weightMin}`;
  const stretch =
    face.stretchMin === face.stretchMax ? (face.stretchMin === 100 ? null : `${face.stretchMin}%`) : `${face.stretchMin}% ${face.stretchMax}%`;
  const slnt = face.axes.find((a) => a.tag === 'slnt');
  const style =
    face.style === 'normal' && slnt ? `oblique ${-slnt.max}deg ${-slnt.min}deg` : face.style;

  return [...bySubset.entries()]
    .sort((a, b) => subsetRank(b[0]) - subsetRank(a[0]))
    .map(([subset, f]) => {
      const src = [
        f.woff2 && `url(${opts.fileBase}/${f.woff2.name}) format('woff2')`,
        f.woff && `url(${opts.fileBase}/${f.woff.name}) format('woff')`,
      ].filter(Boolean);
      const range = (f.woff2 ?? f.woff)?.unicodeRange;
      return [
        `/* ${subset} */`,
        '@font-face {',
        `  font-family: ${quote(familyName)};`,
        `  font-style: ${style};`,
        `  font-weight: ${weight};`,
        stretch && `  font-stretch: ${stretch};`,
        `  font-display: ${opts.display};`,
        `  src: ${src.join(', ')};`,
        range && `  unicode-range: ${range};`,
        '}',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
}

/** Metric-adjusted local fallback face so text doesn't shift when the web font swaps in. */
export function fallbackRule(familyName: string, faces: Pick<Face, 'style' | 'weightMin' | 'weightMax' | 'metrics'>[]) {
  const regular =
    [...faces].sort((a, b) => Number(a.style !== 'normal') - Number(b.style !== 'normal') || distance(a, 400) - distance(b, 400))[0];
  const m = regular?.metrics;
  if (!m) return '';
  return [
    '@font-face {',
    `  font-family: ${quote(`${familyName} Fallback`)};`,
    `  src: local(${quote(m.fallback)});`,
    `  size-adjust: ${m.sizeAdjust}%;`,
    `  ascent-override: ${m.ascentOverride}%;`,
    `  descent-override: ${m.descentOverride}%;`,
    `  line-gap-override: ${m.lineGapOverride}%;`,
    '}',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* External providers                                                 */
/* ------------------------------------------------------------------ */

type CatalogEntry = { family: string; variants: string[]; axes: { tag: string; min: number; max: number; default: number }[] };
const catalog = googleCatalog as CatalogEntry[];
export const findGoogleFamily = (name: string) => catalog.find((f) => f.family.toLowerCase() === name.toLowerCase());

/** Build a Google Fonts CSS2 URL for the tuples Google actually has. */
export function googleCssUrl(name: string, tuples: FaceRequest[], display: string) {
  const entry = findGoogleFamily(name);
  const family = name.replace(/ /g, '+');
  const base = `https://fonts.googleapis.com/css2?family=`;
  if (!entry || !tuples.length) return `${base}${family}&display=${display}`;

  const wghtAxis = entry.axes.find((a) => a.tag === 'wght');
  const hasItalic = entry.variants.some((v) => v.endsWith('i'));
  const out = new Set<string>();
  for (const t of tuples) {
    const ital = hasItalic ? t.ital : 0;
    if (!hasItalic && t.ital) continue;
    const w = t.wght ?? [400, 400];
    if (wghtAxis) {
      const span = overlap(w, [wghtAxis.min, wghtAxis.max]);
      if (!span) continue;
      out.add(`${ital}|${span[0] === span[1] ? span[0] : `${span[0]}..${span[1]}`}`);
    } else {
      for (const v of entry.variants) {
        const vw = parseInt(v, 10);
        const vi = v.endsWith('i') ? 1 : 0;
        if (vi === ital && vw >= w[0] && vw <= w[1]) out.add(`${ital}|${vw}`);
      }
    }
  }
  if (!out.size) return `${base}${family}&display=${display}`;
  const sorted = [...out].map((s) => s.split('|')).sort((a, b) => +a[0] - +b[0] || parseFloat(a[1]) - parseFloat(b[1]));
  const spec = hasItalic ? `ital,wght@${sorted.map(([i, w]) => `${i},${w}`).join(';')}` : `wght@${sorted.map(([, w]) => w).join(';')}`;
  return `${base}${family}:${spec}&display=${display}`;
}

/* ------------------------------------------------------------------ */
/* Stylesheet                                                          */
/* ------------------------------------------------------------------ */

export interface BuiltStylesheet {
  css: string;
  imports: string[];
  preconnect: string[];
  missing: string[];
  selections: { family: string; selection: Selection }[];
}

export function buildStylesheet(
  requests: FamilyRequest[],
  families: Map<string, DeliveryFamily>,
  opts: { display: string | null; fileBase: string; subsets?: string[]; fallbacks?: boolean },
): BuiltStylesheet {
  const blocks: string[] = [];
  const imports: string[] = [];
  const preconnect = new Set<string>();
  const missing: string[] = [];
  const selections: BuiltStylesheet['selections'] = [];

  for (const req of requests) {
    const entry = families.get(req.name.toLowerCase());
    if (!entry) {
      missing.push(`${req.name}: family not found or not published`);
      continue;
    }
    const { family, faces } = entry;
    const display = opts.display ?? family.display;
    if (family.delivery === 'external') {
      if (family.external?.provider === 'google') {
        imports.push(googleCssUrl(family.external.family ?? family.cssName, req.tuples, display));
        preconnect.add('https://fonts.googleapis.com');
        preconnect.add('https://fonts.gstatic.com');
      } else if (family.external?.cssUrl) {
        imports.push(family.external.cssUrl);
        preconnect.add(new URL(family.external.cssUrl).origin);
      }
      continue;
    }
    const { selected, missing: miss } = selectFaces(faces, req);
    missing.push(...miss.map((m) => `${req.name}: no ${m} face`));
    for (const sel of selected) {
      blocks.push(fontFaceRules(family.cssName, sel, { display, fileBase: opts.fileBase, subsets: opts.subsets }));
      selections.push({ family: family.cssName, selection: sel });
    }
    if (selected.length && opts.fallbacks !== false) {
      const fb = fallbackRule(family.cssName, faces);
      if (fb) blocks.push(fb);
    }
  }

  const header = missing.length ? `/* Not served: ${missing.join('; ').replace(/\*\//g, '')} */\n` : '';
  const importLines = [...new Set(imports)].map((u) => `@import url(${u});`).join('\n');
  return {
    css: [importLines, header + blocks.join('\n')].filter(Boolean).join('\n'),
    imports,
    preconnect: [...preconnect],
    missing,
    selections,
  };
}

/** Canonical CSS API query for a set of faces, e.g. family=Inter:ital,wght@0,400;1,700 */
export function cssQueryFor(items: { family: string; weight: number | Span; italic: boolean }[], display = 'swap') {
  const byFamily = new Map<string, Set<string>>();
  for (const it of items) {
    const w = Array.isArray(it.weight) ? (it.weight[0] === it.weight[1] ? `${it.weight[0]}` : `${it.weight[0]}..${it.weight[1]}`) : `${it.weight}`;
    const set = byFamily.get(it.family) ?? new Set();
    set.add(`${it.italic ? 1 : 0},${w}`);
    byFamily.set(it.family, set);
  }
  const parts = [...byFamily.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([family, set]) => {
      const tuples = [...set].map((s) => s.split(',')).sort((a, b) => +a[0] - +b[0] || parseFloat(a[1]) - parseFloat(b[1]));
      const hasItalic = tuples.some(([i]) => i === '1');
      const spec = hasItalic ? `ital,wght@${tuples.map(([i, w]) => `${i},${w}`).join(';')}` : `wght@${tuples.map(([, w]) => w).join(';')}`;
      return `family=${encodeURIComponent(family).replace(/%20/g, '+')}:${spec}`;
    });
  return `${parts.join('&')}&display=${display}`;
}
