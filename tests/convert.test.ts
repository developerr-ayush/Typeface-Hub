import { readFileSync } from 'node:fs';
import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { convertFonts } from '@/lib/convert';
import { readFont } from '@/lib/fonts/metadata';

const bakbak = readFileSync(new URL('./fixtures/BakbakOne-Regular.ttf', import.meta.url));

describe('convertFonts', () => {
  it('builds a kit with every requested format, CSS, demo and README', async () => {
    const { zip, filename, summary } = await convertFonts([{ filename: 'BakbakOne-Regular.ttf', buffer: bakbak }], { formats: ['woff2', 'woff', 'sfnt'], characters: 'latin' });
    expect(filename).toBe('bakbak-one-webfont-kit.zip');
    const files = unzipSync(zip);
    const names = Object.keys(files).filter((n) => !n.endsWith('/')).sort();
    expect(names).toEqual([
      'bakbak-one-webfont-kit/README.txt',
      'bakbak-one-webfont-kit/css/bakbak-one.css',
      'bakbak-one-webfont-kit/demo.html',
      'bakbak-one-webfont-kit/fonts/bakbak-one-400.ttf',
      'bakbak-one-webfont-kit/fonts/bakbak-one-400.woff',
      'bakbak-one-webfont-kit/fonts/bakbak-one-400.woff2',
    ]);
    const css = new TextDecoder().decode(files['bakbak-one-webfont-kit/css/bakbak-one.css']);
    expect(css).toContain("url('../fonts/bakbak-one-400.woff2') format('woff2')");
    expect(css).toContain("format('truetype')");
    expect(css).toContain("'Bakbak One Fallback'");
    const woff2 = Buffer.from(files['bakbak-one-webfont-kit/fonts/bakbak-one-400.woff2']);
    expect(readFont(woff2).family).toBe('Bakbak One');
    expect(woff2.length).toBeLessThan(bakbak.length);
    expect(summary.families[0].family).toBe('Bakbak One');
  });

  it('unpacks ZIPs, skips duplicates and non-fonts', async () => {
    const zip = zipSync({ 'export/BakbakOne.ttf': new Uint8Array(bakbak), 'export/stylesheet.css': new TextEncoder().encode('x') });
    const { summary } = await convertFonts(
      [
        { filename: 'kit.zip', buffer: Buffer.from(zip) },
        { filename: 'copy.ttf', buffer: bakbak },
        { filename: 'notes.txt.woff', buffer: Buffer.from('not a font') },
      ],
      { formats: ['woff2'], demo: false },
    );
    expect(summary.families).toHaveLength(1);
    expect(summary.skipped.map((s) => s.file).sort()).toEqual(['copy.ttf', 'notes.txt.woff'].sort());
  });

  it('rejects uploads with no usable fonts', async () => {
    await expect(convertFonts([{ filename: 'x.ttf', buffer: Buffer.from('nope nope nope') }], {})).rejects.toThrow(/No usable fonts/);
  });
});

describe('demo page', () => {
  it('lists every combination with its CSS', async () => {
    const { combinations, cssFor, renderDemo } = await import('@/lib/kit-demo');
    const face = {
      name: 'Variable Roman',
      style: 'normal' as const,
      weight: [300, 700] as [number, number],
      stretch: [75, 100] as [number, number],
      axes: [
        { tag: 'wght', min: 300, max: 700, default: 400 },
        { tag: 'wdth', min: 75, max: 100, default: 100 },
        { tag: 'opsz', min: 14, max: 32, default: 14 },
      ],
      instances: [{ name: 'Bold', coords: { wght: 700, wdth: 100, opsz: 14 } }, { name: 'Black', coords: { wght: 900, wdth: 100, opsz: 14 } }],
    };
    expect(combinations(face)).toHaveLength(5 * 2 * 2); // wght 300..700 × wdth 75/100 × opsz 14/32
    expect(cssFor(face, { wght: 700, wdth: 75, opsz: 32 }, "'X'")).toEqual(["font-family: 'X';", 'font-weight: 700;', 'font-stretch: 75%;', "font-variation-settings: 'opsz' 32;"]);
    const html = renderDemo({ family: 'X', cssName: 'X', stack: "'X'", cssFile: 'css/x.css', version: null, faces: [face] });
    expect(html).toContain('All 20 combinations');
    expect(html).toContain('Named instances');
    expect(html).toContain('>Bold<');
    expect(html).not.toContain('>Black<'); // outside the kept weight range
  });
});
