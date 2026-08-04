import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss ms. Default: success/info 4000, error 7000. 0 = sticky until dismiss. */
  durationMs?: number;
}

export interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
  durationMs: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

function defaultDuration(tone: ToastTone, override?: number): number {
  if (override !== undefined) return override;
  return DEFAULT_DURATION[tone];
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const tone = input.tone ?? 'info';
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const durationMs = defaultDuration(tone, input.durationMs);
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone,
        durationMs,
      };
      setItems((prev) => {
        const next = [...prev, item];
        if (next.length <= 5) return next;
        const dropped = next.slice(0, next.length - 5);
        for (const d of dropped) {
          const t = timers.current.get(d.id);
          if (t) {
            clearTimeout(t);
            timers.current.delete(d.id);
          }
        }
        return next.slice(-5);
      });
      if (durationMs > 0) {
        const handle = setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error' }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
      dismiss,
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const regionId = useId();
  return (
    <div
      id={regionId}
      className="ck-toast-viewport"
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`ck-toast ck-toast--${item.tone}`}
          role={item.tone === 'error' ? 'alert' : 'status'}
        >
          <div className="ck-toast-body">
            <div className="ck-toast-title">{item.title}</div>
            {item.description && <div className="ck-toast-desc">{item.description}</div>}
          </div>
          <button
            type="button"
            className="ck-toast-dismiss"
            aria-label="Đóng thông báo"
            onClick={() => onDismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
