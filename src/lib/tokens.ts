import type { Breakpoints, RoleToken, TextStyle } from './db/schema';

export const DEFAULT_ROLES: Record<string, RoleToken> = {
  heading: { familyId: null },
  body: { familyId: null },
  display: { familyId: null },
  mono: { familyId: null },
};

const style = (role: string, weight: number, mobile: number, tablet: number, desktop: number, lineHeight: number, extra: Partial<TextStyle> = {}): TextStyle => ({
  role,
  weight,
  style: 'normal',
  size: { mobile, tablet, desktop },
  lineHeight,
  letterSpacing: 0,
  transform: 'none',
  ...extra,
});

export const DEFAULT_TEXT_STYLES: Record<string, TextStyle> = {
  h1: style('heading', 700, 2.25, 2.75, 3.5, 1.1, { letterSpacing: -0.02 }),
  h2: style('heading', 700, 1.875, 2.25, 2.75, 1.15, { letterSpacing: -0.01 }),
  h3: style('heading', 600, 1.5, 1.75, 2, 1.2),
  h4: style('heading', 600, 1.25, 1.375, 1.5, 1.25),
  h5: style('heading', 600, 1.125, 1.125, 1.25, 1.3),
  h6: style('heading', 600, 1, 1, 1.0625, 1.35),
  body: style('body', 400, 1, 1, 1.0625, 1.6),
  caption: style('body', 400, 0.8125, 0.8125, 0.875, 1.45),
  button: style('body', 600, 0.9375, 0.9375, 1, 1.2, { letterSpacing: 0.01 }),
  label: style('body', 500, 0.8125, 0.8125, 0.875, 1.3, { letterSpacing: 0.04, transform: 'uppercase' }),
};

export const DEFAULT_BREAKPOINTS: Breakpoints = { tablet: 768, desktop: 1200 };

export const STANDARD_STYLES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'caption', 'button', 'label'];

export interface ResolvedRole {
  role: string;
  familyId: string | null;
  cssName: string | null;
  stack: string; // full font-family value
  fallback: string[];
}

export interface TokenInput {
  theme: string;
  roles: Record<string, RoleToken>;
  textStyles: Record<string, TextStyle>;
  breakpoints: Breakpoints;
}

export type FamilyLookup = Map<string, { cssName: string; fallbackStack: string[]; hasFallbackFace: boolean; delivery: string }>;

const q = (s: string) => (/^[a-z-]+$/i.test(s) && !/\s/.test(s) ? s : `'${s.replace(/'/g, "\\'")}'`);
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math']);
const fam = (s: string) => (GENERIC.has(s) || s.startsWith('-apple') ? s : q(s));

export function resolveRoles(input: TokenInput, families: FamilyLookup): ResolvedRole[] {
  return Object.entries(input.roles).map(([role, token]) => {
    const f = token.familyId ? families.get(token.familyId) : undefined;
    const fallback = token.fallback?.length ? token.fallback : f?.fallbackStack ?? ['system-ui', 'sans-serif'];
    const parts = f ? [q(f.cssName), ...(f.hasFallbackFace ? [q(`${f.cssName} Fallback`)] : [])] : [];
    return {
      role,
      familyId: f ? token.familyId : null,
      cssName: f?.cssName ?? null,
      stack: [...parts, ...fallback.map(fam)].join(', '),
      fallback,
    };
  });
}

const rem = (n: number) => `${+n.toFixed(4)}rem`;

/** clamp() between the mobile size at 360px and the desktop size at the desktop breakpoint (TYP-4). */
export function fluidSize(min: number, max: number, bp: Breakpoints) {
  const minVw = 360 / 16;
  const maxVw = bp.desktop / 16;
  const slope = (max - min) / (maxVw - minVw);
  const intercept = min - slope * minVw;
  return `clamp(${rem(min)}, ${rem(intercept)} + ${+(slope * 100).toFixed(4)}vw, ${rem(max)})`;
}

/** CSS custom properties + utility classes (TYP-8). Mobile first, tablet and desktop overrides. */
export function tokensToCss(input: TokenInput, families: FamilyLookup) {
  const roles = resolveRoles(input, families);
  const root: string[] = [];
  const tablet: string[] = [];
  const desktop: string[] = [];
  for (const r of roles) root.push(`  --font-${r.role}: ${r.stack};`);
  for (const [name, s] of Object.entries(input.textStyles)) {
    const p = `--text-${name}`;
    root.push(`  ${p}-family: var(--font-${s.role});`);
    if (s.fluid) {
      root.push(`  ${p}-size: ${fluidSize(s.size.mobile, s.size.desktop, input.breakpoints)};`);
    } else {
      root.push(`  ${p}-size: ${rem(s.size.mobile)};`);
      if (s.size.tablet !== s.size.mobile) tablet.push(`    ${p}-size: ${rem(s.size.tablet)};`);
      if (s.size.desktop !== s.size.tablet) desktop.push(`    ${p}-size: ${rem(s.size.desktop)};`);
    }
    root.push(`  ${p}-weight: ${s.weight};`);
    if (s.style !== 'normal') root.push(`  ${p}-style: ${s.style};`);
    root.push(`  ${p}-line-height: ${s.lineHeight};`);
    root.push(`  ${p}-letter-spacing: ${s.letterSpacing ? `${s.letterSpacing}em` : '0'};`);
    if (s.transform !== 'none') root.push(`  ${p}-transform: ${s.transform};`);
  }
  const classes = Object.entries(input.textStyles).map(([name, s]) => {
    const p = `--text-${name}`;
    return [
      `.text-${name} {`,
      `  font-family: var(${p}-family);`,
      `  font-size: var(${p}-size);`,
      `  font-weight: var(${p}-weight);`,
      s.style !== 'normal' ? `  font-style: var(${p}-style);` : null,
      `  line-height: var(${p}-line-height);`,
      `  letter-spacing: var(${p}-letter-spacing);`,
      s.transform !== 'none' ? `  text-transform: var(${p}-transform);` : null,
      '}',
    ]
      .filter(Boolean)
      .join('\n');
  });
  const out = [`/* Typeface Hub tokens · theme: ${input.theme} */`, `:root {\n${root.join('\n')}\n}`];
  if (tablet.length) out.push(`@media (min-width: ${input.breakpoints.tablet}px) {\n  :root {\n${tablet.join('\n')}\n  }\n}`);
  if (desktop.length) out.push(`@media (min-width: ${input.breakpoints.desktop}px) {\n  :root {\n${desktop.join('\n')}\n  }\n}`);
  out.push(...classes);
  return out.join('\n\n') + '\n';
}

/** JSON tokens for SDUI and apps (TYP-8). */
export function tokensToJson(input: TokenInput, families: FamilyLookup) {
  const roles = resolveRoles(input, families);
  return {
    theme: input.theme,
    breakpoints: input.breakpoints,
    roles: Object.fromEntries(roles.map((r) => [r.role, { family: r.cssName, familyId: r.familyId, fontFamily: r.stack, fallback: r.fallback }])),
    styles: Object.fromEntries(
      Object.entries(input.textStyles).map(([name, s]) => [
        name,
        {
          role: s.role,
          fontFamily: roles.find((r) => r.role === s.role)?.stack ?? null,
          fontWeight: s.weight,
          fontStyle: s.style,
          fontSize: s.fluid
            ? { fluid: fluidSize(s.size.mobile, s.size.desktop, input.breakpoints), mobile: rem(s.size.mobile), desktop: rem(s.size.desktop) }
            : { mobile: rem(s.size.mobile), tablet: rem(s.size.tablet), desktop: rem(s.size.desktop) },
          lineHeight: s.lineHeight,
          letterSpacing: `${s.letterSpacing}em`,
          textTransform: s.transform,
        },
      ]),
    ),
  };
}

/** Faces the token set actually renders: one per (family, weight, style). */
export function usedFaces(input: TokenInput, families: FamilyLookup, only?: string[]) {
  const out: { family: string; familyId: string; weight: number; italic: boolean; styles: string[] }[] = [];
  for (const [name, s] of Object.entries(input.textStyles)) {
    if (only && !only.includes(name)) continue;
    const token = input.roles[s.role];
    const f = token?.familyId ? families.get(token.familyId) : undefined;
    if (!f || !token.familyId) continue;
    const existing = out.find((o) => o.familyId === token.familyId && o.weight === s.weight && o.italic === (s.style === 'italic'));
    if (existing) existing.styles.push(name);
    else out.push({ family: f.cssName, familyId: token.familyId, weight: s.weight, italic: s.style === 'italic', styles: [name] });
  }
  return out;
}

/** Type scale (TYP-3): size of step n from the base (body) size. */
export function scaleSteps(base: number, ratio: number) {
  const steps: Record<string, number> = { h6: 1, h5: 2, h4: 3, h3: 4, h2: 5, h1: 6 };
  return Object.fromEntries(Object.entries(steps).map(([k, n]) => [k, +(base * ratio ** n).toFixed(4)]));
}

/** Accessibility checks on text styles (ADM-8). */
export function a11yWarnings(styles: Record<string, TextStyle>) {
  const out: string[] = [];
  for (const [name, s] of Object.entries(styles)) {
    const isBody = s.role === 'body' || name === 'body';
    const minSize = Math.min(s.size.mobile, s.size.tablet, s.size.desktop);
    if (name === 'body' && minSize < 1) out.push(`Body text is ${minSize * 16}px on some screens; 16px (1rem) or more is recommended.`);
    if (isBody && name === 'body' && s.lineHeight < 1.4) out.push(`Body line height ${s.lineHeight} is below the recommended 1.4.`);
    if (isBody && s.weight < 300) out.push(`${name} uses weight ${s.weight}; very light weights are hard to read at text sizes.`);
    if (s.letterSpacing < -0.03) out.push(`${name} letter spacing ${s.letterSpacing}em is very tight.`);
    if (minSize < 0.75) out.push(`${name} is ${minSize * 16}px on some screens, which is too small for most readers.`);
  }
  return out;
}
