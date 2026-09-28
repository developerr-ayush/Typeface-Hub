'use client';

import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-bad">Error</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Please try again. If it keeps happening, let us know{error.digest ? ` and mention the reference ${error.digest}` : ''}.
      </p>
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong">
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
          Go home
        </Link>
      </div>
    </div>
  );
}
