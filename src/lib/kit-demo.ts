/**
 * demo.html for a web font kit: a playground with a slider per axis and the
 * CSS to copy, every useful combination of the kit's variants with its CSS,
 * and the named instances. Plain HTML + a little inline JS, works offline.
 */

export interface DemoAxis {
  tag: string;
  name?: string;
  min: number;
  max: number;
  default: number;
}
export interface DemoFace {
  name: string;
  style: 'normal' | 'italic';
  weight: [number, number];
  stretch: [number, number];
  axes: DemoAxis[]; // axes still variable in the delivered file
  instances: { name: string; coords: Record<string, number> }[];
}
export interface DemoInput {
  family: string;
  cssName: string;
  stack: string;
  cssFile: string;
  version: number | null;
  faces: DemoFace[];
}

const AXIS_NAMES: Record<string, string> = { wght: 'Weight', wdth: 'Width', opsz: 'Optical size', slnt: 'Slant', ital: 'Italic', GRAD: 'Grade' };
const REGISTERED = new Set(['wght', 'wdth', 'slnt', 'ital']);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const num = (n: number) => +n.toFixed(2);
export const axisName = (a: Pick<DemoAxis, 'tag' | 'name'>) => AXIS_NAMES[a.tag] ?? a.name ?? a.tag;

/**
 * CSS for one combination. Registered axes use their CSS properties; optical
 * size and custom axes go in font-variation-settings.
 */
export function cssFor(face: DemoFace, coords: Record<string, number>, stack: string) {
  const lines: string[] = [`font-family: ${stack};`];
  const weight = coords.wght ?? face.weight[0];
  lines.push(`font-weight: ${num(weight)};`);
  const stretch = coords.wdth ?? face.stretch[0];
  if (stretch !== 100) lines.push(`font-stretch: ${num(stretch)}%;`);
  if (face.style === 'italic') lines.push('font-style: italic;');
  else if (coords.slnt !== undefined && coords.slnt !== 0) lines.push(`font-style: oblique ${num(-coords.slnt)}deg;`);
  const custom = Object.entries(coords).filter(([tag]) => !REGISTERED.has(tag));
  if (custom.length) lines.push(`font-variation-settings: ${custom.map(([tag, v]) => `'${tag}' ${num(v)}`).join(', ')};`);
  return lines;
}

/** Sample values per axis; the cartesian product gives the combinations shown. */
function sampleValues(a: DemoAxis, dense: boolean) {
  const inRange = (v: number) => v >= a.min && v <= a.max;
  let values: number[];
  if (a.tag === 'wght') {
    values = dense ? [a.min, ...[100, 200, 300, 400, 500, 600, 700, 800, 900].filter(inRange), a.max] : [a.min, ...[400, 700].filter(inRange), a.max];
  } else if (a.tag === 'wdth') {
    values = [a.min, ...[100].filter(inRange), a.max];
  } else if (a.tag === 'slnt') {
    values = [...[0].filter(inRange), a.min, a.max];
  } else if (a.tag === 'opsz') {
    values = [a.min, a.max];
  } else {
    values = dense ? [a.min, a.default, a.max] : [a.min, a.max];
  }
  return [...new Set(values.map(num))].sort((x, y) => x - y);
}

const MAX_COMBINATIONS = 120;

export function combinations(face: DemoFace): Record<string, number>[] {
  const axes = face.axes.filter((a) => a.tag !== 'ital');
  if (!axes.length) return [{}];
  for (const dense of [true, false]) {
    const lists = axes.map((a) => sampleValues(a, dense));
    const count = lists.reduce((n, l) => n * l.length, 1);
    if (count <= MAX_COMBINATIONS || !dense) {
      let combos: Record<string, number>[] = [{}];
      axes.forEach((a, i) => {
        combos = combos.flatMap((c) => lists[i].map((v) => ({ ...c, [a.tag]: v })));
      });
      return combos.slice(0, MAX_COMBINATIONS);
    }
  }
  return [{}];
}

function label(face: DemoFace, coords: Record<string, number>) {
  const parts = face.axes.filter((a) => coords[a.tag] !== undefined).map((a) => `${axisName(a)} ${num(coords[a.tag])}`);
  if (!parts.length) parts.push(`Weight ${face.weight[0]}`, ...(face.stretch[0] !== 100 ? [`Width ${face.stretch[0]}`] : []));
  if (face.style === 'italic') parts.push('Italic');
  return parts.join(' · ');
}

const styleAttr = (lines: string[]) => lines.join(' ').replace(/"/g, '&quot;');

function row(face: DemoFace, coords: Record<string, number>, stack: string, title?: string) {
  const css = cssFor(face, coords, stack);
  const code = css.join('\n');
  return `        <div class="row">
          <div class="row-head"><span class="label">${esc(title ?? label(face, coords))}</span><button class="copy" data-css="${esc(code)}">Copy CSS</button></div>
          <p class="sample" style="${styleAttr(css)}">The quick brown fox jumps over the lazy dog</p>
          <pre><code>${esc(code)}</code></pre>
        </div>`;
}

export function renderDemo(input: DemoInput): string {
  const { faces, stack } = input;
  const sections = faces
    .map((face, i) => {
      const combos = combinations(face);
      const withinLimits = (coords: Record<string, number>) =>
        face.axes.every((a) => coords[a.tag] === undefined || (coords[a.tag] >= a.min - 0.001 && coords[a.tag] <= a.max + 0.001));
      const instances = face.instances
        .filter((n) => withinLimits(n.coords))
        .map((n) => ({ name: n.name, coords: Object.fromEntries(Object.entries(n.coords).filter(([tag]) => face.axes.some((a) => a.tag === tag && tag !== 'ital'))) }));
      const axesText = face.axes.length ? face.axes.map((a) => `${axisName(a)} ${a.min}–${a.max}`).join(', ') : 'static';
      return `      <section class="face" id="face-${i}">
        <h3>${esc(face.name)} <span class="muted">${esc(axesText)}</span></h3>
        <h4>${combos.length > 1 ? `All ${combos.length} combinations` : 'This face'}</h4>
${combos.map((c) => row(face, c, stack)).join('\n')}
${instances.length ? `        <h4>Named instances</h4>\n${instances.map((n) => row(face, n.coords, stack, n.name)).join('\n')}` : ''}
      </section>`;
    })
    .join('\n');

  const data = JSON.stringify({ stack, faces }).replace(/</g, '\\u003c');
  const hasVariable = faces.some((f) => f.axes.length);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(input.family)} · web font kit</title>
    <link rel="stylesheet" href="${esc(input.cssFile)}" />
    <style>
      :root { --ink: #16181d; --muted: #676d7c; --line: #e4e6eb; --bg: #f6f7f9; --accent: #4f46e5; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 32px 20px 64px; font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--ink); background: var(--bg); }
      main { max-width: 1000px; margin: 0 auto; }
      h1 { font-family: ${esc(stack)}; font-size: 48px; font-weight: 400; margin: 0; line-height: 1.1; }
      h2 { font-size: 18px; margin: 40px 0 12px; }
      h3 { font-size: 16px; margin: 0 0 4px; }
      h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 20px 0 8px; }
      .muted { color: var(--muted); font-weight: 400; font-size: 13px; }
      .lead { color: var(--muted); margin: 6px 0 0; }
      .card, .face { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
      nav.toc { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      nav.toc a { font-size: 13px; color: var(--accent); text-decoration: none; background: #eef0ff; padding: 4px 10px; border-radius: 999px; }
      .row { border-top: 1px solid var(--line); padding: 14px 0; }
      .row-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .label { font-size: 12px; color: var(--muted); }
      .sample { font-size: 32px; line-height: 1.2; margin: 6px 0 8px; overflow-wrap: anywhere; }
      pre { margin: 0; background: #0f1117; color: #e6e8ee; padding: 10px 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; line-height: 1.55; }
      button.copy { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 4px 10px; font: inherit; font-size: 12px; cursor: pointer; }
      button.copy:hover { border-color: #cfd3db; }
      .play-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px 20px; margin: 12px 0; }
      .play-grid label { display: block; font-size: 12px; color: var(--muted); }
      .play-grid input[type=range] { width: 100%; accent-color: var(--accent); }
      .val { float: right; color: var(--ink); font-variant-numeric: tabular-nums; }
      select, textarea { font: inherit; border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; background: #fff; }
      textarea { width: 100%; resize: vertical; border: 0; padding: 0; outline: none; background: transparent; line-height: 1.15; }
      .note { font-size: 12px; color: var(--muted); }
    </style>
  </head>
  <body>
    <main>
      <h1>${esc(input.family)}</h1>
      <p class="lead">${input.version ? `Version ${input.version} · ` : ''}${faces.length} face${faces.length === 1 ? '' : 's'} · Open this page from the kit folder so the fonts load.</p>
      <nav class="toc">${faces.map((f, i) => `<a href="#face-${i}">${esc(f.name)}</a>`).join('')}</nav>

      <h2>Use it</h2>
      <div class="card">
<pre><code>&lt;link rel="stylesheet" href="${esc(input.cssFile)}"&gt;

body { font-family: ${esc(stack)}; }</code></pre>
        <p class="note">Copy <code>fonts/</code> and <code>css/</code> into your project, keeping them side by side.${hasVariable ? ' For variable fonts, weight, width and slant use normal CSS properties; optical size is picked from the font size automatically (<code>font-optical-sizing: auto</code>) unless you set it in <code>font-variation-settings</code>.' : ''}</p>
      </div>

      <h2>Playground</h2>
      <div class="card" id="playground">
        <label class="note">Face <select id="pg-face"></select></label>
        <div class="play-grid" id="pg-controls"></div>
        <textarea id="pg-text" rows="2">The quick brown fox jumps over the lazy dog</textarea>
        <div class="row-head" style="margin-top:12px"><span class="label">CSS for what you see</span><button class="copy" id="pg-copy">Copy CSS</button></div>
        <pre><code id="pg-css"></code></pre>
      </div>

      <h2>Every combination</h2>
      <p class="note">Each sample shows a combination of the variants in this kit, with the CSS that produces it.</p>
${sections}
    </main>
    <script>
      const DATA = ${data};
      const REGISTERED = ['wght', 'wdth', 'slnt', 'ital'];
      const NAMES = ${JSON.stringify(AXIS_NAMES)};
      const n = (v) => +(+v).toFixed(2);
      function cssFor(face, c, size) {
        const l = ['font-family: ' + DATA.stack + ';'];
        if (size) l.push('font-size: ' + n(size / 16) + 'rem;');
        l.push('font-weight: ' + n(c.wght ?? face.weight[0]) + ';');
        const st = c.wdth ?? face.stretch[0];
        if (st !== 100) l.push('font-stretch: ' + n(st) + '%;');
        if (face.style === 'italic') l.push('font-style: italic;');
        else if (c.slnt !== undefined && c.slnt !== 0) l.push('font-style: oblique ' + n(-c.slnt) + 'deg;');
        const custom = Object.entries(c).filter(([t]) => !REGISTERED.includes(t));
        if (custom.length) l.push('font-variation-settings: ' + custom.map(([t, v]) => "'" + t + "' " + n(v)).join(', ') + ';');
        return l;
      }
      function copy(btn, text) {
        navigator.clipboard?.writeText(text).then(() => { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = t), 1200); });
      }
      document.querySelectorAll('button.copy[data-css]').forEach((b) => b.addEventListener('click', () => copy(b, b.dataset.css)));

      const faceSel = document.getElementById('pg-face');
      const controls = document.getElementById('pg-controls');
      const text = document.getElementById('pg-text');
      const out = document.getElementById('pg-css');
      DATA.faces.forEach((f, i) => faceSel.add(new Option(f.name + (f.axes.length ? ' (variable)' : ''), i)));
      let state = {};
      function render() {
        const face = DATA.faces[faceSel.value];
        const coords = Object.fromEntries(face.axes.filter((a) => a.tag !== 'ital').map((a) => [a.tag, state[a.tag]]));
        const lines = cssFor(face, coords, state.size);
        text.setAttribute('style', lines.join(' '));
        out.textContent = lines.join('\\n');
        controls.querySelectorAll('[data-val]').forEach((el) => (el.textContent = n(state[el.dataset.val]) + (el.dataset.val === 'size' ? 'px' : '')));
      }
      function build() {
        const face = DATA.faces[faceSel.value];
        state = { size: 48 };
        const axes = face.axes.filter((a) => a.tag !== 'ital');
        axes.forEach((a) => (state[a.tag] = a.tag === 'wght' ? Math.min(a.max, Math.max(a.min, 400)) : a.default));
        const slider = (key, name, min, max, step) =>
          '<label>' + name + ' <span class="val" data-val="' + key + '"></span><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + state[key] + '" data-key="' + key + '"></label>';
        controls.innerHTML = slider('size', 'Size', 10, 160, 1) + axes.map((a) => slider(a.tag, (NAMES[a.tag] || a.name || a.tag) + ' (' + a.tag + ')', a.min, a.max, a.max - a.min > 20 ? 1 : 0.1)).join('') +
          (axes.length ? '' : '<p class="note">This face is static: one weight and style.</p>');
        controls.querySelectorAll('input').forEach((el) => el.addEventListener('input', () => { state[el.dataset.key] = +el.value; render(); }));
        render();
      }
      faceSel.addEventListener('change', build);
      document.getElementById('pg-copy').addEventListener('click', (e) => copy(e.target, out.textContent));
      build();
    </script>
  </body>
</html>
`;
}
