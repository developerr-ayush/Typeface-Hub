import { describe, expect, it } from 'vitest';
import { buildStylesheet, cssQueryFor, CssQueryError, parseCssQuery, parseFamilyParam, selectFaces, type FaceWithFiles } from '@/lib/css-api';

const face = (id: string, style: 'normal' | 'italic', min: number, max = min, axes: { tag: string; min: number; max: number; default: number }[] = []): FaceWithFiles => ({
  id,
  versionId: 'v',
  name: id,
  style,
  weightMin: min,
  weightMax: max,
  stretchMin: 100,
  stretchMax: 100,
  axes,
  namedInstances: [],
  glyphCount: 100,
  scripts: ['latin'],
  metrics: { fallback: 'Arial', sizeAdjust: 105, ascentOverride: 90, descentOverride: 22, lineGapOverride: 0 },
  masterKey: null,
  masterBytes: 0,
  masterFormat: 'ttf',
  sha256: null,
  sourceFile: null,
  coverage: null,
  files: ['latin', 'latin-ext'].flatMap((subset) =>
    (['woff2', 'woff'] as const).map((format) => ({
      id: `${id}-${subset}-${format}`,
      faceId: id,
      format,
      subset,
      unicodeRange: subset === 'latin' ? 'U+0000-00FF' : 'U+0100-024F',
      name: `x-${id}-${subset}.abcdef1234.${format}`,
      bytes: 1000,
      sha256: 'x',
      glyphs: 10,
    })),
  ),
});

describe('parseFamilyParam', () => {
  it('parses Google CSS2 syntax', () => {
    const r = parseFamilyParam('Open+Sans:ital,wght@0,400;1,700..800');
    expect(r.name).toBe('Open Sans');
    expect(r.tuples).toEqual([
      { ital: 0, wght: [400, 400], wdth: null, axes: {} },
      { ital: 1, wght: [700, 800], wdth: null, axes: {} },
    ]);
  });
  it('accepts a bare family', () => {
    expect(parseFamilyParam('Bakbak+One').tuples).toEqual([]);
  });
  it('rejects mismatched tuples', () => {
    expect(() => parseFamilyParam('Inter:ital,wght@400')).toThrow(CssQueryError);
    expect(() => parseCssQuery(new URLSearchParams(''))).toThrow(CssQueryError);
  });
});

describe('selectFaces', () => {
  const statics = [face('r', 'normal', 400), face('b', 'normal', 700), face('i', 'italic', 400)];
  it('picks exact static faces and reports missing ones', () => {
    const { selected, missing } = selectFaces(statics, parseFamilyParam('X:wght@400;900'));
    expect(selected.map((s) => s.face.id)).toEqual(['r']);
    expect(missing).toEqual(['normal 900']);
  });
  it('defaults to the regular face', () => {
    expect(selectFaces(statics, parseFamilyParam('X')).selected.map((s) => s.face.id)).toEqual(['r']);
  });
  it('clips variable ranges to what was requested', () => {
    const vf = [face('vf', 'normal', 100, 900, [{ tag: 'wght', min: 100, max: 900, default: 400 }])];
    const { selected } = selectFaces(vf, parseFamilyParam('X:wght@300;700'));
    expect(selected).toHaveLength(1);
    expect(selected[0].weight).toEqual([300, 700]);
  });
});

describe('buildStylesheet', () => {
  it('emits one @font-face per subset with woff2 first and a fallback face', () => {
    const fam = { family: { cssName: 'Brand Sans', delivery: 'internal', display: 'swap', external: null } as never, faces: [face('r', 'normal', 400)] };
    const out = buildStylesheet([parseFamilyParam('Brand+Sans:wght@400')], new Map([['brand sans', fam]]), { display: null, fileBase: 'https://cdn.test/fonts/files' });
    expect(out.css.match(/@font-face/g)).toHaveLength(3);
    expect(out.css).toContain("src: url(https://cdn.test/fonts/files/x-r-latin.abcdef1234.woff2) format('woff2'), url(https://cdn.test/fonts/files/x-r-latin.abcdef1234.woff) format('woff')");
    expect(out.css.indexOf('/* latin-ext */')).toBeLessThan(out.css.indexOf('/* latin */'));
    expect(out.css).toContain("font-family: 'Brand Sans Fallback'");
    expect(out.css).toContain('size-adjust: 105%');
  });
  it('imports external Google families with only the tuples Google has', () => {
    const fam = { family: { cssName: 'Inter', delivery: 'external', display: 'swap', external: { provider: 'google', family: 'Inter' } } as never, faces: [] };
    const out = buildStylesheet([parseFamilyParam('Inter:wght@400;700')], new Map([['inter', fam]]), { display: 'optional', fileBase: '' });
    expect(out.css).toContain('@import url(https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700&display=optional);');
    expect(out.preconnect).toContain('https://fonts.gstatic.com');
  });
});

describe('cssQueryFor', () => {
  it('builds a canonical query', () => {
    expect(cssQueryFor([
      { family: 'Montserrat', weight: 700, italic: false },
      { family: 'Montserrat', weight: 400, italic: false },
      { family: 'Bakbak One', weight: 400, italic: false },
    ])).toBe('family=Bakbak+One:wght@400&family=Montserrat:wght@400;700&display=swap');
  });
});
