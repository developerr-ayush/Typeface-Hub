import { ImageResponse } from 'next/og';

export const alt = 'Typeface Hub: add a font once, ship only what each page renders';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  const bar = (h: number, o: number) => ({ width: 270, height: h, borderRadius: h / 2.6, background: `rgba(255,255,255,${o})` });
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0f1117', color: '#fff', padding: 80, alignItems: 'center', gap: 72 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={bar(28, 0.38)} />
          <div style={bar(46, 0.68)} />
          <div style={bar(70, 1)} />
          <div style={{ width: 76, height: 92, marginTop: -24, borderRadius: '0 0 24px 24px', background: '#8b8cff' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: '#a5b4fc' }}>Typeface Hub</div>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, marginTop: 16, letterSpacing: -2 }}>Add a font once. Ship only what each page renders.</div>
          <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.65)', marginTop: 28 }}>Conversion, subsetting, variable fonts, a CSS API and typography tokens.</div>
        </div>
      </div>
    ),
    size,
  );
}
