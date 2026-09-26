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
