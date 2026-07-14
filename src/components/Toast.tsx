import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/telegram';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => {});

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    if (kind === 'success') haptic.success();
    else if (kind === 'error') haptic.error();
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,var(--safe-top))] z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-[420px] animate-fade-up items-center gap-3 rounded-2xl border bg-god-card/95 px-4 py-3 text-sm shadow-card backdrop-blur',
              t.kind === 'success' && 'border-god-success/30',
              t.kind === 'error' && 'border-god-danger/30',
              t.kind === 'info' && 'border-god-border',
            )}
          >
            {t.kind === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-god-success" />}
            {t.kind === 'error' && <XCircle className="h-5 w-5 shrink-0 text-god-danger" />}
            {t.kind === 'info' && <Info className="h-5 w-5 shrink-0 text-god-gold" />}
            <span className="text-god-cream/90">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
