import 'server-only';
import { unzipSync } from 'fflate';
import { badRequest } from '@/lib/http';
import { IconFontConfigSchema, nextCode, uniqueName, type IconFontConfig, type IconGlyph } from './config';
import { getSetGlyph, listSets } from './sets';

export interface ImportResult {
  config: IconFontConfig;
  /** Icons in the file that couldn't be used, with the reason. */
  skipped: { css: string; reason: string }[];
}

/** Find config.json in a Fontello download (fontello-xxxx/config.json). */
function configFromZip(buf: Uint8Array) {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buf, { filter: (f) => /(^|\/)config\.json$/i.test(f.name) && f.originalSize < 20_000_000 });
  } catch {
    throw badRequest('This ZIP file could not be read.');
  }
  const name = Object.keys(entries).sort((a, b) => a.length - b.length)[0];
  if (!name) throw badRequest('No config.json was found in the ZIP. Upload a Fontello or Typeface Hub download.');
  return new TextDecoder().decode(entries[name]);
}

/**
 * Read a Fontello config.json (or the ZIP Fontello and Typeface Hub download).
 * Icons from Fontello's own sets are matched by uid; custom icons keep their
 * embedded outlines.
 */
export async function importConfig(file: Uint8Array): Promise<ImportResult> {
  const isZip = file[0] === 0x50 && file[1] === 0x4b;
  const text = isZip ? configFromZip(file) : new TextDecoder().decode(file);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw badRequest('This is not a valid config.json file.');
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.glyphs)) throw badRequest('This config.json has no “glyphs” list. Is it a Fontello config?');

  const sets = new Set((await listSets()).map((s) => s.id));
  const scale = typeof raw.units_per_em === 'number' && raw.units_per_em > 0 ? 1000 / raw.units_per_em : 1;
  const skipped: ImportResult['skipped'] = [];
  const glyphs: IconGlyph[] = [];
  const names: string[] = [];
  const codes: number[] = [];

  for (const g of raw.glyphs as Record<string, unknown>[]) {
    if (!g || typeof g !== 'object' || g.selected === false) continue;
    const label = typeof g.css === 'string' ? g.css : String(g.uid ?? 'icon');
    if (glyphs.length >= 2000) {
      skipped.push({ css: label, reason: 'More than 2,000 icons' });
      continue;
    }
    const svg = g.svg as { path?: unknown; width?: unknown } | undefined;
    let d: string | undefined;
    let width: number | undefined;
    let src = typeof g.src === 'string' ? g.src : 'custom';
    if (typeof svg?.path === 'string' && svg.path) {
      d = svg.path;
      width = typeof svg.width === 'number' ? svg.width : 1000;
      if (scale !== 1) {
        const { default: SvgPath } = await import('svgpath');
        d = new SvgPath(d).scale(scale).round(1).toString();
        width = Math.round(width * scale);
      }
      const known = typeof g.uid === 'string' ? await getSetGlyph(g.uid) : null;
      src = known ? known.set : sets.has(src) ? src : 'custom';
    } else {
      const found = typeof g.uid === 'string' ? await getSetGlyph(g.uid) : null;
      if (!found) {
        skipped.push({ css: label, reason: 'Unknown icon (not in the bundled sets and no outline in the file)' });
        continue;
      }
      d = found.d;
      width = found.width;
      src = found.set;
    }
    if (d.length > 200_000) {
      skipped.push({ css: label, reason: 'Outline too large' });
      continue;
    }
    const css = uniqueName(label, names);
    names.push(css);
    let code = typeof g.code === 'number' && Number.isInteger(g.code) && g.code >= 0x20 && g.code <= 0x10ffff ? g.code : nextCode(codes);
    if (codes.includes(code)) code = nextCode(codes);
    codes.push(code);
    glyphs.push({ uid: typeof g.uid === 'string' && g.uid ? g.uid.slice(0, 64) : `custom-${glyphs.length}`, css, code, src, d, width });
  }

  const name = typeof raw.name === 'string' && /^[a-z0-9][a-z0-9-]*$/i.test(raw.name) ? raw.name.slice(0, 40) : 'icons';
  const prefix = typeof raw.css_prefix_text === 'string' && /^[a-z0-9_-]+$/i.test(raw.css_prefix_text) ? raw.css_prefix_text : 'icon-';
  const config = IconFontConfigSchema.parse({ name, prefix, suffix: raw.css_use_suffix === true, glyphs });
  return { config, skipped };
}
