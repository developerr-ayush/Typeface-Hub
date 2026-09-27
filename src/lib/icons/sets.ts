import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hexUid } from './config';

/**
 * The icon sets bundled with the icon font editor (built by
 * scripts/build-icon-data.mjs). Every glyph is an SVG path, y pointing down,
 * scaled to 1000 units high, the same convention Fontello uses.
 */
export interface IconSet {
  id: string;
  name: string;
  author: string | null;
  homepage: string | null;
  license: string | null;
  licenseUrl: string | null;
  copyright: string | null;
  /** Which bundle the set comes from. */
  source: 'fontello' | 'mdi' | 'bootstrap';
  count: number;
}

export interface SetGlyph {
  uid: string;
  set: string;
  css: string;
  /** The code point the set itself uses (Fontello sets only). */
  code?: number;
  search: string[];
  width: number;
  d: string;
}

interface Bundle {
  sets: Omit<IconSet, 'source' | 'count'>[];
  glyphs: SetGlyph[];
}

const FILES = ['fontello', 'mdi', 'bootstrap'] as const;

let cache: Promise<{ sets: IconSet[]; glyphs: SetGlyph[]; byUid: Map<string, SetGlyph> }> | null = null;

async function load() {
  const bundles = await Promise.all(
    FILES.map(async (f) => [f, JSON.parse(await readFile(join(process.cwd(), 'src', 'data', 'icons', `${f}.json`), 'utf8')) as Bundle] as const),
  );
  const sets: IconSet[] = [];
  const glyphs: SetGlyph[] = [];
  for (const [source, b] of bundles) {
    for (const s of b.sets) sets.push({ ...s, source, count: b.glyphs.filter((g) => g.set === s.id).length });
    glyphs.push(...b.glyphs);
  }
  const byUid = new Map(glyphs.map((g) => [g.uid, g]));
  // Exported configs (Fontello format) carry icons from the non-Fontello sets as custom
  // icons with a hex uid derived from the original, so they can be matched again.
  for (const g of glyphs) if (!/^[0-9a-f]{32}$/.test(g.uid)) byUid.set(hexUid(g.uid), g);
  return { sets, glyphs, byUid };
}

export function iconData() {
  cache ??= load().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}

export async function listSets() {
  return (await iconData()).sets;
}

export async function getSetGlyph(uid: string) {
  return (await iconData()).byUid.get(uid) ?? null;
}

/**
 * Search the bundled sets. Name matches rank above tag matches; an empty query
 * lists a set in its own order.
 */
export async function searchIcons({ q = '', set, offset = 0, limit = 120 }: { q?: string; set?: string | null; offset?: number; limit?: number }) {
  const { glyphs } = await iconData();
  const terms = q.toLowerCase().trim().split(/[\s,]+/).filter(Boolean);
  let pool = set ? glyphs.filter((g) => g.set === set) : glyphs;
  const joined = terms.join('-');
  if (terms.length) {
    const scored: { g: SetGlyph; score: number }[] = [];
    for (const g of pool) {
      const css = g.css.toLowerCase();
      let score = 0;
      let all = true;
      for (const t of terms) {
        if (css === t) score += 100;
        else if (css.startsWith(t)) score += 40;
        else if (css.includes(t)) score += 20;
        else if (g.search.some((s) => s.toLowerCase() === t)) score += 10;
        else if (g.search.some((s) => s.toLowerCase().includes(t))) score += 4;
        else {
          all = false;
          break;
        }
      }
      if (css === joined) score += 200;
      if (all) scored.push({ g, score: score - css.length / 100 });
    }
    scored.sort((a, b) => b.score - a.score);
    pool = scored.map((s) => s.g);
  }
  return { total: pool.length, glyphs: pool.slice(offset, offset + limit) };
}
