import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ToastView } from './feedback';

export interface KitToastOptions {
  /** An undo or similar; the toast stays 5 s instead of 3 s. */
  action?: { label: string; onSelect: () => void };
  /** Icon in --text-2; a check by default, null for none. */
  icon?: ReactNode | null;
}

interface ToastItem extends KitToastOptions {
  id: number;
  message: string;
}

type Show = (message: string, options?: KitToastOptions) => void;

const KitToastContext = createContext<Show>(() => {});

/**
 * Toasts in the kit style: above the tab bar on phones, bottom centre on desktop, read out
 * politely, gone after 3 s (5 s with an action). Screens move to it in UI Part 7.
 */
export function KitToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<Show>(
    (message, options = {}) => {
      const id = ++counter.current;
      setItems((list) => [...list, { id, message, ...options }]);
      window.setTimeout(() => dismiss(id), options.action ? 5000 : 3000);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <KitToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(3.0625rem+1rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 lg:bottom-6"
      >
        {items.map((t) => (
          <ToastView
            key={t.id}
            message={t.message}
            icon={t.icon}
            action={
              t.action
                ? {
                    label: t.action.label,
                    onSelect: () => {
                      t.action!.onSelect();
                      dismiss(t.id);
                    },
                  }
                : undefined
            }
          />
        ))}
      </div>
    </KitToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKitToast(): Show {
  return useContext(KitToastContext);
}
