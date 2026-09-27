// Builds the icon sets bundled with the icon font editor, in src/data/icons/:
//
//   fontello.json   Fontello's embedded sets (https://github.com/fontello/fontello,
//                   MIT; each set carries its own licence). Keeping this data lets
//                   Typeface Hub open any Fontello config.json.
//   mdi.json        Material Design Icons (@mdi/svg, Apache-2.0)
//   bootstrap.json  Bootstrap Icons (bootstrap-icons, MIT)
//
// Every glyph is stored the way Fontello stores custom icons: an SVG path
// (y pointing down) scaled to 1000 units high, plus its advance width.
//
// Usage: npm run icons:build            (all sets; downloads Fontello's data)
//        npm run icons:build -- --local (only the sets from node_modules)
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import SvgPath from 'svgpath';
import { svgToGlyph } from '../src/lib/icons/svg-to-glyph.ts';

const require = createRequire(import.meta.url);
const out = (name, data) => {
  writeFileSync(new URL(`../src/data/icons/${name}`, import.meta.url), JSON.stringify(data));
  console.log(`Wrote ${name}: ${data.sets.length} set(s), ${data.glyphs.length} glyphs`);
};
const compact = (d) => new SvgPath(d).round(0).toString();
const version = (pkg) => JSON.parse(readFileSync(require.resolve(`${pkg}/package.json`), 'utf8')).version;

/* Fontello ---------------------------------------------------------------- */
if (!process.argv.includes('--local')) {
  const url = 'https://raw.githubusercontent.com/fontello/fontello/master/lib/embedded_fonts/server_config.js';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const file = join(mkdtempSync(join(tmpdir(), 'fontello-')), 'server_config.cjs');
  writeFileSync(file, await res.text());
  const cfg = require(file);
  out('fontello.json', {
    source: 'https://github.com/fontello/fontello',
    sets: Object.entries(cfg.fonts).map(([id, f]) => {
      const meta = cfg.metas[id] ?? {};
      return {
        id,
        name: f.fullname ?? id,
        author: meta.author ?? null,
        homepage: meta.homepage ?? null,
        license: meta.license ?? null,
        licenseUrl: meta.license_url ?? null,
        copyright: f.copyright ?? null,
      };
    }),
    glyphs: Object.values(cfg.uids).map((g) => ({
      uid: g.uid,
      set: g.fontname,
      css: g.css,
      code: g.code,
      search: g.search ?? [],
      width: Math.round(g.svg.width),
      d: new SvgPath(g.svg.d).round(1).toString(),
    })),
  });
}

/* Material Design Icons ---------------------------------------------------- */
{
  const dir = join(require.resolve('@mdi/svg/package.json'), '..');
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const glyphs = [];
  for (const m of meta) {
    if (m.deprecated) continue;
    const g = svgToGlyph(readFileSync(join(dir, 'svg', `${m.name}.svg`), 'utf8'));
    glyphs.push({
      uid: `mdi-${m.name}`,
      set: 'mdi',
      css: m.name,
      search: [...new Set([...m.name.split('-'), ...m.aliases, ...m.tags.map((t) => t.toLowerCase())])],
      width: g.width,
      d: compact(g.d),
    });
  }
  out('mdi.json', {
    source: 'https://pictogrammers.com/library/mdi/',
    sets: [
      {
        id: 'mdi',
        name: `Material Design Icons ${version('@mdi/svg')}`,
        author: 'Pictogrammers',
        homepage: 'https://pictogrammers.com/library/mdi/',
        license: 'Apache-2.0',
        licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
        copyright: 'Copyright (c) Pictogrammers',
      },
    ],
    glyphs,
  });
}

/* Bootstrap Icons ---------------------------------------------------------- */
{
  const dir = join(require.resolve('bootstrap-icons/package.json'), '..', 'icons');
  const glyphs = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
    const name = file.slice(0, -4);
    const g = svgToGlyph(readFileSync(join(dir, file), 'utf8'));
    glyphs.push({ uid: `bi-${name}`, set: 'bootstrap', css: name, search: name.split('-'), width: g.width, d: compact(g.d) });
  }
  out('bootstrap.json', {
    source: 'https://icons.getbootstrap.com',
    sets: [
      {
        id: 'bootstrap',
        name: `Bootstrap Icons ${version('bootstrap-icons')}`,
        author: 'The Bootstrap Authors',
        homepage: 'https://icons.getbootstrap.com',
        license: 'MIT',
        licenseUrl: 'https://github.com/twbs/icons/blob/main/LICENSE',
        copyright: 'Copyright (c) 2019-2024 The Bootstrap Authors',
      },
    ],
    glyphs,
  });
}
