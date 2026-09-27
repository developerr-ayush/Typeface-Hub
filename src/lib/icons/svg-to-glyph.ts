import { DOMParser, type Element as XmlElement } from '@xmldom/xmldom';
import SvgPath from 'svgpath';

/**
 * Convert an SVG icon into a glyph outline in Fontello's convention: SVG
 * coordinates (y pointing down) scaled so the icon is 1000 units tall, with the
 * advance width scaled to match. The font builder later flips it into font space.
 */
export interface Glyph {
  d: string;
  width: number;
}
export interface GlyphResult extends Glyph {
  warnings: string[];
}

export class SvgError extends Error {}

const num = (v: string | null | undefined, fallback = 0) => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : fallback;
};

const SKIP = new Set(['defs', 'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'symbol', 'style', 'title', 'desc', 'metadata', 'text', 'image', 'filter', 'marker']);

function styleValue(el: XmlElement, prop: string): string | null {
  const style = el.getAttribute('style');
  if (style) {
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(style);
    if (m) return m[1].trim();
  }
  return el.hasAttribute(prop) ? el.getAttribute(prop) : null;
}

function points(attr: string | null) {
  const nums = (attr ?? '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

/** Path data for a basic shape element. */
function shapeToPath(el: XmlElement): string | null {
  switch (el.localName ?? el.tagName) {
    case 'path':
      return el.getAttribute('d');
    case 'rect': {
      const x = num(el.getAttribute('x'));
      const y = num(el.getAttribute('y'));
      const w = num(el.getAttribute('width'));
      const h = num(el.getAttribute('height'));
      if (w <= 0 || h <= 0) return null;
      let rx = num(el.getAttribute('rx'), NaN);
      let ry = num(el.getAttribute('ry'), NaN);
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case 'circle':
    case 'ellipse': {
      const cx = num(el.getAttribute('cx'));
      const cy = num(el.getAttribute('cy'));
      const rx = el.hasAttribute('r') ? num(el.getAttribute('r')) : num(el.getAttribute('rx'));
      const ry = el.hasAttribute('r') ? num(el.getAttribute('r')) : num(el.getAttribute('ry'));
      if (rx <= 0 || ry <= 0) return null;
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case 'polygon':
    case 'polyline': {
      const pts = points(el.getAttribute('points'));
      if (pts.length < 3) return null;
      return `M${pts.map(([a, b]) => `${a} ${b}`).join('L')}Z`;
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Even-odd → non-zero: make nested contours alternate direction       */
/* ------------------------------------------------------------------ */

type Seg = [string, ...number[]];

/** Split an absolute path (M/L/C/Q/Z only) into closed contours. */
function contours(d: string): Seg[][] {
  const out: Seg[][] = [];
  let cur: Seg[] = [];
  new SvgPath(d)
    .abs()
    .unarc()
    .unshort()
    .iterate((seg, _i, x, y) => {
      const cmd = seg[0];
      if (cmd === 'M') {
        if (cur.length) out.push(cur);
        cur = [['M', seg[1] as number, seg[2] as number]];
      } else if (cmd === 'H') cur.push(['L', seg[1] as number, y]);
      else if (cmd === 'V') cur.push(['L', x, seg[1] as number]);
      else if (cmd === 'Z') cur.push(['Z']);
      else cur.push([cmd, ...(seg.slice(1) as number[])] as Seg);
    });
  if (cur.length) out.push(cur);
  return out.filter((c) => c.length > 1);
}

/** On-curve points of a contour (control points are ignored), for area and containment tests. */
function polygon(c: Seg[]) {
  const pts: [number, number][] = [];
  for (const s of c) if (s[0] !== 'Z') pts.push([s[s.length - 2] as number, s[s.length - 1] as number]);
  return pts;
}

// Also sample curve midpoints so shapes made of a few curves (circles) get a usable polygon.
function densePolygon(c: Seg[]) {
  const pts: [number, number][] = [];
  let px = 0;
  let py = 0;
  for (const s of c) {
    if (s[0] === 'M' || s[0] === 'L') {
      px = s[1] as number;
      py = s[2] as number;
      pts.push([px, py]);
    } else if (s[0] === 'C') {
      const [, x1, y1, x2, y2, x, y] = s as [string, number, number, number, number, number, number];
      for (const t of [0.25, 0.5, 0.75]) {
        const mt = 1 - t;
        pts.push([mt ** 3 * px + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x, mt ** 3 * py + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y]);
      }
      px = x;
      py = y;
      pts.push([px, py]);
    } else if (s[0] === 'Q') {
      const [, x1, y1, x, y] = s as [string, number, number, number, number];
      for (const t of [0.25, 0.5, 0.75]) {
        const mt = 1 - t;
        pts.push([mt * mt * px + 2 * mt * t * x1 + t * t * x, mt * mt * py + 2 * mt * t * y1 + t * t * y]);
      }
      px = x;
      py = y;
      pts.push([px, py]);
    }
  }
  return pts.length >= 3 ? pts : polygon(c);
}

const area = (p: [number, number][]) => p.reduce((a, [x, y], i) => {
  const [nx, ny] = p[(i + 1) % p.length];
  return a + (x * ny - nx * y);
}, 0) / 2;

function inside([x, y]: [number, number], poly: [number, number][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function reverse(c: Seg[]): Seg[] {
  const start = c[0] as [string, number, number];
  // Collect segments with their start points so they can be walked backwards.
  const segs: { cmd: string; args: number[]; from: [number, number] }[] = [];
  let cur: [number, number] = [start[1], start[2]];
  let closed = false;
  for (const s of c.slice(1)) {
    if (s[0] === 'Z') {
      closed = true;
      continue;
    }
    const args = s.slice(1) as number[];
    segs.push({ cmd: s[0], args, from: cur });
    cur = [args[args.length - 2], args[args.length - 1]];
  }
  const out: Seg[] = [['M', cur[0], cur[1]]];
  for (let i = segs.length - 1; i >= 0; i--) {
    const { cmd, args, from } = segs[i];
    if (cmd === 'C') out.push(['C', args[2], args[3], args[0], args[1], from[0], from[1]]);
    else if (cmd === 'Q') out.push(['Q', args[0], args[1], from[0], from[1]]);
    else out.push(['L', from[0], from[1]]);
  }
  if (closed) out.push(['Z']);
  return out;
}

/**
 * Rewrite an even-odd path so it renders the same under the non-zero rule used
 * by fonts: each contour's direction alternates with how deeply it is nested.
 */
export function evenOddToNonZero(d: string): string {
  const cs = contours(d);
  if (cs.length < 2) return d;
  const polys = cs.map(densePolygon);
  const result = cs.map((c, i) => {
    const probe = polys[i][0];
    const depth = polys.reduce((n, p, j) => (j !== i && Math.abs(area(p)) > Math.abs(area(polys[i])) && inside(probe, p) ? n + 1 : n), 0);
    const clockwise = area(polys[i]) > 0; // y points down in SVG space
    const wantClockwise = depth % 2 === 0;
    return clockwise === wantClockwise ? c : reverse(c);
  });
  return result.map((c) => c.map((s) => s[0] + s.slice(1).map((n) => +(n as number).toFixed(3)).join(' ')).join('')).join('');
}

/* ------------------------------------------------------------------ */
/* Main conversion                                                     */
/* ------------------------------------------------------------------ */

export function svgToGlyph(svg: string): GlyphResult {
  if (svg.length > 1_000_000) throw new SvgError('The SVG is larger than 1 MB.');
  const warnings: string[] = [];
  const errors: string[] = [];
  let doc: ReturnType<DOMParser['parseFromString']>;
  try {
    doc = new DOMParser({ onError: (level, msg) => void (level === 'fatalError' && errors.push(msg)) }).parseFromString(svg, 'image/svg+xml');
  } catch {
    throw new SvgError('This file is not a valid SVG.');
  }
  const root = doc.documentElement as unknown as XmlElement | null;
  if (!root || errors.length || (root.localName ?? root.tagName) !== 'svg') throw new SvgError('This file is not a valid SVG.');

  const vb = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  let [vx, vy, vw, vh] = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, num(root.getAttribute('width')), num(root.getAttribute('height'))];
  if (!(vw > 0 && vh > 0)) throw new SvgError('The SVG has no viewBox or size, so it can’t be scaled.');

  const parts: string[] = [];
  let strokeOnly = 0;
  let skippedUse = 0;

  const walk = (el: XmlElement, transforms: string[], inheritedFill: string | null, inheritedRule: string) => {
    const name = el.localName ?? el.tagName;
    if (SKIP.has(name)) return;
    if (styleValue(el, 'display') === 'none' || styleValue(el, 'visibility') === 'hidden') return;
    const t = el.getAttribute('transform');
    const chain = t ? [t, ...transforms] : transforms;
    const fill = styleValue(el, 'fill') ?? inheritedFill;
    const rule = styleValue(el, 'fill-rule') ?? inheritedRule;
    if (name === 'use') {
      skippedUse++;
      return;
    }
    const d = shapeToPath(el);
    if (d) {
      if (fill === 'none' || fill === 'transparent') {
        if (styleValue(el, 'stroke') && styleValue(el, 'stroke') !== 'none') strokeOnly++;
        return;
      }
      let p = new SvgPath(d);
      for (const tr of chain) p = p.transform(tr);
      let out = p.toString();
      if (rule === 'evenodd') out = evenOddToNonZero(out);
      parts.push(out);
      return;
    }
    for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) walk(n as unknown as XmlElement, chain, fill, rule);
  };
  for (let n = root.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) walk(n as unknown as XmlElement, [], styleValue(root, 'fill'), styleValue(root, 'fill-rule') ?? 'nonzero');

  if (strokeOnly) warnings.push(`${strokeOnly} outline-only shape${strokeOnly > 1 ? 's were' : ' was'} skipped. Fonts can only hold filled shapes: convert strokes to outlines (in Figma: Outline stroke; in Illustrator: Outline Stroke) and upload again.`);
  if (skippedUse) warnings.push('<use> references were skipped; flatten the SVG first.');
  if (!parts.length) throw new SvgError(strokeOnly ? 'This icon is made only of strokes. Fonts can only hold filled shapes: convert strokes to outlines and upload it again.' : 'No filled shapes were found in the SVG.');

  const scale = 1000 / vh;
  const d = new SvgPath(parts.join(' ')).translate(-vx, -vy).scale(scale).round(1).toString();
  return { d, width: Math.round(vw * scale), warnings };
}

/** A CSS-friendly icon name from a file name. */
export function iconName(filename: string) {
  return (
    filename
      .replace(/\.svg$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'icon'
  );
}
