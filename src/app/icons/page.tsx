import type { Metadata } from 'next';
import Link from 'next/link';
import { IconEditor } from '@/components/icon-editor';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Icon font generator',
  description: 'Build your own icon font from Font Awesome, Material Design Icons, Bootstrap Icons, Entypo and more, or from your own SVGs. Get WOFF2, WOFF and TTF files with CSS and a demo page. Opens Fontello config.json files.',
};

const steps = [
  ['Pick or upload icons', 'Search more than 11,000 icons from 16 open-source sets, or drop your own SVGs. Even-odd shapes are fixed automatically.'],
  ['Name them', 'Every icon gets a class name and a code point (from U+E800, in the Private Use Area). Change either one if you need to.'],
  ['Download the font', 'WOFF2, WOFF and TTF, a stylesheet with one class per icon, a demo page and a config.json you can open again to add icons later.'],
];

const faqs: [string, string][] = [
  ['Can I open my Fontello config?', 'Yes. Click “Open config.json or ZIP” and choose the config.json from a Fontello download (or the whole ZIP). Icons from Fontello’s sets and your custom icons are kept, with their names and codes.'],
  ['Icon font or SVG sprites?', 'Icon fonts are one small file, work with plain CSS classes and take the text colour and size. SVGs are better for multi-colour icons. For one-colour UI icons, a font is often the simplest option.'],
  ['Why is my SVG blank or missing parts?', 'Fonts can only hold filled shapes. Lines drawn with a stroke must be converted to outlines first (Figma: Outline stroke; Illustrator: Outline Stroke). Colours, gradients and images are ignored.'],
  ['Are the icons free to use?', 'Every bundled set is open source (SIL OFL, MIT, Apache 2.0, CC BY and others). The kit includes a LICENSE.txt that lists the sets you used; some, such as CC BY, require attribution.'],
  ['Is anything stored?', 'No. Your selection is kept only in this browser, and fonts are built in memory. Sign in to keep icon fonts in a workspace and serve them from a stylesheet link.'],
  ['How do I use it in React or Next.js?', 'Import the stylesheet once (for example in your root layout), then use <i className="icon-home" aria-hidden="true" />. Give buttons that only show an icon an aria-label.'],
];

export default async function IconsPage() {
  const user = await getUser();
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader user={user} active="/icons" />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-medium text-accent">Free · no sign-up · works with Fontello configs</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Icon font generator</h1>
          <p className="mt-3 text-muted">
            Pick icons from open-source sets or upload your own SVGs, name them, and download a web font with a ready-made stylesheet. Only the icons you choose go in the font, so it stays small.
          </p>
        </div>

        <IconEditor mode="public" />

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
          <p className="mt-8 text-sm text-muted">
            More in the <Link className="font-medium text-accent hover:underline" href="/docs/icon-fonts">icon fonts guide</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
