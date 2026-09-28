import 'server-only';
import { createHash } from 'node:crypto';
import { strToU8, zipSync, type Zippable } from 'fflate';
import subsetFont from 'subset-font';
import { fallbackRule } from './css-api';
import { cssQuote } from './css-names';
import type { schema } from './db';
import { FontError, readFont } from './fonts/metadata';
import { renameFont, styleNames } from './fonts/names';
import { renderDemo, type DemoFace } from './kit-demo';
import { instanceFont, slugify } from './fonts/process';
import { planSubsets, SUBSETS } from './fonts/unicode';
import { badRequest } from './http';
import { getObject, putObject } from './storage';

type Family = typeof schema.families.$inferSelect;
type Face = typeof schema.faces.$inferSelect;

export type KitFormat = 'woff2' | 'woff' | 'sfnt';
export type KitCharacters = 'full' | 'split' | 'latin' | 'latin-ext' | 'custom';

export interface KitOptions {
  formats: KitFormat[];
  faceIds?: string[];
  characters: KitCharacters;
  customText?: string;
  variable: 'variable' | 'static';
  staticWeights?: number[];
  /** Per-axis settings for variable fonts: a {min, max} range to keep, or a number to pin the axis to. */
  axes?: Record<string, { min: number; max: number } | number>;
  pathPrefix: string;
  display: string;
  fallback: boolean;
  unicodeRange: boolean;
  demo: boolean;
  tokensCss?: string | null; // tokens stylesheet to include, built by the caller
}

export const DEFAULT_KIT: KitOptions = {
  formats: ['woff2', 'woff'],
  characters: 'latin-ext',
  variable: 'variable',
  pathPrefix: '../fonts/',
  display: 'swap',
  fallback: true,
  unicodeRange: true,
  demo: true,
};

/** A face to export, from the library (stored master) or from a direct upload. */
export type KitSource = Pick<Face, 'id' | 'name' | 'style' | 'weightMin' | 'weightMax' | 'stretchMin' | 'stretchMax' | 'axes' | 'metrics' | 'masterFormat'> & {
  load: () => Promise<Buffer>;
};

/** The family details a kit needs. */
export type KitFamily = Pick<Family, 'displayName' | 'cssName' | 'fallbackStack' | 'licence'>;

export function sourcesFromFaces(faces: Face[]): KitSource[] {
  return faces.map((face) => ({
    ...face,
    load: async () => {
      if (!face.masterKey) throw badRequest('This family is served by an external provider, so there are no files to download. Import it as internal first.');
      const master = await getObject(face.masterKey);
      if (!master) throw new FontError(`The master file for ${face.name} is missing.`);
      return master;
    },
  }));
}

interface KitFace {
  name: string; // "Bold Italic"
  slug: string; // "700-italic"
  style: 'normal' | 'italic';
  weight: [number, number];
  stretch: [number, number];
  buffer: Buffer;
  isCff: boolean;
  source: KitSource;
}

interface Chunk {
  name: string; // "full", "latin", …
  text: string;
  unicodeRange: string;
}

const toText = (cps: number[]) => {
  let out = '';
  for (let i = 0; i < cps.length; i += 8192) out += String.fromCodePoint(...cps.slice(i, i + 8192));
  return out;
};
const q = cssQuote;

function chunksFor(characterSet: number[], opts: KitOptions): Chunk[] {
  const latin = SUBSETS.find((s) => s.name === 'latin')!;
  const latinExt = SUBSETS.find((s) => s.name === 'latin-ext')!;
  const inRange = (cp: number, ranges: [number, number][]) => ranges.some(([a, b]) => cp >= a && cp <= b);
  switch (opts.characters) {
    case 'full':
      return [{ name: 'full', text: toText(characterSet), unicodeRange: '' }];
    case 'split':
      return planSubsets(characterSet).map((s) => ({ name: s.name, text: toText(s.codepoints), unicodeRange: s.unicodeRange }));
    case 'latin': {
      const cps = characterSet.filter((cp) => inRange(cp, latin.ranges));
      return [{ name: 'latin', text: toText(cps), unicodeRange: latin.range }];
    }
    case 'latin-ext': {
      const cps = characterSet.filter((cp) => inRange(cp, latin.ranges) || inRange(cp, latinExt.ranges));
      return [{ name: 'latin-ext', text: toText(cps), unicodeRange: `${latin.range},${latinExt.range}` }];
    }
    case 'custom': {
      const wanted = new Set([...(opts.customText ?? '')].map((c) => c.codePointAt(0)!));
      wanted.add(0x20);
      const cps = characterSet.filter((cp) => wanted.has(cp));
      if (cps.length < 2) throw badRequest('None of the custom characters are in this font.');
      return [{ name: 'custom', text: toText(cps), unicodeRange: '' }];
    }
  }
}

/** Resolve the faces to export: masters as-is, or static instances of variable faces. */
async function kitFaces(familyName: string, faces: KitSource[], opts: KitOptions): Promise<KitFace[]> {
  const picked = opts.faceIds?.length ? faces.filter((f) => opts.faceIds!.includes(f.id)) : faces;
  if (!picked.length) throw badRequest('Pick at least one face.');
  const out: KitFace[] = [];
  for (const face of picked) {
    const master = await face.load();
    const isCff = face.masterFormat === 'otf' || master.subarray(0, 4).toString('latin1') === 'OTTO';
    const italic = face.style === 'italic' ? '-italic' : '';

    // Axis settings that apply to this face, clamped to its ranges (ital stays as-is).
    const settings = axisSettings(face.axes, opts.axes);

    if (face.axes.length && opts.variable === 'static') {
      const wght = face.axes.find((a) => a.tag === 'wght');
      const wghtSetting = settings.wght;
      const weights = (typeof wghtSetting === 'number' ? [wghtSetting] : opts.staticWeights?.length ? opts.staticWeights : [400, 700]).filter(
        (w) => !wght || (w >= wght.min && w <= wght.max),
      );
      if (!weights.length) throw badRequest(`None of the chosen weights are inside ${face.name}'s range (${face.weightMin}–${face.weightMax}).`);
      for (const w of [...new Set(weights)].sort((a, b) => a - b)) {
        // Pin every axis: wght to the chosen weight, the rest to the pinned value, else the default (clamped to any range).
        const pins = Object.fromEntries(
          face.axes.map((a) => {
            if (a.tag === 'wght') return [a.tag, w];
            const s = settings[a.tag];
            if (typeof s === 'number') return [a.tag, s];
            if (s) return [a.tag, Math.min(s.max, Math.max(s.min, a.default))];
            return [a.tag, a.default];
          }),
        );
        const instance = Buffer.from(await subsetFont(master, null, { targetFormat: 'sfnt', keepAllGlyphs: true, variationAxes: pins, preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17] }));
        const wdth = typeof pins.wdth === 'number' ? Math.round(pins.wdth) : face.stretchMin;
        // Give each static instance its own names so desktop installs don't all show as the default instance.
        const buffer = renameFont(instance, styleNames(familyName, w, face.style === 'italic', wdth));
        out.push({ name: `${w}${italic ? ' Italic' : ''}`, slug: `${w}${wdth !== 100 ? `-w${wdth}` : ''}${italic}`, style: face.style, weight: [w, w], stretch: [wdth, wdth], buffer, isCff, source: face });
      }
      continue;
    }

    if (face.axes.length && Object.keys(settings).length) {
      // Partial instancing: keep the chosen ranges, pin the rest. The result may still be variable.
      const limited = await instanceFont(master, settings);
      const meta = readFont(limited);
      const w = meta.axes.find((a) => a.tag === 'wght');
      const d = meta.axes.find((a) => a.tag === 'wdth');
      const pinnedW = typeof settings.wght === 'number' ? Math.round(settings.wght) : null;
      const pinnedD = typeof settings.wdth === 'number' ? Math.round(settings.wdth) : null;
      const weight: [number, number] = w ? [Math.round(w.min), Math.round(w.max)] : [pinnedW ?? face.weightMin, pinnedW ?? face.weightMin];
      const stretch: [number, number] = d ? [Math.round(d.min), Math.round(d.max)] : [pinnedD ?? face.stretchMin, pinnedD ?? face.stretchMin];
      const stillVariable = meta.axes.length > 0;
      out.push({
        name: stillVariable ? face.name : `${weight[0]}${italic ? ' Italic' : ''}`,
        slug: stillVariable ? `variable${italic}` : `${weight[0]}${stretch[0] !== 100 ? `-w${stretch[0]}` : ''}${italic}`,
        style: face.style,
        weight,
        stretch,
        buffer: stillVariable ? limited : renameFont(limited, styleNames(familyName, weight[0], face.style === 'italic', stretch[0])),
        isCff,
        source: face,
      });
      continue;
    }

    out.push({
      name: face.name,
      slug: face.axes.length ? `variable${italic}` : `${face.weightMin}${face.stretchMin !== 100 ? `-w${face.stretchMin}` : ''}${italic}`,
      style: face.style,
      weight: [face.weightMin, face.weightMax],
      stretch: [face.stretchMin, face.stretchMax],
      buffer: master,
      isCff,
      source: face,
    });
  }
  return out;
}

/** The axis settings relevant to one face, clamped to its ranges. */
function axisSettings(axes: Face['axes'], wanted: KitOptions['axes']) {
  const out: Record<string, { min: number; max: number } | number> = {};
  if (!wanted) return out;
  for (const a of axes) {
    const s = wanted[a.tag];
    if (s === undefined || a.tag === 'ital') continue;
    const clamp = (v: number) => Math.min(a.max, Math.max(a.min, v));
    if (typeof s === 'number') out[a.tag] = clamp(s);
    else {
      const min = clamp(Math.min(s.min, s.max));
      const max = clamp(Math.max(s.min, s.max));
      if (min === a.min && max === a.max) continue; // full range: nothing to do
      out[a.tag] = min === max ? min : { min, max };
    }
  }
  return out;
}

const EXT: Record<KitFormat, (cff: boolean) => string> = { woff2: () => 'woff2', woff: () => 'woff', sfnt: (cff) => (cff ? 'otf' : 'ttf') };
const FORMAT_HINT: Record<string, string> = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };

export interface BuiltKit {
  filename: string;
  zip: Uint8Array;
  files: { path: string; bytes: number }[];
  cached: boolean;
}

/**
 * Build a self-contained web font kit: font files in the chosen formats, a
 * stylesheet with @font-face rules, an optional demo page and a README.
 */
export async function buildKit(family: Family, version: { id: string; number: number }, faces: Face[], input: Partial<KitOptions>): Promise<BuiltKit> {
  const opts: KitOptions = { ...DEFAULT_KIT, ...input };
  const familySlug = slugify(family.cssName);
  const filename = `${familySlug}-webfont-kit-v${version.number}.zip`;

  // Same options on the same version always produce the same kit, so cache it.
  const cacheKey = `kits/${version.id}/${createHash('sha256').update(JSON.stringify({ ...opts, faceIds: opts.faceIds?.slice().sort(), v: 4 })).digest('hex').slice(0, 20)}.zip`;
  const cached = await getObject(cacheKey);
  if (cached) return { filename, zip: new Uint8Array(cached), files: [], cached: true };

  const kit = await buildKitTree(family, version.number, sourcesFromFaces(faces), opts);
  const zip = zipSync({ [kit.root]: kit.tree }, { level: 6 });
  await putObject(cacheKey, zip, 'application/zip').catch(() => {});
  return { filename, zip, files: kit.files, cached: false };
}

/** Build the folder tree of one family's kit (fonts, css, demo, README). */
export async function buildKitTree(family: KitFamily, versionNumber: number | null, sources: KitSource[], input: Partial<KitOptions>) {
  const opts: KitOptions = { ...DEFAULT_KIT, ...input };
  if (!opts.formats.length) throw badRequest('Pick at least one format.');
  if (opts.characters === 'custom' && !opts.customText?.trim()) throw badRequest('Enter the characters to keep.');
  const familySlug = slugify(family.cssName);
  const version = { number: versionNumber };
  const kitFacesList = await kitFaces(family.cssName, sources, opts);
  const tree: Zippable = { fonts: {} };
  const fontsDir = tree.fonts as Record<string, [Uint8Array, { level: 0 }]>;
  const listing: BuiltKit['files'] = [];
  const cssBlocks: string[] = [];
  const prefix = opts.pathPrefix.endsWith('/') || !opts.pathPrefix ? opts.pathPrefix : `${opts.pathPrefix}/`;

  const demoFaces: DemoFace[] = [];
  for (const face of kitFacesList) {
    const meta = readFont(face.buffer);
    demoFaces.push({
      name: face.name,
      style: face.style,
      weight: face.weight,
      stretch: face.stretch,
      axes: meta.axes.filter((a) => a.max > a.min).map((a) => ({ tag: a.tag, name: a.name, min: +a.min.toFixed(2), max: +a.max.toFixed(2), default: +a.default.toFixed(2) })),
      instances: meta.namedInstances.map((n) => ({ name: n.name, coords: n.coords })),
    });
    const chunks = chunksFor(meta.characterSet, opts);
    for (const chunk of chunks) {
      if (!chunk.text) continue;
      const base = `${familySlug}-${face.slug}${chunk.name === 'full' || chunk.name === 'custom' || opts.characters !== 'split' ? '' : `-${chunk.name}`}`;
      const src: string[] = [];
      for (const format of ['woff2', 'woff', 'sfnt'] as const) {
        if (!opts.formats.includes(format)) continue;
        const data = await subsetFont(face.buffer, chunk.text, { targetFormat: format, preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17] });
        const ext = EXT[format](face.isCff);
        const name = `${base}.${ext}`;
        fontsDir[name] = [new Uint8Array(data), { level: 0 }];
        listing.push({ path: `fonts/${name}`, bytes: data.byteLength });
        src.push(`url('${prefix}${name}') format('${FORMAT_HINT[ext]}')`);
      }
      const weight = face.weight[0] === face.weight[1] ? `${face.weight[0]}` : `${face.weight[0]} ${face.weight[1]}`;
      const stretch = face.stretch[0] === face.stretch[1] ? (face.stretch[0] === 100 ? null : `${face.stretch[0]}%`) : `${face.stretch[0]}% ${face.stretch[1]}%`;
      cssBlocks.push(
        [
          chunks.length > 1 ? `/* ${face.name} · ${chunk.name} */` : `/* ${face.name} */`,
          '@font-face {',
          `  font-family: ${q(family.cssName)};`,
          `  font-style: ${face.style};`,
          `  font-weight: ${weight};`,
          stretch && `  font-stretch: ${stretch};`,
          `  font-display: ${opts.display};`,
          `  src: ${src.join(',\n       ')};`,
          opts.unicodeRange && chunk.unicodeRange && `  unicode-range: ${chunk.unicodeRange};`,
          '}',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
  }

  const fallback = opts.fallback ? fallbackRule(family.cssName, kitFacesList.map((f) => f.source)) : '';
  const stack = `${q(family.cssName)}${fallback ? `, ${q(`${family.cssName} Fallback`)}` : ''}, ${family.fallbackStack.join(', ')}`;
  const header = [`/*`, ` * ${family.displayName} web font kit${version.number ? ` · version ${version.number}` : ''}`, ` * Generated by Typeface Hub. Use with:`, ` *   font-family: ${stack};`, ` */`].join('\n');
  const css = [header, cssBlocks.join('\n\n'), fallback && `/* Metric-matched fallback: reduces layout shift while the web font loads. */\n${fallback}`]
    .filter(Boolean)
    .join('\n\n');
  const cssName = `${familySlug}.css`;
  tree.css = { [cssName]: strToU8(css + '\n') };
  listing.push({ path: `css/${cssName}`, bytes: css.length });
  if (opts.tokensCss) tree.css = { ...(tree.css as object), 'tokens.css': strToU8(opts.tokensCss) } as Zippable;

  if (opts.demo) {
    tree['demo.html'] = strToU8(renderDemo({ family: family.displayName, cssName: family.cssName, stack, cssFile: `css/${cssName}`, version: version.number, faces: demoFaces }));
  }

  const licence = family.licence;
  const readme = `${family.displayName} web font kit${version.number ? ` (version ${version.number})` : ''}
${'='.repeat(40)}

Contents
  fonts/          ${listing.filter((f) => f.path.startsWith('fonts/')).length} font files (${opts.formats.map((f) => (f === 'sfnt' ? 'TTF/OTF' : f.toUpperCase())).join(', ')})
  css/${cssName.padEnd(12)}@font-face rules${opts.fallback ? ' and a metric-matched fallback face' : ''}${opts.tokensCss ? '\n  css/tokens.css  typography tokens (CSS custom properties)' : ''}${opts.demo ? '\n  demo.html       preview every face in a browser' : ''}

How to use
  1. Copy the fonts/ and css/ folders into your project, keeping them side by side
     (the CSS loads fonts from "${prefix}").
  2. Add the stylesheet to your pages:
       <link rel="stylesheet" href="/css/${cssName}">
  3. Use the font:
       font-family: ${stack};

Tips
  - WOFF2 is listed first; browsers download only the first format they support.
  - Preload the face used above the fold for faster text rendering:
       <link rel="preload" href="/fonts/<file>.woff2" as="font" type="font/woff2" crossorigin>
  - If fonts are served from another domain, that server must send
    Access-Control-Allow-Origin for the font files.

Licence
  ${licence.type ? `Type: ${licence.type}` : 'Not recorded in Typeface Hub.'}${licence.owner ? `\n  Owner: ${licence.owner}` : ''}${licence.allowedDomains?.length ? `\n  Allowed domains: ${licence.allowedDomains.join(', ')}` : ''}${licence.detected?.copyright ? `\n  ${licence.detected.copyright}` : ''}${licence.detected?.licenseUrl ? `\n  ${licence.detected.licenseUrl}` : ''}
  Make sure your licence allows web embedding on every site where you use these files.

Generated by Typeface Hub on ${new Date().toISOString().slice(0, 10)}.
`;
  tree['README.txt'] = strToU8(readme);

  return { root: `${familySlug}-webfont-kit`, tree, files: listing };
}
