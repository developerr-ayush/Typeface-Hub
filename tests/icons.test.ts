import * as fontkit from 'fontkit';
import { strToU8, unzipSync, zipSync } from 'fflate';
import SvgPath from 'svgpath';
import { describe, expect, it } from 'vitest';
import { buildFontFiles, buildIconKit, resolveConfig } from '@/lib/icons/build';
import { className, nextCode, uniqueName, validateConfig } from '@/lib/icons/config';
import { importConfig } from '@/lib/icons/import';
import { searchIcons, getSetGlyph } from '@/lib/icons/sets';
import { evenOddToNonZero, svgToGlyph, SvgError } from '@/lib/icons/svg-to-glyph';

const bbox = (d: string) => {
  const xs: number[] = [];
  const ys: number[] = [];
  new SvgPath(d + 'M0 0').abs().unarc().iterate((_s, i, x, y) => {
    if (!i) return;
    xs.push(x);
    ys.push(y);
  });
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

describe('svgToGlyph', () => {
  it('scales the viewBox to 1000 units high', () => {
    const g = svgToGlyph('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2H22V22H2Z"/></svg>');
    expect(g.width).toBe(1000);
    expect(bbox(g.d).map(Math.round)).toEqual([83, 83, 917, 917]);
  });

  it('handles shapes, transforms, viewBox offsets and wide icons', () => {
    const g = svgToGlyph(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 20 10"><g transform="translate(10 10)"><rect width="10" height="10"/><circle cx="15" cy="5" r="5"/></g></svg>',
    );
    expect(g.width).toBe(2000);
    expect(bbox(g.d).map(Math.round)).toEqual([0, 0, 2000, 1000]);
  });

  it('skips strokes with a warning, and rejects stroke-only icons', () => {
    const mixed = svgToGlyph('<svg viewBox="0 0 10 10"><path d="M0 0H10V10Z"/><path fill="none" stroke="#000" d="M0 0L10 10"/></svg>');
    expect(mixed.warnings[0]).toMatch(/outline-only/);
    expect(() => svgToGlyph('<svg viewBox="0 0 10 10"><path fill="none" stroke="#000" d="M0 0L10 10"/></svg>')).toThrow(SvgError);
    expect(() => svgToGlyph('not svg')).toThrow(SvgError);
  });

  it('turns even-odd holes into opposite-direction contours', () => {
    // Two squares drawn the same way: even-odd makes the inner one a hole.
    const d = evenOddToNonZero('M0 0H10V10H0Z M3 3H7V7H3Z');
    const [outer, inner] = d.split('M').filter(Boolean).map((c) => new SvgPath('M' + c).abs());
    const signed = (p: ReturnType<typeof SvgPath>) => {
      const pts: [number, number][] = [];
      p.iterate((s: (string | number)[]) => void (s.length >= 3 && pts.push([s[s.length - 2] as number, s[s.length - 1] as number])));
      return pts.reduce((a, [x, y], i) => a + x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y, 0);
    };
    expect(Math.sign(signed(outer))).toBe(-Math.sign(signed(inner)));
  });
});

describe('config helpers', () => {
  it('assigns codes and names', () => {
    expect(nextCode([0xe800, 0xe801])).toBe(0xe802);
    expect(uniqueName('Home Icon', ['home-icon'])).toBe('home-icon-2');
    expect(className({ prefix: 'icon-', suffix: false }, 'home')).toBe('icon-home');
    expect(className({ prefix: '-icon', suffix: true }, 'home')).toBe('home-icon');
  });

  it('reports duplicate names and codes', () => {
    const errors = validateConfig({
      name: 'x',
      prefix: 'icon-',
      suffix: false,
      glyphs: [
        { uid: 'a', css: 'home', code: 0xe800, src: 'custom', d: 'M0 0H1V1Z', width: 1000 },
        { uid: 'b', css: 'home', code: 0xe800, src: 'custom', d: 'M0 0H1V1Z', width: 1000 },
      ],
    });
    expect(errors).toHaveLength(2);
  });
});

describe('icon sets', () => {
  it('searches the bundled sets', async () => {
    const { glyphs } = await searchIcons({ q: 'home', limit: 5 });
    expect(glyphs.length).toBe(5);
    expect(glyphs[0].css).toMatch(/home/);
    expect((await searchIcons({ q: 'arrow left', set: 'mdi', limit: 1 })).glyphs[0].css).toBe('arrow-left');
    const mdi = await searchIcons({ q: 'account', set: 'mdi', limit: 1 });
    expect(mdi.glyphs[0].uid).toBe('mdi-account');
    expect(await getSetGlyph('bi-alarm-fill')).toBeTruthy();
  });
});

describe('icon font builder', () => {
  it('builds a font with the chosen code points from every source', async () => {
    const custom = svgToGlyph('<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="8"/></svg>');
    const { glyphs } = await resolveConfig({
      name: 'test-icons',
      glyphs: [
        { uid: '9dd9e835aebe1060ba7190ad2b2ed951', css: 'search', code: 0xe800, src: 'fontawesome' },
        { uid: 'mdi-account', css: 'account', code: 0xe801, src: 'mdi' },
        { uid: 'bi-alarm-fill', css: 'alarm', code: 0xe802, src: 'bootstrap' },
        { uid: 'c1', css: 'dot', code: 0xe803, src: 'custom', d: custom.d, width: custom.width },
      ],
    });
    const files = await buildFontFiles('test-icons', glyphs);
    const font = fontkit.create(Buffer.from(files.ttf)) as fontkit.Font;
    expect(font.familyName).toBe('test-icons');
    expect(font.unitsPerEm).toBe(1000);
    for (const code of [0xe800, 0xe801, 0xe802, 0xe803]) {
      const glyph = font.glyphForCodePoint(code);
      expect(glyph.id).toBeGreaterThan(0);
      expect(glyph.path.commands.length).toBeGreaterThan(3);
    }
    // The custom dot fills the em box from the descender to the ascender.
    const dot = font.glyphForCodePoint(0xe803).bbox;
    expect([dot.minY, dot.maxY].map(Math.round)).toEqual([-150, 850]);
    const woff2 = fontkit.create(Buffer.from(files.woff2)) as fontkit.Font;
    expect(woff2.glyphForCodePoint(0xe801).id).toBeGreaterThan(0);
  });

  it('writes a kit that opens again as a config', async () => {
    const kit = await buildIconKit({
      name: 'app',
      prefix: 'ic-',
      glyphs: [
        { uid: '9dd9e835aebe1060ba7190ad2b2ed951', css: 'search', code: 0xe800, src: 'fontawesome' },
        { uid: 'mdi-account', css: 'user', code: 0xe801, src: 'mdi' },
      ],
    });
    const files = unzipSync(kit.zip);
    expect(Object.keys(files).filter((f) => !f.endsWith('/')).sort()).toEqual(
      ['LICENSE.txt', 'README.md', 'config.json', 'css/app-codes.css', 'css/app-embedded.css', 'css/app.css', 'demo.html', 'font/app.ttf', 'font/app.woff', 'font/app.woff2'].map((f) => `app-icons/${f}`),
    );
    const css = new TextDecoder().decode(files['app-icons/css/app.css']);
    expect(css).toContain(`[class^="ic-"]:before, [class*=" ic-"]:before`);
    expect(css).toContain(`.ic-user:before { content: '\\e801'; }`);
    expect(new TextDecoder().decode(files['app-icons/LICENSE.txt'])).toMatch(/Font Awesome[\s\S]*Material Design Icons/);

    const config = JSON.parse(new TextDecoder().decode(files['app-icons/config.json']));
    expect(config.glyphs[0]).toEqual({ uid: '9dd9e835aebe1060ba7190ad2b2ed951', css: 'search', code: 0xe800, src: 'fontawesome' });
    expect(config.glyphs[1].src).toBe('custom_icons');

    const back = await importConfig(kit.zip);
    expect(back.skipped).toEqual([]);
    expect(back.config.prefix).toBe('ic-');
    expect(back.config.glyphs.map((g) => [g.css, g.code, g.src])).toEqual([
      ['search', 0xe800, 'fontawesome'],
      ['user', 0xe801, 'mdi'],
    ]);
  });

  it('imports Fontello configs and reports unknown icons', async () => {
    const cfg = {
      name: 'fontello',
      css_prefix_text: 'icon-',
      css_use_suffix: false,
      units_per_em: 1000,
      ascent: 850,
      glyphs: [
        { uid: '9dd9e835aebe1060ba7190ad2b2ed951', css: 'search', code: 59392, src: 'fontawesome' },
        { uid: 'ffffffffffffffffffffffffffffffff', css: 'gone', code: 59393, src: 'fontawesome' },
        { uid: 'abc', css: 'mine', code: 59394, src: 'custom_icons', selected: true, svg: { path: 'M0 0H1000V1000H0Z', width: 1000 } },
        { uid: 'off', css: 'off', code: 59395, src: 'custom_icons', selected: false, svg: { path: 'M0 0H1Z', width: 1000 } },
      ],
    };
    const res = await importConfig(zipSync({ 'fontello-1234/config.json': strToU8(JSON.stringify(cfg)) }));
    expect(res.config.glyphs.map((g) => g.css)).toEqual(['search', 'mine']);
    expect(res.skipped).toEqual([{ css: 'gone', reason: expect.stringMatching(/Unknown/) }]);
  });
});
