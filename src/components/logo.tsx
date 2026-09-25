export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${className ?? ''}`}>
      <span className="grid size-7 place-items-center rounded-lg bg-ink text-[15px] font-bold text-white" aria-hidden>
        Aa
      </span>
      Typeface Hub
    </span>
  );
}
