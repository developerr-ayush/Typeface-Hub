import 'server-only';
import { randomUUID } from 'node:crypto';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { defaultFallbackStack, FontError, guessCategory, readFont, type FontMeta } from './fonts/metadata';
import { slugify } from './fonts/process';
import { badRequest } from './http';
import { buildKitTree, type KitOptions, type KitSource } from './kit';

export const CONVERT_LIMITS = {
  maxFiles: 12,
  maxFileBytes: 15 * 1024 * 1024,
  maxTotalBytes: 40 * 1024 * 1024,
  perHour: 30,
};

const FONT_EXT = /\.(ttf|otf|woff2?)$/i;
const FORMAT_RANK: Record<string, number> = { ttf: 0, otf: 0, woff2: 1, woff: 2 };

export interface ConvertInput {
  filename: string;
  buffer: Buffer;
}

export interface ConvertSummary {
  families: { family: string; faces: { name: string; weight: string; style: string; variable: boolean; file: string }[] }[];
  skipped: { file: string; reason: string }[];
  files: number;
}

/** Expand ZIPs (e.g. old Transfonter exports) into their font files; ignore CSS, EOT and SVG. */
function expand(inputs: ConvertInput[], skipped: ConvertSummary['skipped']): ConvertInput[] {
  const out: ConvertInput[] = [];
  for (const input of inputs) {
    if (input.buffer[0] === 0x50 && input.buffer[1] === 0x4b) {
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(new Uint8Array(input.buffer), { filter: (f) => FONT_EXT.test(f.name) && !f.name.startsWith('__MACOSX') });
      } catch {
        skipped.push({ file: input.filename, reason: 'The ZIP file is corrupt.' });
        continue;
      }
      const names = Object.keys(entries).filter((n) => !n.endsWith('/'));
      if (!names.length) skipped.push({ file: input.filename, reason: 'No TTF, OTF, WOFF or WOFF2 files inside.' });
      for (const n of names) out.push({ filename: n.split('/').pop()!, buffer: Buffer.from(entries[n]) });
    } else {
      out.push(input);
    }
  }
  return out;
}

/**
 * Convert uploaded fonts into web font kits without storing anything:
 * files are read, grouped by family and packed into one ZIP in memory.
 */
export async function convertFonts(inputs: ConvertInput[], opts: Partial<KitOptions>) {
  if (!inputs.length) throw badRequest('Add at least one font file.');
  const skipped: ConvertSummary['skipped'] = [];
  const files = expand(inputs, skipped);
  if (files.length > CONVERT_LIMITS.maxFiles * 3) throw badRequest(`That is too many fonts at once. Convert at most ${CONVERT_LIMITS.maxFiles * 3} files per kit.`);

  const read: { file: ConvertInput; meta: FontMeta }[] = [];
  for (const file of files) {
    if (file.buffer.length > CONVERT_LIMITS.maxFileBytes) {
      skipped.push({ file: file.filename, reason: `Larger than ${CONVERT_LIMITS.maxFileBytes / 1024 / 1024} MB.` });
      continue;
    }
    try {
      read.push({ file, meta: readFont(file.buffer) });
    } catch (e) {
      const err = e as FontError;
      skipped.push({ file: file.filename, reason: err.fix ? `${err.message} ${err.fix}` : err.message });
    }
  }

  // Group by family; the same face in several formats keeps the best master.
  const families = new Map<string, Map<string, { file: ConvertInput; meta: FontMeta }>>();
  for (const r of read) {
    const faceKey = `${r.meta.style}|${r.meta.isVariable ? 'vf' : r.meta.weight}|${r.meta.stretch}`;
    const faces = families.get(r.meta.family) ?? new Map();
    const prev = faces.get(faceKey);
    if (prev) {
      const keep = (FORMAT_RANK[r.meta.format] ?? 9) < (FORMAT_RANK[prev.meta.format] ?? 9) ? r : prev;
      const drop = keep === r ? prev : r;
      skipped.push({ file: drop.file.filename, reason: `Same face as ${keep.file.filename}.` });
      faces.set(faceKey, keep);
    } else {
      faces.set(faceKey, r);
    }
    families.set(r.meta.family, faces);
  }
  if (!families.size) {
    throw badRequest(skipped.length ? `No usable fonts: ${skipped.map((s) => `${s.file}: ${s.reason}`).join(' ')}` : 'No usable fonts were found.');
  }

  const summary: ConvertSummary = { families: [], skipped, files: 0 };
  const tree: Zippable = {};
  for (const [name, faces] of families) {
    const list = [...faces.values()];
    const category = guessCategory(list[0].meta);
    const sources: KitSource[] = list.map(({ file, meta }) => {
      const wght = meta.axes.find((a) => a.tag === 'wght');
      const wdth = meta.axes.find((a) => a.tag === 'wdth');
      return {
        id: randomUUID(),
        name: meta.isVariable ? `Variable ${meta.style === 'italic' ? 'Italic' : 'Roman'}` : meta.subfamily,
        style: meta.style,
        weightMin: wght ? Math.round(wght.min) : meta.weight,
        weightMax: wght ? Math.round(wght.max) : meta.weight,
        stretchMin: wdth ? Math.round(wdth.min) : Math.round(meta.stretch),
        stretchMax: wdth ? Math.round(wdth.max) : Math.round(meta.stretch),
        axes: meta.axes,
        metrics: readFont(file.buffer, category).metrics,
        masterFormat: meta.format,
        load: async () => file.buffer,
      };
    });
    sources.sort((a, b) => Number(a.style !== 'normal') - Number(b.style !== 'normal') || a.weightMin - b.weightMin);
    const detected = list[0].meta.licence;
    const kit = await buildKitTree(
      {
        displayName: name,
        cssName: name,
        fallbackStack: defaultFallbackStack(category),
        licence: { detected: { license: detected.license, licenseUrl: detected.licenseUrl, vendor: detected.vendor, copyright: detected.copyright } },
      },
      null,
      sources,
      { ...opts, faceIds: undefined, tokensCss: null },
    );
    tree[kit.root] = kit.tree;
    summary.files += kit.files.filter((f) => f.path.startsWith('fonts/')).length;
    summary.families.push({
      family: name,
      faces: list.map(({ file, meta }) => ({
        name: meta.subfamily,
        weight: (() => {
          const w = meta.axes.find((a) => a.tag === 'wght');
          return w ? `${Math.round(w.min)}–${Math.round(w.max)}` : String(meta.weight);
        })(),
        style: meta.style,
        variable: meta.isVariable,
        file: file.filename,
      })),
    });
  }

  const zip = zipSync(tree, { level: 6 });
  const filename = families.size === 1 ? `${slugify([...families.keys()][0])}-webfont-kit.zip` : 'webfont-kits.zip';
  return { zip, filename, summary };
}
