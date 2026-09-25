import 'server-only';
import { createHash } from 'node:crypto';
import subsetFont from 'subset-font';
import { putObject } from '@/lib/storage';
import { FontError, readFont, type FontMeta } from './metadata';
import { planSubsets } from './unicode';

export const sha256 = (buf: Uint8Array) => createHash('sha256').update(buf).digest('hex');

export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'font';

export type AxisLimits = Record<string, { min: number; max: number } | number>;

export interface BuiltFile {
  format: 'woff2' | 'woff';
  subset: string;
  unicodeRange: string;
  name: string;
  bytes: number;
  sha256: string;
  glyphs: number;
}

export interface BuiltFace {
  meta: FontMeta;
  files: BuiltFile[];
  woff2Bytes: number;
  woffBytes: number;
}

function toText(cps: number[]) {
  let out = '';
  for (let i = 0; i < cps.length; i += 8192) out += String.fromCodePoint(...cps.slice(i, i + 8192));
  return out;
}

/**
 * Limit or pin variation axes (VAR-3, VAR-4) and return a new TrueType master.
 * Pinning every axis turns the font into a static instance.
 */
export async function instanceFont(buf: Buffer, limits: AxisLimits): Promise<Buffer> {
  const out = await subsetFont(buf, null, {
    targetFormat: 'sfnt',
    keepAllGlyphs: true,
    variationAxes: limits,
    preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 25],
  });
  return Buffer.from(out);
}

/**
 * Convert one master font into WOFF2 + WOFF files split by unicode-range
 * (PRC-4, PRC-5), upload them with content-hashed names (PRC-8).
 */
export async function buildFace(
  master: Buffer,
  opts: { familySlug: string; faceSlug: string; category: string; onProgress?: (msg: string) => void },
): Promise<BuiltFace> {
  const meta = readFont(master, opts.category);
  const plan = planSubsets(meta.characterSet);
  if (!plan.length) throw new FontError('The font does not map any characters.', 'Check that the font has a cmap table.');

  const files: BuiltFile[] = [];
  let woff2Bytes = 0;
  let woffBytes = 0;
  for (const subset of plan) {
    opts.onProgress?.(`Subsetting ${subset.name}`);
    const text = toText(subset.codepoints);
    for (const format of ['woff2', 'woff'] as const) {
      let data: Uint8Array;
      try {
        data = await subsetFont(master, text, {
          targetFormat: format,
          preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17],
        });
      } catch (e) {
        throw new FontError(`Could not convert the ${subset.name} subset to ${format.toUpperCase()}: ${(e as Error).message}`);
      }
      const hash = sha256(data);
      const name = `${opts.familySlug}-${opts.faceSlug}-${subset.name}.${hash.slice(0, 10)}.${format}`;
      await putObject(`files/${name}`, data, `font/${format}`);
      files.push({
        format,
        subset: subset.name,
        unicodeRange: subset.unicodeRange,
        name,
        bytes: data.byteLength,
        sha256: hash,
        glyphs: subset.codepoints.length,
      });
      if (format === 'woff2') woff2Bytes += data.byteLength;
      else woffBytes += data.byteLength;
    }
  }
  return { meta, files, woff2Bytes, woffBytes };
}

export function faceSlugFor(meta: Pick<FontMeta, 'isVariable' | 'style' | 'weight' | 'stretch'>) {
  const parts = [meta.isVariable ? 'vf' : String(meta.weight)];
  if (meta.stretch !== 100) parts.push(`w${Math.round(meta.stretch)}`);
  if (meta.style === 'italic') parts.push('italic');
  return parts.join('-');
}
