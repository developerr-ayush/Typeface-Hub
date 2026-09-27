import { z } from 'zod';

/**
 * An icon font definition. It mirrors Fontello's config.json (name, css prefix,
 * glyphs with a uid, css name and code point), so configs move freely between
 * Fontello and Typeface Hub. Glyph outlines are SVG paths (y pointing down)
 * scaled to 1000 units high.
 */

export const FIRST_CODE = 0xe800; // Fontello's first code point for new icons (Private Use Area)
export const MAX_GLYPHS = 2000;
export const MAX_PATH = 200_000;

const cssName = z
  .string()
  .trim()
  .min(1, 'Every icon needs a name.')
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Icon names may only use letters, digits, “-” and “_”.');

export const IconGlyphSchema = z.object({
  /** Stable id: a Fontello uid, "mdi-…"/"bi-…" for the other bundled sets, or random for uploads. */
  uid: z.string().min(1).max(64),
  css: cssName,
  code: z.number().int().min(0x20).max(0x10ffff),
  /** Which set the icon came from: a set id, or "custom" for uploaded SVGs. */
  src: z.string().min(1).max(40),
  /** Outline. Optional for bundled icons, which the server looks up by uid. */
  d: z.string().max(MAX_PATH).optional(),
  width: z.number().min(1).max(10_000).optional(),
});
export type IconGlyph = z.infer<typeof IconGlyphSchema>;

export const IconFontConfigSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*$/i, 'The font name may only use letters, digits and “-”.')
    .default('icons'),
  prefix: z
    .string()
    .min(1, 'Add a class prefix, such as “icon-”.')
    .max(24)
    .regex(/^[a-z0-9_-]+$/i,'The class prefix may only use letters, digits, “-” and “_”.')
    .default('icon-'),
  /** Fontello's css_use_suffix: classes look like "home-icon" instead of "icon-home". */
  suffix: z.boolean().default(false),
  glyphs: z.array(IconGlyphSchema).max(MAX_GLYPHS, `An icon font can hold at most ${MAX_GLYPHS} icons.`).default([]),
});
export type IconFontConfig = z.infer<typeof IconFontConfigSchema>;

export const emptyConfig = (): IconFontConfig => ({ name: 'icons', prefix: 'icon-', suffix: false, glyphs: [] });

/** Problems that stop a font from being built, one message per problem. */
export function validateConfig(cfg: IconFontConfig): string[] {
  const errors: string[] = [];
  if (!cfg.glyphs.length) errors.push('Pick at least one icon.');
  const names = new Map<string, number>();
  const codes = new Map<number, number>();
  for (const g of cfg.glyphs) {
    names.set(g.css, (names.get(g.css) ?? 0) + 1);
    codes.set(g.code, (codes.get(g.code) ?? 0) + 1);
  }
  for (const [n, c] of names) if (c > 1) errors.push(`The name “${n}” is used by ${c} icons.`);
  for (const [code, c] of codes) if (c > 1) errors.push(`The code ${hex(code)} is used by ${c} icons.`);
  return errors;
}

export const hex = (code: number) => code.toString(16).padStart(4, '0');

/** The next free code point from FIRST_CODE. */
export function nextCode(used: Iterable<number>) {
  const set = new Set(used);
  let c = FIRST_CODE;
  while (set.has(c)) c++;
  return c;
}

/** A name that isn't taken yet: "home", "home-2", … */
export function uniqueName(base: string, used: Iterable<string>) {
  const set = new Set(used);
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^[-_]+|-+$/g, '')
      .slice(0, 60) || 'icon';
  if (!set.has(clean)) return clean;
  for (let i = 2; ; i++) if (!set.has(`${clean}-${i}`)) return `${clean}-${i}`;
}

/** Class name for an icon, following the prefix or suffix convention. */
export const className = (cfg: Pick<IconFontConfig, 'prefix' | 'suffix'>, css: string) => (cfg.suffix ? `${css}${cfg.prefix}` : `${cfg.prefix}${css}`);

/** A 32-character hex id, deterministic for a given input (Fontello-style uid for exported icons). */
export function hexUid(input: string) {
  let out = '';
  for (let round = 0; round < 4; round++) {
    let h = 0x811c9dc5 ^ round;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

export function randomUid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Fontello config.json                                                */
/* ------------------------------------------------------------------ */

export interface FontelloConfig {
  name: string;
  css_prefix_text: string;
  css_use_suffix: boolean;
  hinting: boolean;
  units_per_em: number;
  ascent: number;
  glyphs: {
    uid: string;
    css: string;
    code: number;
    src: string;
    selected?: boolean;
    svg?: { path: string; width: number };
    search?: string[];
  }[];
}

/** Fontello's own sets are referenced by uid; everything else is embedded as a custom icon. */
export function toFontelloConfig(cfg: IconFontConfig, isFontelloSet: (src: string) => boolean): FontelloConfig {
  return {
    name: cfg.name,
    css_prefix_text: cfg.prefix,
    css_use_suffix: cfg.suffix,
    hinting: true,
    units_per_em: 1000,
    ascent: 850,
    glyphs: cfg.glyphs.map((g) =>
      isFontelloSet(g.src)
        ? { uid: g.uid, css: g.css, code: g.code, src: g.src }
        : {
            uid: /^[0-9a-f]{32}$/.test(g.uid) ? g.uid : hexUid(g.uid),
            css: g.css,
            code: g.code,
            src: 'custom_icons',
            selected: true,
            svg: { path: g.d ?? '', width: g.width ?? 1000 },
            search: [g.css],
          },
    ),
  };
}
