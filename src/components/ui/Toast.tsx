import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';

export interface ToastAction {
  label: string;
  onSelect: () => void;
  /** How long this one stays; quick undos (a glass of water) use `QUICK_UNDO_MS`. */
  ms?: number;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
}

type Show = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<Show>(() => {});

/** How long a toast stays: an undo stays 10 s (X4), and waits while it is focused or hovered. */
export const TOAST_MS = 2800;
export const ACTION_TOAST_MS = 10_000;
/** A small, easy to redo action (a glass of water): long enough to reach Undo, then gone. */
export const QUICK_UNDO_MS = 4_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (id: number, ms: number) => {
      const old = timers.current.get(id);
      if (old !== undefined) window.clearTimeout(old);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), ms),
      );
    },
    [dismiss],
  );
  const hold = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) window.clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const show = useCallback<Show>(
    (message, action) => {
      const id = ++counter.current;
      // The same message again (a second glass of water) replaces the first, so they never
      // stack up; its Undo still covers the first one's change, which is already saved.
      setItems((list) => {
        for (const old of list) if (old.message === message) hold(old.id);
        return [
          ...list.filter((t) => t.message !== message),
          action ? { id, message, action } : { id, message },
        ];
      });
      // Longer when there is something to undo, so there is time to reach it.
      schedule(id, action ? (action.ms ?? ACTION_TOAST_MS) : TOAST_MS);
    },
    [schedule, hold],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--tabbar-h)+1rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 lg:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            // A mouse resting on it holds it; a finger passing over a phone screen does not
            // (touch never sends the leave that would let it go again).
            onPointerEnter={t.action ? (e) => e.pointerType === 'mouse' && hold(t.id) : undefined}
            onPointerLeave={
              t.action
                ? (e) =>
                    e.pointerType === 'mouse' && schedule(t.id, t.action!.ms ?? ACTION_TOAST_MS)
                : undefined
            }
            onFocus={t.action ? () => hold(t.id) : undefined}
            onBlur={t.action ? () => schedule(t.id, t.action!.ms ?? ACTION_TOAST_MS) : undefined}
            className="type-body flex min-h-12 max-w-[min(30rem,calc(100vw-2rem))] items-center gap-3 rounded-nested bg-surface-2 py-2 pr-2 pl-4 text-text-1"
          >
            <Check className="size-5 shrink-0 text-text-2" aria-hidden />
            <span className="py-1">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action!.onSelect();
                  dismiss(t.id);
                }}
                className="pressable type-headline pointer-events-auto h-9 shrink-0 rounded-field px-3 text-text-1 hover:bg-surface"
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
