/**
 * Rewrite the naming of a TrueType/OpenType (sfnt) font. Used when static
 * instances are cut from a variable font: HarfBuzz pins the axes but keeps the
 * default instance's names (e.g. "Montserrat Thin"), which breaks desktop installs.
 */

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
};

const WIDTH_NAMES: [number, string][] = [
  [50, 'UltraCondensed'], [62.5, 'ExtraCondensed'], [75, 'Condensed'], [87.5, 'SemiCondensed'], [100, ''],
  [112.5, 'SemiExpanded'], [125, 'Expanded'], [150, 'ExtraExpanded'], [200, 'UltraExpanded'],
];
const widthName = (width: number) => WIDTH_NAMES.reduce((a, b) => (Math.abs(b[0] - width) < Math.abs(a[0] - width) ? b : a))[1];

export function styleNames(family: string, weight: number, italic: boolean, width = 100) {
  const w = WEIGHT_NAMES[Math.round(weight / 100) * 100] ?? String(weight);
  const wd = widthName(width);
  const base = [wd, w === 'Regular' && wd ? '' : w].filter(Boolean).join(' ');
  const typographic = base === 'Regular' && italic ? 'Italic' : italic ? `${base} Italic` : base;
  // Legacy (name ID 1/2) families only allow Regular/Bold/Italic/Bold Italic.
  const ribbi = weight === 400 || weight === 700;
  const legacyFamily = [family, wd, ribbi ? '' : w].filter(Boolean).join(' ');
  const legacySub = `${weight === 700 ? 'Bold' : 'Regular'}${italic ? ' Italic' : ''}`.replace('Regular Italic', 'Italic');
  return {
    1: legacyFamily,
    2: legacySub,
    4: `${family} ${typographic}`,
    6: `${family.replace(/[^A-Za-z0-9]/g, '')}-${typographic.replace(/\s/g, '')}`.slice(0, 63),
    16: family,
    17: typographic,
  } as Record<number, string>;
}

const u16 = (b: Buffer, o: number) => b.readUInt16BE(o);
const u32 = (b: Buffer, o: number) => b.readUInt32BE(o);

function checksum(buf: Buffer) {
  const padded = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)]);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

function utf16be(s: string) {
  const le = Buffer.from(s, 'utf16le');
  for (let i = 0; i < le.length; i += 2) {
    const t = le[i];
    le[i] = le[i + 1];
    le[i + 1] = t;
  }
  return le;
}

/** Replace the given name IDs (Windows Unicode and Mac Roman records), keep the rest. */
export function renameFont(font: Buffer, names: Record<number, string>): Buffer {
  const numTables = u16(font, 4);
  const tables: { tag: string; data: Buffer }[] = [];
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = font.toString('latin1', rec, rec + 4);
    const offset = u32(font, rec + 8);
    const length = u32(font, rec + 12);
    tables.push({ tag, data: Buffer.from(font.subarray(offset, offset + length)) });
  }
  const nameTable = tables.find((t) => t.tag === 'name');
  if (!nameTable) return font;

  // Read existing records we keep.
  const n = nameTable.data;
  const count = u16(n, 2);
  const strOffset = u16(n, 4);
  const replace = new Set(Object.keys(names).map(Number));
  const records: { platform: number; encoding: number; language: number; nameId: number; bytes: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const nameId = u16(n, r + 6);
    if (replace.has(nameId) || nameId === 3) continue; // ID 3 (unique ID) is regenerated
    const len = u16(n, r + 8);
    const off = u16(n, r + 10);
    records.push({ platform: u16(n, r), encoding: u16(n, r + 2), language: u16(n, r + 4), nameId, bytes: Buffer.from(n.subarray(strOffset + off, strOffset + off + len)) });
  }
  const all = { ...names, 3: `TypefaceHub:${names[6] ?? names[4]}` };
  for (const [id, value] of Object.entries(all)) {
    records.push({ platform: 3, encoding: 1, language: 0x409, nameId: Number(id), bytes: utf16be(value) });
    if (/^[\x20-\x7e]*$/.test(value)) records.push({ platform: 1, encoding: 0, language: 0, nameId: Number(id), bytes: Buffer.from(value, 'latin1') });
  }
  records.sort((a, b) => a.platform - b.platform || a.encoding - b.encoding || a.language - b.language || a.nameId - b.nameId);

  const header = Buffer.alloc(6 + records.length * 12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(records.length, 2);
  header.writeUInt16BE(header.length, 4);
  const strings: Buffer[] = [];
  let pos = 0;
  records.forEach((r, i) => {
    const o = 6 + i * 12;
    header.writeUInt16BE(r.platform, o);
    header.writeUInt16BE(r.encoding, o + 2);
    header.writeUInt16BE(r.language, o + 4);
    header.writeUInt16BE(r.nameId, o + 6);
    header.writeUInt16BE(r.bytes.length, o + 8);
    header.writeUInt16BE(pos, o + 10);
    strings.push(r.bytes);
    pos += r.bytes.length;
  });
  nameTable.data = Buffer.concat([header, ...strings]);

  // Reassemble the sfnt with a fresh table directory and checksums.
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const head = tables.find((t) => t.tag === 'head');
  if (head) head.data.writeUInt32BE(0, 8); // checkSumAdjustment is computed below
  const dirSize = 12 + tables.length * 16;
  const out: Buffer[] = [];
  const directory = Buffer.alloc(dirSize);
  font.copy(directory, 0, 0, 4); // sfnt version
  directory.writeUInt16BE(tables.length, 4);
  let entry = 1;
  while (entry * 2 <= tables.length) entry *= 2;
  directory.writeUInt16BE(entry * 16, 6);
  directory.writeUInt16BE(Math.log2(entry), 8);
  directory.writeUInt16BE(tables.length * 16 - entry * 16, 10);
  let offset = dirSize;
  tables.forEach((t, i) => {
    const rec = 12 + i * 16;
    directory.write(t.tag, rec, 4, 'latin1');
    directory.writeUInt32BE(checksum(t.data), rec + 4);
    directory.writeUInt32BE(offset, rec + 8);
    directory.writeUInt32BE(t.data.length, rec + 12);
    const padded = Buffer.concat([t.data, Buffer.alloc((4 - (t.data.length % 4)) % 4)]);
    out.push(padded);
    offset += padded.length;
  });
  const result = Buffer.concat([directory, ...out]);
  if (head) {
    const headOffset = dirSize + out.slice(0, tables.indexOf(head)).reduce((a, b) => a + b.length, 0);
    result.writeUInt32BE((0xb1b0afba - checksum(result)) >>> 0, headOffset + 8);
  }
  return result;
}
