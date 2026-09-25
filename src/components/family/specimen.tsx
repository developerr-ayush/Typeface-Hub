'use client';

import { Badge, Card, CardHeader } from '../ui';
import { fontStack, weightLabel, type FamilyViewData, type VersionData } from './shared';

const WEIGHT_NAMES: Record<number, string> = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const NUMERALS = '0123456789';
const PUNCT = '! ? . , : ; … – — ( ) [ ] { } / \\ @ # $ % & * + = < > " \' ‘ ’ “ ” « » € £ ₹ ¥ ©';
const PARAGRAPH =
  'Typography is the craft of endowing human language with a durable visual form. A well-set page invites reading: the rhythm of lines, the colour of the text block and the space around letters all matter. Game day at the ground — 42,618 fans, 3 wickets in the final over, and a 7-run win.';

const SCRIPT_SAMPLES: Record<string, string> = {
  latin: 'Hamburgefonstiv',
  'latin-ext': 'Ąćęłńóśźż Čeština Şağlık',
  vietnamese: 'Tiếng Việt có dấu',
  cyrillic: 'Съешь же ещё этих мягких',
  'cyrillic-ext': 'Українська Ґґ Єє',
  greek: 'Ελληνικά γράμματα',
  'greek-ext': 'ἀρχὴ ἥμισυ παντός',
  devanagari: 'हिन्दी देवनागरी',
  arabic: 'العربية',
  hebrew: 'עברית',
  thai: 'ภาษาไทย',
};

export function SpecimenPanel({ family, version }: { family: FamilyViewData['family']; version: VersionData }) {
  const stack = fontStack(version.alias, family.fallbackStack);
  const scripts = [...new Set(version.faces.flatMap((f) => f.scripts))];
  const rows = version.faces.flatMap((face) => {
    if (face.axes.length && face.namedInstances.length) {
      return face.namedInstances
        .filter((n) => n.coords.wght !== undefined)
        .map((n) => ({ key: `${face.id}-${n.name}`, label: n.name, weight: n.coords.wght, style: face.style }));
    }
    if (face.axes.length) {
      return [100, 200, 300, 400, 500, 600, 700, 800, 900]
        .filter((w) => w >= face.weightMin && w <= face.weightMax)
        .map((w) => ({ key: `${face.id}-${w}`, label: WEIGHT_NAMES[w], weight: w, style: face.style }));
    }
    return [{ key: face.id, label: face.name, weight: face.weightMin, style: face.style }];
  });

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="specimen-grid px-6 py-8" style={{ fontFamily: stack }}>
          <div className="text-[clamp(3rem,10vw,8rem)] leading-none tracking-tight text-ink">Aa Gg Rr</div>
          <div className="mt-6 space-y-1 text-2xl break-all text-ink-2">
            <div>{UPPER}</div>
            <div>{LOWER}</div>
            <div>{NUMERALS}</div>
            <div className="text-xl">{PUNCT}</div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Weights & styles" description={`${version.faces.length} face${version.faces.length === 1 ? '' : 's'} in v${version.number}`} />
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex items-baseline gap-4 px-5 py-3">
              <span className="w-28 shrink-0 text-xs text-muted">
                {r.label}
                <span className="block tabular-nums">
                  {Math.round(r.weight)}
                  {r.style === 'italic' ? ' italic' : ''}
                </span>
              </span>
              <p className="truncate text-[28px] text-ink" style={{ fontFamily: stack, fontWeight: r.weight, fontStyle: r.style }}>
                Sphinx of black quartz, judge my vow
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Paragraph</h2>
          <p className="text-[17px] leading-[1.65] text-ink" style={{ fontFamily: stack }}>
            {PARAGRAPH}
          </p>
          <p className="mt-4 text-[13px] leading-[1.5] text-ink-2" style={{ fontFamily: stack }}>
            {PARAGRAPH}
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Supported scripts</h2>
          {scripts.length === 0 ? (
            <p className="text-sm text-muted">Provided by the external stylesheet.</p>
          ) : (
            <ul className="space-y-3">
              {scripts.map((s) => (
                <li key={s}>
                  <Badge>{s}</Badge>
                  {SCRIPT_SAMPLES[s] && (
                    <div className="mt-1 text-lg text-ink" style={{ fontFamily: stack }}>
                      {SCRIPT_SAMPLES[s]}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <h2 className="mt-6 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Faces</h2>
          <ul className="space-y-1 text-sm text-ink-2">
            {version.faces.map((f) => (
              <li key={f.id} className="flex justify-between gap-2">
                <span>{f.name}</span>
                <span className="text-muted tabular-nums">
                  {weightLabel(f)} {f.style}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
