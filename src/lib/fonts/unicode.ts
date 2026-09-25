import subsetRanges from '@/data/subsets.json';

export type Range = [number, number];

export function parseUnicodeRange(input: string): Range[] {
  return input
    .split(',')
    .map((part) => part.trim().replace(/^U\+/i, ''))
    .filter(Boolean)
    .map((part) => {
      if (part.includes('?')) {
        return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'F'), 16)] as Range;
      }
      const [a, b] = part.split('-');
      const start = parseInt(a, 16);
      return [start, b ? parseInt(b, 16) : start] as Range;
    })
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
}

const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

/** Sorted code points → "U+0000-00FF,U+0131" */
export function formatUnicodeRange(codepoints: number[]): string {
  const sorted = [...new Set(codepoints)].sort((a, b) => a - b);
  const out: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cp = sorted[i];
    if (cp === prev + 1) {
      prev = cp;
      continue;
    }
    if (start !== undefined) out.push(start === prev ? `U+${hex(start)}` : `U+${hex(start)}-${hex(prev)}`);
    start = cp;
    prev = cp;
  }
  return out.join(',');
}

export const inRanges = (cp: number, ranges: Range[]) => ranges.some(([a, b]) => cp >= a && cp <= b);

/** Subsets in the order they are generated. The first few are the ones most sites need. */
const PRIORITY = ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext'];

export const SUBSETS: { name: string; range: string; ranges: Range[] }[] = Object.entries(subsetRanges as Record<string, string>)
  .sort(([a], [b]) => {
    const ia = PRIORITY.indexOf(a);
    const ib = PRIORITY.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  })
  .map(([name, range]) => ({ name, range, ranges: parseUnicodeRange(range) }));

const LATIN = SUBSETS.find((s) => s.name === 'latin')!.ranges;

// Minimum number of code points (outside Latin) a font must cover before a subset is created.
const MIN_UNIQUE: Record<string, number> = { latin: 1, 'latin-ext': 1, vietnamese: 20, cyrillic: 10, 'cyrillic-ext': 8, greek: 10, 'greek-ext': 8 };

// Characters that are never worth a subset of their own.
const IGNORABLE = (cp: number) => cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || cp === 0xfeff || cp === 0xfffd || cp >= 0xfffe;

export interface PlannedSubset {
  name: string;
  unicodeRange: string;
  codepoints: number[];
}

/**
 * Split a font's character set into Google-style subsets. Characters not in any
 * known subset go into an "other" subset so nothing the font supports is lost.
 */
export function planSubsets(characterSet: number[]): PlannedSubset[] {
  const chars = characterSet.filter((cp) => !IGNORABLE(cp));
  const covered = new Set<number>();
  const plan: PlannedSubset[] = [];

  for (const subset of SUBSETS) {
    const cps = chars.filter((cp) => inRanges(cp, subset.ranges));
    if (!cps.length) continue;
    // Only count characters no earlier subset already covers, so shared punctuation
    // and combining marks don't create near-empty subsets for unrelated scripts.
    const unique = subset.name === 'latin' ? cps.length : cps.filter((cp) => !covered.has(cp) && !inRanges(cp, LATIN)).length;
    if (unique < (MIN_UNIQUE[subset.name] ?? 16)) continue;
    cps.forEach((cp) => covered.add(cp));
    plan.push({ name: subset.name, unicodeRange: subset.range, codepoints: cps });
  }

  const rest = chars.filter((cp) => !covered.has(cp));
  if (rest.length) {
    if (!plan.length) {
      // No recognised script (for example icon or symbol fonts): one file, no unicode-range.
      plan.push({ name: 'all', unicodeRange: '', codepoints: rest });
    } else {
      plan.push({ name: 'other', unicodeRange: formatUnicodeRange(rest), codepoints: rest });
    }
  }
  return plan;
}

/** Scripts a font supports, by subset name, for the specimen page. */
export function detectScripts(characterSet: number[]) {
  return planSubsets(characterSet)
    .map((s) => s.name)
    .filter((n) => n !== 'other' && n !== 'all');
}
