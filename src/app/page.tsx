import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';
import { getUser } from '@/lib/auth';
import { listUserWorkspaces } from '@/lib/context';

const features = [
  ['One flow for every source', 'Upload TTF, OTF, WOFF, WOFF2 or a ZIP, pick from Google Fonts, or point at a stylesheet. Everything lands in one library.'],
  ['Zero manual conversion', 'Files are validated, converted to WOFF2 + WOFF, split by unicode-range and given content-hashed names automatically.'],
  ['Variable fonts built in', 'Axes and named instances are detected, delivered as one file per style, and can be capped to cut bytes.'],
  ['Google-style CSS API', 'One stylesheet per page with only the families, weights and subsets it renders, plus metric-matched fallbacks.'],
  ['Typography tokens', 'Font roles and text styles with responsive sizes, exported as CSS variables, JSON and an SDUI contract.'],
  ['Safe changes', 'Drafts, review, one-click publish and rollback, licence records, roles and a full audit trail.'],
];

export default async function Home() {
  const user = await getUser();
  if (user) {
    const workspaces = await listUserWorkspaces(user.id);
    redirect(workspaces[0] ? `/w/${workspaces[0].slug}` : '/workspaces/new');
  }
  return (
    <div className="min-h-screen bg-surface">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-ink-2 hover:bg-black/5">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg bg-ink px-3.5 py-2 font-medium text-white hover:bg-black">
            Get started
          </Link>
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
          <p className="mb-4 text-sm font-medium text-accent">Font management &amp; delivery platform</p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-6xl">
            Add a font once. Ship only what each page renders.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Upload or pick a font. Typeface Hub validates, converts, subsets and catalogues it, then serves exactly the faces each page uses through a Google-style CSS API.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-strong">
              Create a workspace
            </Link>
            <Link href="/login" className="rounded-lg border border-line-strong px-5 py-3 text-sm font-semibold text-ink hover:bg-canvas">
              Sign in
            </Link>
          </div>
          <div className="mt-14 overflow-hidden rounded-2xl border border-line bg-[#0f1117] shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="size-2.5 rounded-full bg-white/20" />
            </div>
            <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-[#d6d9e0]">
              <code>{`<link rel="preload" href="/fonts/files/montserrat-vf-latin.a8f3c1d2e4.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fonts/acme/css?family=Montserrat:wght@400;700&family=Bakbak+One&display=swap">

:root {
  --font-heading: 'Bakbak One', 'Bakbak One Fallback', system-ui, sans-serif;
  --font-body: 'Montserrat', 'Montserrat Fallback', system-ui, sans-serif;
}`}</code>
            </pre>
          </div>
        </section>
        <section className="border-t border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-px px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, body]) => (
              <div key={title} className="p-5">
                <h2 className="font-semibold text-ink">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
