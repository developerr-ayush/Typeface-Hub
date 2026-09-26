/**
 * Typeface Hub mark: three bars of increasing weight (a font's weights)
 * that together form a T, with the stem in the accent colour.
 */
export function LogoMark({ size = 28, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="32" height="32" rx="8" fill="#14161c" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" strokeOpacity="0.08" />
      <rect x="7" y="6.5" width="18" height="1.8" rx="0.9" fill="#fff" fillOpacity="0.38" />
      <rect x="7" y="10.3" width="18" height="3" rx="1.2" fill="#fff" fillOpacity="0.68" />
      <rect x="7" y="15.3" width="18" height="4.6" rx="1.6" fill="#fff" />
      <path d="M13.5 19.9h5v5.6a1.6 1.6 0 0 1-1.6 1.6h-1.8a1.6 1.6 0 0 1-1.6-1.6z" fill="#8b8cff" />
    </svg>
  );
}

export function Logo({ className, size = 28, inverted }: { className?: string; size?: number; inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em] ${inverted ? 'text-white' : 'text-ink'} ${className ?? ''}`}>
      <LogoMark size={size} />
      <span>
        Typeface<span className={inverted ? 'text-indigo-300' : 'text-accent'}> Hub</span>
      </span>
    </span>
  );
}
