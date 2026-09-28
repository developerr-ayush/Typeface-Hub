/** Shown inside the workspace shell while a page loads. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-md bg-black/[0.06]" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-black/[0.05]" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 rounded-xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
