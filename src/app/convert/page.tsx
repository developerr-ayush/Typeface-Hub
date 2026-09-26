import type { Metadata } from 'next';
import Link from 'next/link';
import { Converter } from '@/components/converter';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { getUser } from '@/lib/auth';
import { CONVERT_LIMITS } from '@/lib/convert';
import { usingBlob } from '@/lib/storage';

export const metadata: Metadata = {
  title: 'Free web font converter',
  description: 'Convert TTF, OTF, WOFF and WOFF2 fonts into a ready-to-use web font kit: WOFF2, WOFF and TTF files, CSS and a demo page. Free, no sign-up, files are not kept.',
};

const steps = [
  ['Drop your fonts', 'TTF, OTF, WOFF, WOFF2, or a ZIP of them. Weights and styles are detected automatically, and variable fonts are supported.'],
  ['Pick formats and characters', 'WOFF2 and WOFF for the web, TTF/OTF for apps. Keep only the characters you need to make files smaller.'],
  ['Copy the kit into your project', 'The ZIP has a fonts folder, a ready-made stylesheet and a demo page. Add one <link> tag and you are done.'],
];

const faqs: [string, string][] = [
  ['Are my fonts stored?', 'No. Files are processed in memory, and uploads are deleted as soon as your kit is built. Nothing is added to any library.'],
  ['Which formats do I need?', 'WOFF2 covers every modern browser. Add WOFF for very old browsers and TTF/OTF for desktop apps, email or native apps. EOT and SVG fonts are no longer needed.'],
  ['What does "Latin + Latin Extended" mean?', 'The kit keeps only the letters used by Western and Central European languages, which usually makes files much smaller. Choose "Full font" to keep every character, or "Split by script" to get one file per script with unicode-range.'],
  ['Can I convert variable fonts?', 'Yes. Keep them as one variable file, or export separate static weights such as 400 and 700 for tools that do not support variable fonts. Each static file gets its own correct name.'],
  ['What is the fallback face?', 'A local system font (such as Arial) resized to match your font, so text does not jump when the web font finishes loading.'],
  ['Is it legal to convert a font?', 'That depends on its licence. Open-source fonts (SIL OFL, Apache) allow it. For commercial fonts, check that your licence covers web embedding.'],
];

export default async function ConvertPage() {
  const user = await getUser();
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader user={user} active="/convert" />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-medium text-accent">Free · no sign-up · files not kept</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Web font converter</h1>
          <p className="mt-3 text-muted">
            Turn TTF, OTF, WOFF or WOFF2 files into a ready-to-use web font kit: WOFF2, WOFF and TTF files, a stylesheet with <code>@font-face</code> rules, a demo page and instructions.
          </p>
        </div>

        <Converter mode={usingBlob() ? 'blob' : 'direct'} limits={CONVERT_LIMITS} />

        <section className="mt-16">
          <h2 className="text-xl font-semibold text-ink">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {steps.map(([title, body], i) => (
              <li key={title} className="rounded-xl border border-line bg-surface p-5">
                <div className="mb-3 grid size-7 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">{i + 1}</div>
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 overflow-hidden rounded-xl border border-line bg-[#0f1117]">
            <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-[#e6e8ee]">
              <code>{`<!-- 1. Copy fonts/ and css/ from the ZIP into your site -->
<link rel="stylesheet" href="/css/montserrat.css">

/* 2. Use it */
body { font-family: 'Montserrat', 'Montserrat Fallback', system-ui, sans-serif; }`}</code>
            </pre>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold text-ink">Questions</h2>
          <dl className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {faqs.map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold text-ink">{q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-ink">Managing fonts for a team or many sites?</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Typeface Hub keeps one font library for every site and app: versioning, review and one-click rollback, typography tokens, and a CSS API that serves only the weights and characters each page uses.
          </p>
          <Link href={user ? '/' : '/signup'} className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong">
            {user ? 'Open your library' : 'Create a free workspace'}
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
