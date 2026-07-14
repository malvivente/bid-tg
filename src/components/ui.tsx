import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/telegram';

/* ---------------- Button ---------------- */

type Variant = 'gold' | 'outline' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  variant = 'gold',
  fullWidth,
  loading,
  leftIcon,
  className,
  children,
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const base =
    variant === 'gold' ? 'btn-gold' : variant === 'outline' ? 'btn-outline' : 'btn-ghost';
  return (
    <button
      className={cn(base, fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      onClick={(e) => {
        haptic.impact('light');
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
    </button>
  );
}

/* ---------------- Segmented control ---------------- */

interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  sub?: ReactNode;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-1 rounded-2xl border border-god-border bg-god-surface p-1',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => {
              haptic.select();
              onChange(o.value);
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-gold-gradient text-god-bg shadow-goldSoft'
                : 'text-god-muted hover:text-god-cream',
            )}
          >
            <span>{o.label}</span>
            {o.sub && (
              <span className={cn('text-[11px]', active ? 'text-god-bg/70' : 'text-god-faint')}>
                {o.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Stepper ---------------- */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const set = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v));
    haptic.select();
    onChange(clamped);
  };
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => set(value - step)}
        disabled={value <= min}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-god-border text-god-gold transition-colors hover:bg-god-elevated disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="min-w-[92px] flex-1 text-center font-display text-2xl font-bold text-god-cream">
        {value.toLocaleString('en-US')}
      </div>
      <button
        onClick={() => set(value + step)}
        disabled={value >= max}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-god-border text-god-gold transition-colors hover:bg-god-elevated disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------------- Misc ---------------- */

export function InfoRow({
  label,
  children,
  strong,
}: {
  label: ReactNode;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-god-muted">{label}</span>
      <span
        className={cn(
          'text-sm',
          strong ? 'font-semibold text-god-cream' : 'text-god-cream/90',
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="mb-1 text-god-gold/50">{icon}</div>}
      <p className="font-display text-base font-semibold text-god-cream/80">{title}</p>
      {hint && <p className="max-w-[240px] text-xs text-god-faint">{hint}</p>}
    </div>
  );
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'urgent' | 'success' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'urgent' && 'bg-god-danger/15 text-god-danger',
        tone === 'success' && 'bg-god-success/15 text-god-success',
        tone === 'default' && 'bg-god-elevated text-god-muted',
      )}
    >
      {children}
    </span>
  );
}
