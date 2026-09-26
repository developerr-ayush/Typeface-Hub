import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFontFaces, bestSource } from '@/lib/css-import';
import { readFont, sniffFormat } from '@/lib/fonts/metadata';
import { formatUnicodeRange, parseUnicodeRange, planSubsets } from '@/lib/fonts/unicode';
import { a11yWarnings, DEFAULT_BREAKPOINTS, DEFAULT_TEXT_STYLES, fluidSize, tokensToCss } from '@/lib/tokens';

const bakbak = readFileSync(new URL('./fixtures/BakbakOne-Regular.ttf', import.meta.url));

describe('font metadata', () => {
  it('reads a static TTF', () => {
    expect(sniffFormat(bakbak)).toBe('ttf');
    const meta = readFont(bakbak);
    expect(meta.family).toBe('Bakbak One');
    expect(meta.weight).toBe(400);
    expect(meta.style).toBe('normal');
    expect(meta.isVariable).toBe(false);
    expect(meta.scripts).toContain('latin');
    expect(meta.scripts).toContain('devanagari');
    expect(meta.metrics.sizeAdjust).toBeGreaterThan(50);
  });
  it('rejects non-fonts with a fix', () => {
    expect(() => readFont(Buffer.from('<svg></svg> not a font at all'))).toThrow(/not a font/);
  });
});

describe('unicode ranges', () => {
  it('round-trips ranges', () => {
    expect(formatUnicodeRange([0x41, 0x42, 0x43, 0x100])).toBe('U+0041-0043,U+0100');
    expect(parseUnicodeRange('U+0000-00FF, U+0131')).toEqual([[0, 255], [0x131, 0x131]]);
  });
  it('splits a Latin + Devanagari font without near-empty subsets', () => {
    const names = planSubsets(readFont(bakbak).characterSet).map((s) => s.name);
    expect(names[0]).toBe('latin');
    expect(names).toContain('devanagari');
    expect(names).not.toContain('yi');
    expect(names).not.toContain('mongolian');
  });
});

describe('css import', () => {
  it('parses a Transfonter-style stylesheet and prefers TTF over legacy formats', () => {
    const faces = parseFontFaces(
      `@font-face { font-family: 'Montserrat'; src: url('Montserrat-Bold.eot'); src: url('Montserrat-Bold.eot?#iefix') format('embedded-opentype'), url("Montserrat-Bold.woff2") format('woff2'), url('Montserrat-Bold.ttf') format('truetype'), url('Montserrat-Bold.svg#M') format('svg'); font-weight: bold; font-style: normal; }`,
      'https://cdn.test/fonts/',
    );
    expect(faces).toHaveLength(1);
    expect(bestSource(faces[0])?.url).toBe('https://cdn.test/fonts/Montserrat-Bold.ttf');
  });
});

describe('tokens', () => {
  it('outputs mobile-first CSS variables and utility classes', () => {
    const css = tokensToCss(
      { theme: 'default', roles: { heading: { familyId: 'f1' }, body: { familyId: null } }, textStyles: { h1: DEFAULT_TEXT_STYLES.h1, body: DEFAULT_TEXT_STYLES.body }, breakpoints: DEFAULT_BREAKPOINTS },
      new Map([['f1', { cssName: 'Bakbak One', fallbackStack: ['system-ui', 'sans-serif'], hasFallbackFace: true, delivery: 'internal' }]]),
    );
    expect(css).toContain("--font-heading: 'Bakbak One', 'Bakbak One Fallback', system-ui, sans-serif;");
    expect(css).toContain('--font-body: system-ui, sans-serif;');
    expect(css).toContain('@media (min-width: 768px)');
    expect(css).toContain('.text-h1 {');
  });
  it('computes fluid sizes and accessibility warnings', () => {
    expect(fluidSize(2, 3.5, DEFAULT_BREAKPOINTS)).toMatch(/^clamp\(2rem, .+vw, 3\.5rem\)$/);
    expect(a11yWarnings({ body: { ...DEFAULT_TEXT_STYLES.body, size: { mobile: 0.8, tablet: 1, desktop: 1 }, lineHeight: 1.2 } })).toHaveLength(2);
  });
});

describe('font renaming', () => {
  it('rewrites names and keeps the font valid', async () => {
    const { renameFont, styleNames } = await import('@/lib/fonts/names');
    const out = renameFont(bakbak, styleNames('Brand Display', 300, true));
    const meta = readFont(out);
    expect(meta.family).toBe('Brand Display');
    expect(meta.subfamily).toBe('Light Italic');
    expect(meta.glyphCount).toBe(readFont(bakbak).glyphCount);
    expect(styleNames('Brand', 700, false)[1]).toBe('Brand');
    expect(styleNames('Brand', 700, false)[2]).toBe('Bold');
    expect(styleNames('Brand', 300, false)[1]).toBe('Brand Light');
  });
});

describe('style names with width', () => {
  it('names condensed and expanded instances', async () => {
    const { styleNames } = await import('@/lib/fonts/names');
    expect(styleNames('Open Sans', 700, false, 75)[17]).toBe('Condensed Bold');
    expect(styleNames('Open Sans', 700, false, 75)[1]).toBe('Open Sans Condensed');
    expect(styleNames('Open Sans', 400, true, 75)[17]).toBe('Condensed Italic');
    expect(styleNames('Open Sans', 300, false, 125)[1]).toBe('Open Sans Expanded Light');
    expect(styleNames('Open Sans', 400, false)[17]).toBe('Regular');
  });
});
