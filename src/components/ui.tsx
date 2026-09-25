'use client';

import Link from 'next/link';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* Button ------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm disabled:bg-accent/50',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-canvas shadow-sm disabled:text-muted',
  ghost: 'text-ink-2 hover:bg-black/5 disabled:text-muted',
  danger: 'bg-bad text-white hover:bg-red-800 shadow-sm disabled:bg-bad/50',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-9 px-4 text-sm gap-2' };

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    extra,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
        {loading && <Spinner className="size-3.5" />}
        {children}
      </button>
    );
  },
);

export function ButtonLink({ href, variant = 'secondary', size = 'md', className, children }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'size-4')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* Form fields ------------------------------------------------------- */

const fieldBase =
  'rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted/70 shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:bg-canvas disabled:text-muted';

// Full width unless the caller sets a width.
const widthOf = (className?: string) => /(^|\s)(\w+:)?(w-|min-w-\[)/.test(className ?? '') ? '' : 'w-full';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, 'h-9', widthOf(className), className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(fieldBase, 'py-2 leading-relaxed', widthOf(className), className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(fieldBase, widthOf(className), 'h-9 pr-8 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%23676d7c%22%3E%3Cpath%20d%3D%22M5.3%207.3a1%201%200%200%201%201.4%200L10%2010.6l3.3-3.3a1%201%200%201%201%201.4%201.4l-4%204a1%201%200%200%201-1.4%200l-4-4a1%201%200%200%201%200-1.4z%22/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_8px_center] bg-no-repeat', className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, description, checked, onChange, disabled }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-[var(--color-accent)]"
      />
      <label htmlFor={id} className="text-sm leading-snug text-ink-2">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
    </div>
  );
}

/* Display ----------------------------------------------------------- */

type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad';
const tones: Record<Tone, string> = {
  neutral: 'bg-black/[0.05] text-ink-2',
  accent: 'bg-accent-soft text-accent-strong',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'warn', title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx('rounded-lg px-3.5 py-3 text-sm', tones[tone])} role={tone === 'bad' ? 'alert' : undefined}>
      {title && <div className="font-medium">{title}</div>}
      {children && <div className={cx(title ? 'mt-0.5' : '', 'opacity-90')}>{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tracking-tight text-ink tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

/* Tabs -------------------------------------------------------------- */

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto border-b border-line scrollbar-thin', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
            value === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded bg-black/5 px-1.5 text-[11px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* Modal ------------------------------------------------------------- */

export function Modal({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx('m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-[2px]', wide ? 'max-w-2xl' : 'max-w-md')}
    >
      {open && (
        <div>
          <div className="px-5 pt-5">
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {children && <div className="px-5 pt-4">{children}</div>}
          <div className="mt-5 flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3 rounded-b-2xl">{footer ?? <Button onClick={onClose}>Close</Button>}</div>
        </div>
      )}
    </dialog>
  );
}

/* Toasts ------------------------------------------------------------ */

type Toast = { id: number; tone: Tone; message: ReactNode };
const ToastCtx = createContext<(message: ReactNode, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: ReactNode, tone: Tone = 'good') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg', t.tone === 'bad' && 'border-bad/30')}>
            <div className="flex items-start gap-2">
              <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', t.tone === 'bad' ? 'bg-bad' : t.tone === 'warn' ? 'bg-warn' : 'bg-good')} aria-hidden />
              <div className="text-ink">{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* Copy -------------------------------------------------------------- */

export function CopyButton({ text, label = 'Copy', size = 'sm' }: { text: string; label?: string; size?: Size }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? 'Copied' : label}
    </Button>
  );
}

export function CodeBlock({ code, label, copy = true, className }: { code: string; label?: string; copy?: boolean; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-lg border border-line bg-[#0f1117]', className)}>
      {(label || copy) && (
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
          <span className="text-xs text-white/60">{label}</span>
          {copy && <CopyButtonDark text={code} />}
        </div>
      )}
      <pre className="max-h-[420px] overflow-auto p-3 text-[12.5px] leading-relaxed text-[#e6e8ee] scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CopyButtonDark({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded px-2 py-0.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export { formatBytes, timeAgo } from '@/lib/format';
