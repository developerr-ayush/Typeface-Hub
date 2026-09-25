import * as fontkit from 'fontkit';
import type { Axis, FallbackMetrics } from '@/lib/db/schema';
import { detectScripts } from './unicode';

export type MasterFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

export class FontError extends Error {
  constructor(message: string, public fix?: string) {
    super(message);
  }
}

/** Identify a font by its magic bytes (PRC-1). Returns null for anything that is not a single font. */
export function sniffFormat(buf: Uint8Array): MasterFormat | 'ttc' | null {
  if (buf.length < 12) return null;
  const tag = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (buf[0] === 0 && buf[1] === 1 && buf[2] === 0 && buf[3] === 0) return 'ttf';
  if (tag === 'true') return 'ttf';
  if (tag === 'OTTO') return 'otf';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'ttcf') return 'ttc';
  return null;
}

export const MIME: Record<MasterFormat, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

export interface FontMeta {
  format: MasterFormat;
  family: string; // typographic family (name ID 16, falling back to 1)
  subfamily: string;
  fullName: string;
  postscriptName: string;
  style: 'normal' | 'italic';
  weight: number;
  stretch: number; // percent
  isVariable: boolean;
  axes: Axis[];
  namedInstances: { name: string; coords: Record<string, number> }[];
  glyphCount: number;
  characterSet: number[];
  scripts: string[];
  unitsPerEm: number;
  metrics: FallbackMetrics;
  licence: { license?: string; licenseUrl?: string; vendor?: string; copyright?: string; designer?: string; version?: string };
  hasKerning: boolean;
  warnings: string[];
}

const WIDTH_CLASS: Record<number, number> = { 1: 50, 2: 62.5, 3: 75, 4: 87.5, 5: 100, 6: 112.5, 7: 125, 8: 150, 9: 200 };

// Letter frequencies used to compute an average character width, as capsize and next/font do.
const FREQ: Record<string, number> = {
  a: 0.0668, b: 0.0122, c: 0.0228, d: 0.0348, e: 0.1039, f: 0.0182, g: 0.0165, h: 0.0499, i: 0.057,
  j: 0.0013, k: 0.0063, l: 0.0329, m: 0.0197, n: 0.0552, o: 0.0614, p: 0.0158, q: 0.0008, r: 0.049,
  s: 0.0518, t: 0.0741, u: 0.0226, v: 0.008, w: 0.0193, x: 0.0012, y: 0.0162, z: 0.0006, ' ': 0.1818,
};

// System fallbacks (capsize metrics).
const SYSTEM_FALLBACKS = {
  sans: { local: 'Arial', unitsPerEm: 2048, xWidthAvg: 904 },
  serif: { local: 'Times New Roman', unitsPerEm: 2048, xWidthAvg: 819 },
  mono: { local: 'Courier New', unitsPerEm: 2048, xWidthAvg: 1229 },
};

export function fallbackFor(category: string) {
  if (category === 'serif') return SYSTEM_FALLBACKS.serif;
  if (category === 'monospace') return SYSTEM_FALLBACKS.mono;
  return SYSTEM_FALLBACKS.sans;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

type FontkitFont = fontkit.Font & {
  getName?: (key: string, lang?: string) => string | null;
  'OS/2'?: { usWeightClass: number; usWidthClass: number; fsSelection: { italic: boolean; oblique?: boolean }; vendorID?: string; xAvgCharWidth?: number };
  hhea?: { ascent: number; descent: number; lineGap: number };
  variationAxes: Record<string, { name: string; min: number; default: number; max: number }>;
  namedVariations: Record<string, Record<string, number>>;
  availableFeatures?: string[];
  italicAngle: number;
};

function computeMetrics(font: FontkitFont, category: string): FallbackMetrics {
  const fb = fallbackFor(category);
  let width = 0;
  let total = 0;
  for (const [ch, f] of Object.entries(FREQ)) {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0)!);
    if (!glyph || glyph.id === 0) continue;
    width += glyph.advanceWidth * f;
    total += f;
  }
  const avg = total ? width / total : font.unitsPerEm * 0.5;
  const sizeAdjust = avg / font.unitsPerEm / (fb.xWidthAvg / fb.unitsPerEm);
  const ascent = font.hhea?.ascent ?? font.ascent;
  const descent = Math.abs(font.hhea?.descent ?? font.descent);
  const lineGap = font.hhea?.lineGap ?? font.lineGap ?? 0;
  const denom = font.unitsPerEm * sizeAdjust;
  return {
    fallback: fb.local,
    sizeAdjust: round(sizeAdjust * 100),
    ascentOverride: round((ascent / denom) * 100),
    descentOverride: round((descent / denom) * 100),
    lineGapOverride: round((lineGap / denom) * 100),
  };
}

function weightFromName(sub: string): number | null {
  const s = sub.toLowerCase().replace(/[\s_-]/g, '');
  const table: [RegExp, number][] = [
    [/hairline|thin/, 100],
    [/extralight|ultralight/, 200],
    [/light/, 300],
    [/semibold|demibold/, 600],
    [/extrabold|ultrabold/, 800],
    [/black|heavy/, 900],
    [/bold/, 700],
    [/medium/, 500],
    [/regular|normal|book|roman/, 400],
  ];
  for (const [re, w] of table) if (re.test(s)) return w;
  return null;
}

export function readFont(buf: Buffer, category = 'sans-serif'): FontMeta {
  const format = sniffFormat(buf);
  if (format === 'ttc') {
    throw new FontError('Font collections (.ttc) are not supported.', 'Export each face as its own TTF or OTF and upload those.');
  }
  if (!format) {
    throw new FontError('This file is not a font.', 'Upload TTF, OTF, WOFF or WOFF2 files. EOT and SVG fonts are legacy formats and are not needed.');
  }
  let font: FontkitFont;
  try {
    font = fontkit.create(buf) as FontkitFont;
  } catch (e) {
    throw new FontError(`The font file is corrupt and could not be read (${(e as Error).message}).`, 'Re-export the font from its source, or download it again.');
  }
  if (!('glyphForCodePoint' in font)) throw new FontError('Font collections are not supported.');

  const warnings: string[] = [];
  const name = (key: string) => font.getName?.(key) ?? null;
  const family = (name('preferredFamily') || font.familyName || '').trim();
  const subfamily = (name('preferredSubfamily') || font.subfamilyName || 'Regular').trim();
  if (!family) throw new FontError('The font has no family name in its name table.', 'Fix the font metadata in a font editor, then upload it again.');

  const os2 = font['OS/2'];
  const axesRaw = font.variationAxes ?? {};
  const axes: Axis[] = Object.entries(axesRaw).map(([tag, a]) => ({ tag, name: a.name, min: a.min, max: a.max, default: a.default }));
  const isVariable = axes.length > 0;
  const namedInstances = Object.entries(font.namedVariations ?? {}).map(([n, coords]) => ({ name: n, coords }));

  let weight = os2?.usWeightClass ?? 400;
  if (!weight || weight < 1 || weight > 1000) {
    const guess = weightFromName(subfamily) ?? 400;
    warnings.push(`Weight class is missing or invalid (${weight}); using ${guess} from the style name “${subfamily}”.`);
    weight = guess;
  } else if (!isVariable) {
    const fromName = weightFromName(subfamily);
    if (fromName && Math.abs(fromName - weight) >= 200) {
      warnings.push(`Style name “${subfamily}” suggests weight ${fromName}, but the font says ${weight}. Check the weight on the review screen.`);
    }
  }
  const italicByName = /italic|oblique/i.test(subfamily);
  const italic = Boolean(os2?.fsSelection?.italic || os2?.fsSelection?.oblique || italicByName || (font.italicAngle ?? 0) !== 0 || axesRaw.ital?.default === 1);
  const stretch = WIDTH_CLASS[os2?.usWidthClass ?? 5] ?? 100;

  const characterSet = font.characterSet ?? [];
  const missingBasic = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'].filter(
    (c) => !characterSet.includes(c.codePointAt(0)!),
  );
  if (missingBasic.length && missingBasic.length < 62) {
    warnings.push(`Missing ${missingBasic.length} basic Latin characters: ${missingBasic.slice(0, 20).join(' ')}${missingBasic.length > 20 ? '…' : ''}`);
  } else if (missingBasic.length === 62) {
    warnings.push('The font has no basic Latin letters or numbers, so it is probably a symbol or non-Latin font.');
  }
  const licenseText = name('license') ?? undefined;
  const licenseUrl = name('licenseURL') ?? undefined;
  if (!licenseText && !licenseUrl) warnings.push('The font does not include licence information. Record the licence before publishing.');

  const features = font.availableFeatures ?? [];
  const hasKerning = features.includes('kern') || Boolean((font as unknown as { kern?: unknown }).kern);

  if (isVariable && axesRaw.ital) {
    warnings.push('This variable font has an ital axis; most browsers expect separate roman and italic files.');
  }

  return {
    format,
    family,
    subfamily: isVariable ? (italic ? 'Italic' : 'Roman') : subfamily,
    fullName: name('fullName') ?? `${family} ${subfamily}`,
    postscriptName: font.postscriptName ?? '',
    style: italic ? 'italic' : 'normal',
    weight,
    stretch,
    isVariable,
    axes,
    namedInstances,
    glyphCount: font.numGlyphs,
    characterSet,
    scripts: detectScripts(characterSet),
    unitsPerEm: font.unitsPerEm,
    metrics: computeMetrics(font, category),
    licence: {
      license: licenseText,
      licenseUrl,
      vendor: os2?.vendorID?.trim() || name('manufacturer') || undefined,
      copyright: name('copyright') ?? font.copyright ?? undefined,
      designer: name('designer') ?? undefined,
      version: name('version') ?? font.version?.toString(),
    },
    hasKerning,
    warnings,
  };
}

export function guessCategory(meta: Pick<FontMeta, 'family' | 'subfamily'>): string {
  const n = `${meta.family} ${meta.subfamily}`.toLowerCase();
  if (/mono|code|console/.test(n)) return 'monospace';
  if (/serif/.test(n) && !/sans/.test(n)) return 'serif';
  if (/script|hand|brush|marker/.test(n)) return 'handwriting';
  return 'sans-serif';
}

export const defaultFallbackStack = (category: string) =>
  category === 'serif'
    ? ['Georgia', 'serif']
    : category === 'monospace'
      ? ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      : category === 'handwriting'
        ? ['cursive']
        : ['system-ui', 'sans-serif'];
