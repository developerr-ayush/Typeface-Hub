import { cleanCssName } from './css-names';
/** Parse @font-face rules from a stylesheet (custom stylesheet URLs and legacy CSS imports). */

export interface ParsedSource {
  url: string;
  format: string | null;
}
export interface ParsedFace {
  family: string;
  style: string;
  weight: string;
  stretch: string | null;
  unicodeRange: string | null;
  sources: ParsedSource[];
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const unquote = (s: string) => s.trim().replace(/^['"]|['"]$/g, '');

function formatFromUrl(url: string) {
  const ext = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase();
  return ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext === 'eot' ? 'embedded-opentype' : ext ?? null;
}

export function parseFontFaces(css: string, baseUrl?: string): ParsedFace[] {
  const out: ParsedFace[] = [];
  for (const m of stripComments(css).matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const decls = new Map<string, string>();
    for (const d of m[1].split(/;(?![^(]*\))/)) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      decls.set(d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim());
    }
    const family = decls.get('font-family');
    const src = decls.get('src');
    if (!family || !src) continue;
    const sources: ParsedSource[] = [];
    for (const s of src.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/gi)) {
      let url = s[2];
      if (url.startsWith('data:')) continue;
      try {
        url = baseUrl ? new URL(url, baseUrl).toString() : url;
      } catch {
        continue;
      }
      sources.push({ url, format: s[3]?.toLowerCase() ?? formatFromUrl(url) });
    }
    out.push({
      family: cleanCssName(unquote(family)),
      style: (decls.get('font-style') ?? 'normal').split(/\s+/)[0],
      weight: decls.get('font-weight') ?? '400',
      stretch: decls.get('font-stretch') ?? null,
      unicodeRange: decls.get('unicode-range') ?? null,
      sources,
    });
  }
  return out;
}

const FORMAT_PREFERENCE = ['truetype', 'opentype', 'truetype-variations', 'opentype-variations', 'woff2', 'woff2-variations', 'woff'];

/** Best source to use as a master: TTF/OTF, then WOFF2, then WOFF. EOT and SVG are ignored. */
export function bestSource(face: ParsedFace): ParsedSource | null {
  const usable = face.sources.filter((s) => s.format && FORMAT_PREFERENCE.includes(s.format));
  usable.sort((a, b) => FORMAT_PREFERENCE.indexOf(a.format!) - FORMAT_PREFERENCE.indexOf(b.format!));
  return usable[0] ?? null;
}

export function summarise(faces: ParsedFace[]) {
  const families = new Map<string, { family: string; faces: { weight: string; style: string; formats: string[] }[] }>();
  for (const f of faces) {
    const entry = families.get(f.family) ?? { family: f.family, faces: [] };
    const key = `${f.weight}|${f.style}`;
    if (!entry.faces.some((x) => `${x.weight}|${x.style}` === key)) {
      entry.faces.push({ weight: f.weight, style: f.style, formats: [...new Set(f.sources.map((s) => s.format ?? '?'))] });
    }
    families.set(f.family, entry);
  }
  return [...families.values()];
}
