import 'server-only';
import { createHash } from 'node:crypto';
import { strToU8, zipSync, type Zippable } from 'fflate';
import subsetFont from 'subset-font';
import { fallbackRule } from './css-api';
import type { schema } from './db';
import { FontError, readFont } from './fonts/metadata';
import { renameFont, styleNames } from './fonts/names';
import { slugify } from './fonts/process';
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

interface KitFace {
  name: string; // "Bold Italic"
  slug: string; // "700-italic"
  style: 'normal' | 'italic';
  weight: [number, number];
  stretch: [number, number];
  buffer: Buffer;
  isCff: boolean;
  source: Face;
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
const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

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
async function kitFaces(familyName: string, faces: Face[], opts: KitOptions): Promise<KitFace[]> {
  const picked = opts.faceIds?.length ? faces.filter((f) => opts.faceIds!.includes(f.id)) : faces;
  if (!picked.length) throw badRequest('Pick at least one face.');
  const out: KitFace[] = [];
  for (const face of picked) {
    if (!face.masterKey) throw badRequest('This family is served by an external provider, so there are no files to download. Import it as internal first.');
    const master = await getObject(face.masterKey);
    if (!master) throw new FontError(`The master file for ${face.name} is missing.`);
    const isCff = face.masterFormat === 'otf' || master.subarray(0, 4).toString('latin1') === 'OTTO';
    const italic = face.style === 'italic' ? '-italic' : '';

    if (face.axes.length && opts.variable === 'static') {
      const wght = face.axes.find((a) => a.tag === 'wght');
      const weights = (opts.staticWeights?.length ? opts.staticWeights : [400, 700]).filter((w) => !wght || (w >= wght.min && w <= wght.max));
      if (!weights.length) throw badRequest(`None of the chosen weights are inside ${face.name}'s range (${face.weightMin}–${face.weightMax}).`);
      for (const w of [...new Set(weights)].sort((a, b) => a - b)) {
        // Pin every axis: wght to the chosen weight, the rest to their defaults.
        const pins = Object.fromEntries(face.axes.map((a) => [a.tag, a.tag === 'wght' ? w : a.default]));
        const instance = Buffer.from(await subsetFont(master, null, { targetFormat: 'sfnt', keepAllGlyphs: true, variationAxes: pins, preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17] }));
        // Give each static instance its own names so desktop installs don't all show as the default instance.
        const buffer = renameFont(instance, styleNames(familyName, w, face.style === 'italic'));
        out.push({ name: `${w}${italic ? ' Italic' : ''}`, slug: `${w}${italic}`, style: face.style, weight: [w, w], stretch: [face.stretchMin, face.stretchMin], buffer, isCff, source: face });
      }
    } else {
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
  if (!opts.formats.length) throw badRequest('Pick at least one format.');
  if (opts.characters === 'custom' && !opts.customText?.trim()) throw badRequest('Enter the characters to keep.');
  const familySlug = slugify(family.cssName);
  const filename = `${familySlug}-webfont-kit-v${version.number}.zip`;

  // Same options on the same version always produce the same kit, so cache it.
  const cacheKey = `kits/${version.id}/${createHash('sha256').update(JSON.stringify({ ...opts, faceIds: opts.faceIds?.slice().sort(), v: 2 })).digest('hex').slice(0, 20)}.zip`;
  const cached = await getObject(cacheKey);
  if (cached) return { filename, zip: new Uint8Array(cached), files: [], cached: true };

  const kitFacesList = await kitFaces(family.cssName, faces, opts);
  const tree: Zippable = { fonts: {} };
  const fontsDir = tree.fonts as Record<string, [Uint8Array, { level: 0 }]>;
  const listing: BuiltKit['files'] = [];
  const cssBlocks: string[] = [];
  const prefix = opts.pathPrefix.endsWith('/') || !opts.pathPrefix ? opts.pathPrefix : `${opts.pathPrefix}/`;

  for (const face of kitFacesList) {
    const meta = readFont(face.buffer);
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
  const header = [`/*`, ` * ${family.displayName} web font kit · version ${version.number}`, ` * Generated by Typeface Hub. Use with:`, ` *   font-family: ${stack};`, ` */`].join('\n');
  const css = [header, cssBlocks.join('\n\n'), fallback && `/* Metric-matched fallback: reduces layout shift while the web font loads. */\n${fallback}`]
    .filter(Boolean)
    .join('\n\n');
  const cssName = `${familySlug}.css`;
  tree.css = { [cssName]: strToU8(css + '\n') };
  listing.push({ path: `css/${cssName}`, bytes: css.length });
  if (opts.tokensCss) tree.css = { ...(tree.css as object), 'tokens.css': strToU8(opts.tokensCss) } as Zippable;

  if (opts.demo) {
    const rows = kitFacesList
      .map((f) => {
        const w = f.weight[0] === f.weight[1] ? f.weight[0] : Math.round((f.weight[0] + f.weight[1]) / 2);
        return `      <section>
        <div class="meta">${esc(f.name)} · ${f.weight[0] === f.weight[1] ? f.weight[0] : `${f.weight[0]}–${f.weight[1]}`} ${f.style}</div>
        <p style="font-weight:${w};font-style:${f.style}">The quick brown fox jumps over the lazy dog</p>
        <p class="small" style="font-weight:${w};font-style:${f.style}">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !?&amp;@€</p>
      </section>`;
      })
      .join('\n');
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(family.displayName)} · web font kit</title>
    <link rel="stylesheet" href="css/${cssName}" />
    <style>
      body { margin: 0; padding: 40px 24px; font: 14px/1.5 system-ui, sans-serif; color: #16181d; background: #f6f7f9; }
      main { max-width: 900px; margin: 0 auto; }
      h1 { font-family: ${esc(stack)}; font-size: 48px; margin: 0 0 4px; font-weight: 400; }
      .lead { color: #676d7c; margin: 0 0 32px; }
      section { background: #fff; border: 1px solid #e4e6eb; border-radius: 12px; padding: 20px 24px; margin-bottom: 12px; }
      .meta { color: #676d7c; font-size: 12px; margin-bottom: 8px; }
      section p { font-family: ${esc(stack)}; font-size: 32px; margin: 0; line-height: 1.25; }
      section p.small { font-size: 18px; margin-top: 8px; color: #3b3f4a; }
      pre { background: #0f1117; color: #e6e8ee; padding: 16px; border-radius: 10px; overflow-x: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>${esc(family.displayName)}</h1>
      <p class="lead">Version ${version.number} · ${kitFacesList.length} face${kitFacesList.length === 1 ? '' : 's'} · open this file in a browser to preview the kit.</p>
${rows}
      <h2>How to use</h2>
<pre>&lt;link rel="stylesheet" href="css/${cssName}"&gt;

body { font-family: ${esc(stack)}; }</pre>
    </main>
  </body>
</html>
`;
    tree['demo.html'] = strToU8(html);
  }

  const licence = family.licence;
  const readme = `${family.displayName} web font kit (version ${version.number})
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

  const zip = zipSync({ [`${familySlug}-webfont-kit`]: tree }, { level: 6 });
  await putObject(cacheKey, zip, 'application/zip').catch(() => {});
  return { filename, zip, files: listing, cached: false };
}
