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
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
}

type Show = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<Show>(
    (message, action) => {
      const id = ++counter.current;
      setItems((list) => [...list, action ? { id, message, action } : { id, message }]);
      // Longer when there is something to undo, so there is time to reach it.
      window.setTimeout(() => dismiss(id), action ? 5000 : 2800);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(3.0625rem+1rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 lg:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
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
