// Builds src/data/google-fonts.json (a compact Google Fonts catalogue) and
// src/data/subsets.json (Google's unicode-range per subset) from the
// `google-font-metadata` npm package, so the app works without a Google API key.
// Usage: npm run catalog:build
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'gfm-'));
const tarball = execSync('npm view google-font-metadata dist.tarball').toString().trim();
execSync(`curl -sSL ${tarball} | tar xz -C ${dir}`);
const data = (f) => JSON.parse(readFileSync(join(dir, 'package/data', f), 'utf8'));

const v1 = data('google-fonts-v1.json');
const v2 = data('google-fonts-v2.json');
const variable = data('variable.json');
const licenses = data('licenses.json');

const licenceCode = (type = '') =>
  /apache/i.test(type) ? 'apache' : /ubuntu/i.test(type) ? 'ufl' : 'ofl';

const families = Object.values(v1)
  .map((f) => {
    const vf = variable[f.id];
    const axes = vf
      ? Object.entries(vf.axes)
          .map(([tag, a]) => ({ tag, min: +a.min, max: +a.max, default: +a.default }))
      : [];
    const variants = new Set();
    for (const [weight, styles] of Object.entries(v2[f.id]?.variants ?? {}))
      for (const style of Object.keys(styles)) variants.add(`${weight}${style === 'italic' ? 'i' : ''}`);
    return {
      family: f.family,
      id: f.id,
      category: f.category,
      subsets: f.subsets.filter((s) => s !== 'menu'),
      variants: [...variants].sort((a, b) => parseInt(a) - parseInt(b) || a.length - b.length),
      axes,
      licence: licenceCode(licenses[f.id]?.license?.type),
      modified: f.lastModified,
    };
  })
  .sort((a, b) => a.family.localeCompare(b.family));

// Most common unicode-range string per subset across the catalogue.
const counts = {};
for (const f of Object.values(v2))
  for (const [subset, range] of Object.entries(f.unicodeRange ?? {})) {
    if (/^\[\d+\]$/.test(subset)) continue; // CJK slices
    counts[subset] ??= {};
    counts[subset][range] = (counts[subset][range] ?? 0) + 1;
  }
const subsets = Object.fromEntries(
  Object.entries(counts)
    .map(([s, ranges]) => [s, Object.entries(ranges).sort((a, b) => b[1] - a[1])[0][0]])
    .filter(([s]) => s !== 'menu')
    .sort((a, b) => a[0].localeCompare(b[0])),
);

writeFileSync(new URL('../src/data/google-fonts.json', import.meta.url), JSON.stringify(families));
writeFileSync(new URL('../src/data/subsets.json', import.meta.url), JSON.stringify(subsets, null, 1));
console.log(`Wrote ${families.length} families and ${Object.keys(subsets).length} subsets`);
