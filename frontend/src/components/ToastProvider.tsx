import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastTone, { container: string; icon: typeof CheckCircle2 }> = {
  success: { container: 'border-emerald-200 bg-white text-emerald-800', icon: CheckCircle2 },
  error: { container: 'border-red-200 bg-white text-red-800', icon: AlertCircle },
  info: { container: 'border-brand-200 bg-white text-brand-800', icon: Info }
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    if (!message.trim()) return;
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    timers.current.set(id, window.setTimeout(() => dismissToast(id), tone === 'error' ? 7000 : 4500));
  }, [dismissToast]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite">
        {toasts.map((toast) => {
          const style = toastStyles[toast.tone];
          const Icon = style.icon;
          return (
            <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${style.container}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.message}</p>
              <button type="button" onClick={() => dismissToast(toast.id)} className="rounded p-0.5 opacity-70 hover:bg-slate-100 hover:opacity-100" aria-label="Dismiss notification" title="Dismiss notification">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider.');
  return context;
}
