import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { getUser } from '@/lib/auth';
import { listUserWorkspaces } from '@/lib/context';

const features: [string, string, string][] = [
  ['Every source, one library', 'Upload TTF, OTF, WOFF, WOFF2 or a ZIP, pick from 1,900 Google Fonts, or import a stylesheet or an old Transfonter export. Everything lands in one searchable library.', 'M4 7h16M4 12h16M4 17h10'],
  ['Zero manual conversion', 'Files are validated, converted to WOFF2 and WOFF, split by script with unicode-range, and given content-hashed names. A report shows the bytes saved.', 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4'],
  ['Variable fonts, properly', 'Axes and named instances are detected. Cap or pin any axis (weight, width, optical size, slant) to cut file size, or export static weights with correct names.', 'M4 18c4 0 4-12 8-12s4 12 8 12'],
  ['A Google-style CSS API', 'One stylesheet per page, with only the families, weights and scripts it renders, plus metric-matched fallback fonts that stop layout shift.', 'm8 8-4 4 4 4M16 8l4 4-4 4'],
  ['Typography tokens', 'Heading, body and custom roles with responsive or fluid text styles, exported as CSS variables, JSON and an SDUI contract for your render API.', 'M4 7V5h16v2M9 19h6M12 5v14'],
  ['Safe changes', 'Drafts, a review screen, one-click publish and rollback, licence records, four roles and a full audit log for every change.', 'M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z'],
];

const steps: [string, string][] = [
  ['Add', 'Drop files, search Google Fonts or paste a stylesheet. Families are grouped automatically.'],
  ['Review', 'Check the detected faces, sizes and warnings, fix anything mislabelled, confirm the licence.'],
  ['Publish', 'One click makes it live everywhere. Roll back just as fast.'],
  ['Deliver', 'Pages load one CSS URL and download only the faces and scripts they render.'],
];

export default async function Home() {
  const user = await getUser();
  if (user) {
    const workspaces = await listUserWorkspaces(user.id);
    redirect(workspaces[0] ? `/w/${workspaces[0].slug}` : '/workspaces/new');
  }
  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,#eef0ff,transparent)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Font management &amp; delivery platform
              </p>
              <h1 className="text-5xl leading-[1.03] font-semibold tracking-[-0.03em] text-ink sm:text-6xl">
                Add a font once.
                <br />
                <span className="text-accent">Ship only what each page renders.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Typeface Hub validates, converts, subsets and catalogues every font, then serves exactly the faces each page uses through one CSS link. No Transfonter, no 35-file font folders.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-strong">
                  Create a free workspace
                </Link>
                <Link href="/convert" className="rounded-lg border border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-canvas">
                  Try the free converter
                </Link>
                <Link href="/docs" className="rounded-lg px-4 py-3 text-sm font-semibold text-ink-2 hover:text-ink">
                  Read the docs →
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-line bg-[#0f1117] shadow-2xl shadow-indigo-900/10">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="ml-3 text-xs text-white/40">index.html</span>
              </div>
              <pre className="overflow-x-auto p-5 text-[12.5px] leading-relaxed text-[#d6d9e0]">
                <code>
                  <span className="text-white/40">{'<!-- one stylesheet, only the faces this page uses -->\n'}</span>
                  {'<link rel="stylesheet"\n  href="/fonts/acme/css?family='}
                  <span className="text-indigo-300">Montserrat:wght@400;700</span>
                  {'\n  &family='}
                  <span className="text-indigo-300">Bakbak+One</span>
                  {'&display=swap">\n\n'}
                  <span className="text-white/40">{'/* tokens: rebrand in one place */\n'}</span>
                  {':root {\n  --font-heading: '}
                  <span className="text-emerald-300">{"'Bakbak One'"}</span>
                  {', system-ui;\n  --font-body: '}
                  <span className="text-emerald-300">{"'Montserrat'"}</span>
                  {', system-ui;\n}'}
                </code>
              </pre>
              <div className="grid grid-cols-3 border-t border-white/10 text-center text-white">
                {[
                  ['WOFF2', 'generated for you'],
                  ['1', 'CSS request per page'],
                  ['0', 'manual conversion steps'],
                ].map(([v, l]) => (
                  <div key={l} className="border-r border-white/10 px-3 py-4 last:border-0">
                    <div className="text-xl font-semibold">{v}</div>
                    <div className="text-xs text-white/50">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-ink">Everything between a font file and a fast page</h2>
            <p className="mt-3 max-w-2xl text-muted">One service for every site, app and editor, so each team stops repeating the same font work.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(([title, body, icon]) => (
                <div key={title} className="rounded-2xl border border-line bg-surface p-6">
                  <div className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={icon} />
                    </svg>
                  </div>
                  <h3 className="mt-4 font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-ink">How it works</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-4">
              {steps.map(([title, body], i) => (
                <li key={title} className="relative">
                  <div className="text-sm font-semibold text-accent">0{i + 1}</div>
                  <h3 className="mt-2 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-20 sm:px-6 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-8">
              <h2 className="text-xl font-semibold text-ink">Free tools, no account</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The free converter turns any font into a web font kit: WOFF2, WOFF and TTF files, a ready-made stylesheet and a demo page with the CSS for every combination. No account, and files aren&apos;t kept.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/convert" className="inline-flex rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas">
                  Open the converter
                </Link>
                <Link href="/icons" className="inline-flex rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas">
                  Make an icon font
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted">The icon font generator builds a font from 11,000+ open-source icons or your own SVGs, and opens Fontello configs.</p>
            </div>
            <div className="rounded-2xl border border-ink bg-ink p-8 text-white">
              <h2 className="text-xl font-semibold">Running many sites?</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Workspaces keep each client&apos;s fonts, tokens and API keys separate. Publish once and every property using a family updates, with rollback if anything looks wrong.
              </p>
              <Link href="/signup" className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-white/90">
                Create a workspace
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
