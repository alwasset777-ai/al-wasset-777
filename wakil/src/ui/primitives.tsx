import { X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'secondary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg hover:brightness-105 active:brightness-95',
        variant === 'secondary' && 'bg-surface border border-line hover:bg-surface-2',
        variant === 'ghost' && 'hover:bg-surface-2 text-ink',
        variant === 'danger' && 'bg-danger-soft text-danger hover:brightness-95',
        className,
      )}
    />
  );
}

export function IconButton({ className, label, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...p}
      className={cx('inline-flex items-center justify-center size-9 rounded-xl text-muted hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-40', className)}
    />
  );
}

export const inputCls = 'w-full rounded-xl bg-surface border border-line px-3 h-10 text-[15px] placeholder:text-muted/70 focus:border-accent outline-none transition-colors';

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, className)} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, 'h-auto py-2.5 leading-relaxed resize-y', className)} />;
}
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, 'pr-8', className)} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted leading-relaxed">{hint}</span>}
    </label>
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'accent' | 'mint' | 'danger' | 'ok'; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-muted',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'mint' && 'bg-mint-soft text-mint',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'ok' && 'bg-mint-soft text-ok',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-mint' : 'bg-surface-3')}
    >
      <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('card shadow-soft w-full max-h-[92vh] flex flex-col rounded-b-none sm:rounded-[var(--radius)] safe-bottom', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <h2 className="font-semibold text-[15px]">{title}</h2>
          <IconButton label="Fermer" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-line">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 gap-3">
      <div className="size-12 rounded-2xl bg-surface-2 text-muted flex items-center justify-center">{icon}</div>
      <div className="font-semibold">{title}</div>
      {text && <p className="text-sm text-muted max-w-sm leading-relaxed">{text}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="spin text-accent" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Logo Wakil : étoile à huit branches + point central. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0F1420" />
      <g transform="translate(32 32)">
        <rect x="-15" y="-15" width="30" height="30" rx="3" fill="#E8AE4A" />
        <rect x="-15" y="-15" width="30" height="30" rx="3" fill="#E8AE4A" transform="rotate(45)" />
        <circle r="7.5" fill="#0F1420" />
        <circle r="3.2" fill="#55C7B9" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------ toasts
type Toast = { id: number; text: string; tone: 'ok' | 'danger' | 'neutral' };
let toastSeq = 0;
const toastListeners = new Set<(t: Toast) => void>();
export function toast(text: string, tone: Toast['tone'] = 'neutral') {
  const t = { id: ++toastSeq, text, tone };
  toastListeners.forEach((l) => l(t));
}
export function onToast(fn: (t: Toast) => void) {
  toastListeners.add(fn);
  return () => {
    toastListeners.delete(fn);
  };
}
export type { Toast };
