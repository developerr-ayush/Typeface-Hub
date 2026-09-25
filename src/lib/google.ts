import 'server-only';
import catalogJson from '@/data/google-fonts.json';

export interface GoogleFamily {
  family: string;
  id: string;
  category: string;
  subsets: string[];
  variants: string[]; // "400", "700i"
  axes: { tag: string; min: number; max: number; default: number }[];
  licence: 'ofl' | 'apache' | 'ufl';
  modified: string;
}

const bundled = catalogJson as GoogleFamily[];

// Popular families listed first when there is no search query.
const POPULAR = [
  'Roboto', 'Inter', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Noto Sans', 'Oswald', 'Raleway', 'Nunito',
  'Playfair Display', 'Rubik', 'Work Sans', 'DM Sans', 'Merriweather', 'Bebas Neue', 'Manrope', 'IBM Plex Sans',
  'Outfit', 'Plus Jakarta Sans', 'Space Grotesk', 'Barlow', 'Fira Sans', 'Source Sans 3', 'JetBrains Mono',
  'Lora', 'PT Serif', 'Archivo', 'Mulish', 'Kanit', 'Anton', 'Bakbak One', 'Figtree', 'Sora', 'Libre Baskerville',
  'Noto Serif', 'Roboto Mono', 'Crimson Pro', 'Space Mono', 'Fraunces',
];

let live: { at: number; list: GoogleFamily[] } | null = null;

/** Catalogue: the live Google Fonts Developer API when GOOGLE_FONTS_API_KEY is set, else the bundled snapshot. */
export async function googleCatalog(): Promise<GoogleFamily[]> {
  const key = process.env.GOOGLE_FONTS_API_KEY;
  if (!key) return bundled;
  if (live && Date.now() - live.at < 6 * 3600_000) return live.list;
  try {
    const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${key}&capability=VF`, {
      next: { revalidate: 21600 },
    });
    if (!res.ok) throw new Error(`Google Fonts API ${res.status}`);
    const data = (await res.json()) as {
      items: { family: string; category: string; subsets: string[]; variants: string[]; axes?: { tag: string; start: number; end: number }[]; lastModified: string }[];
    };
    const byName = new Map(bundled.map((f) => [f.family, f]));
    const list = data.items.map((it) => {
      const known = byName.get(it.family);
      return {
        family: it.family,
        id: it.family.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: it.category,
        subsets: it.subsets.filter((s) => s !== 'menu'),
        variants: it.variants.map((v) => (v === 'regular' ? '400' : v === 'italic' ? '400i' : v.replace('italic', 'i'))),
        axes: (it.axes ?? []).map((a) => ({
          tag: a.tag,
          min: a.start,
          max: a.end,
          default: known?.axes.find((k) => k.tag === a.tag)?.default ?? (a.tag === 'wght' ? Math.min(Math.max(400, a.start), a.end) : a.start),
        })),
        licence: known?.licence ?? 'ofl',
        modified: it.lastModified,
      } satisfies GoogleFamily;
    });
    live = { at: Date.now(), list };
    return list;
  } catch (e) {
    console.warn('[google] live catalogue unavailable, using bundled snapshot:', (e as Error).message);
    return bundled;
  }
}

export async function findGoogle(name: string) {
  const list = await googleCatalog();
  return list.find((f) => f.family.toLowerCase() === name.toLowerCase()) ?? null;
}

export async function searchGoogle(opts: { q?: string; category?: string; variable?: boolean; limit?: number; offset?: number }) {
  const list = await googleCatalog();
  const q = opts.q?.trim().toLowerCase();
  let items = list.filter(
    (f) =>
      (!q || f.family.toLowerCase().includes(q)) &&
      (!opts.category || opts.category === 'all' || f.category === opts.category) &&
      (!opts.variable || f.axes.length > 0),
  );
  if (q) {
    items = items.sort((a, b) => Number(!a.family.toLowerCase().startsWith(q)) - Number(!b.family.toLowerCase().startsWith(q)) || a.family.localeCompare(b.family));
  } else {
    const rank = (f: GoogleFamily) => {
      const i = POPULAR.indexOf(f.family);
      return i < 0 ? 999 : i;
    };
    items = items.sort((a, b) => rank(a) - rank(b) || a.family.localeCompare(b.family));
  }
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 48;
  return { total: items.length, items: items.slice(offset, offset + limit) };
}

/* ------------------------------------------------------------------ */
/* Import as internal: download master files                         */
/* ------------------------------------------------------------------ */

const RAW = 'https://raw.githubusercontent.com/google/fonts/main';

async function fetchBuffer(url: string) {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function parseMetadataPb(text: string) {
  const fonts: { style: string; weight: number; filename: string }[] = [];
  for (const block of text.matchAll(/fonts\s*\{([\s\S]*?)\n\}/g)) {
    const body = block[1];
    const style = /style:\s*"([^"]+)"/.exec(body)?.[1] ?? 'normal';
    const weight = Number(/weight:\s*(\d+)/.exec(body)?.[1] ?? 400);
    const filename = /filename:\s*"([^"]+)"/.exec(body)?.[1];
    if (filename) fonts.push({ style, weight, filename });
  }
  return fonts;
}

export interface GoogleSelection {
  styles: ('normal' | 'italic')[];
  weights: number[]; // for static families; ignored for variable
}

/**
 * Fetch the original TTF masters for a Google family from the google/fonts
 * repository (variable masters where available). Falls back to the static
 * TTF instances Google's CSS API serves.
 */
export async function fetchGoogleMasters(family: GoogleFamily, sel: GoogleSelection): Promise<{ filename: string; buffer: Buffer }[]> {
  const dir = family.family.toLowerCase().replace(/[^a-z0-9]/g, '');
  const licences = [family.licence, 'ofl', 'apache', 'ufl'].filter((v, i, a) => a.indexOf(v) === i);
  for (const lic of licences) {
    const res = await fetch(`${RAW}/${lic}/${dir}/METADATA.pb`, { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) continue;
    const fonts = parseMetadataPb(await res.text());
    const variable = fonts.filter((f) => f.filename.includes('['));
    const picked = (variable.length ? variable : fonts).filter(
      (f) => sel.styles.includes(f.style as 'normal' | 'italic') && (variable.length > 0 || sel.weights.includes(f.weight)),
    );
    const unique = [...new Map(picked.map((f) => [f.filename, f])).values()];
    if (!unique.length) continue;
    return Promise.all(
      unique.map(async (f) => ({ filename: f.filename, buffer: await fetchBuffer(`${RAW}/${lic}/${dir}/${encodeURIComponent(f.filename)}`) })),
    );
  }

  // Fallback: Google's CSS API serves full TTF instances to user agents it doesn't recognise.
  const tuples = sel.styles.flatMap((s) => sel.weights.map((w) => `${s === 'italic' ? 1 : 0},${w}`));
  const url = `https://fonts.googleapis.com/css2?family=${family.family.replace(/ /g, '+')}:ital,wght@${tuples.sort().join(';')}`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'TypefaceHub/1.0' } });
  if (!res.ok) throw new Error(`Google Fonts returned ${res.status} for ${family.family}`);
  const css = await res.text();
  const urls = [...css.matchAll(/url\((https:[^)]+\.ttf)\)/g)].map((m) => m[1]);
  if (!urls.length) throw new Error(`No downloadable files found for ${family.family}`);
  return Promise.all([...new Set(urls)].map(async (u, i) => ({ filename: `${family.id}-${i}.ttf`, buffer: await fetchBuffer(u) })));
}

export const googleLicenceType = (l: GoogleFamily['licence']) => (l === 'apache' ? 'Apache' : l === 'ufl' ? 'UFL' : 'OFL') as 'OFL' | 'Apache' | 'UFL';
