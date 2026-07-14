import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Bottom sheet with a dimmed, blurred backdrop. Mobile-first, slides up. */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-[fade-up_0.2s_ease-out] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 max-h-[88vh] w-full max-w-[520px] animate-slide-up overflow-y-auto rounded-t-3xl border border-god-border bg-god-card pb-[max(1.25rem,var(--safe-bottom))] shadow-card sm:rounded-3xl',
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-god-border/60 bg-god-card/95 px-5 py-4 backdrop-blur">
          <h3 className="font-display text-lg font-bold text-god-cream">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-god-muted transition-colors hover:bg-god-elevated hover:text-god-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
