'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{error.digest ? `Error reference: ${error.digest}` : error.message}</p>
      <button onClick={reset} className="mt-5 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium hover:bg-canvas">
        Try again
      </button>
    </div>
  );
}
