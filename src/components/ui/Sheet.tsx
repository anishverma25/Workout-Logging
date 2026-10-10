import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Short line under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row at the bottom (save, delete...). */
  footer?: ReactNode;
  /** Wider sheet on desktop, for pickers and forms with columns. */
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Bottom sheet on phones, centred dialog on larger screens.
 * Built on the native <dialog> element: focus is trapped inside, Escape closes it,
 * and the rest of the page is inert while it is open.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      if (!open) document.documentElement.style.overflow = '';
    };
  }, [open]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = '';
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        document.documentElement.style.overflow = '';
        if (open) onCloseRef.current();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
      className={cn(
        'kit-sheet m-0 mt-auto hidden max-h-[85dvh] w-full max-w-none flex-col overflow-hidden rounded-t-panel bg-surface p-0 text-text-1 open:flex backdrop:bg-overlay lg:m-auto lg:rounded-panel',
        size === 'md' ? 'lg:max-w-[30rem]' : 'lg:max-w-2xl',
        className,
      )}
    >
      {open ? (
        <>
          <div
            className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-text-1/20 lg:hidden"
            aria-hidden
          />
          <header className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-3 lg:pt-5">
            <div className="min-w-0">
              <h2 id={titleId} className="type-title text-text-1">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="type-meta mt-0.5 text-text-2">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pressable tap-target inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-2 hover:text-text-1"
            >
              <X className="size-4" strokeWidth={2.5} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            {children}
          </div>
          {footer ? (
            <footer className="shrink-0 border-t-[0.5px] border-divider bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : (
            <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
          )}
        </>
      ) : null}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger,
  busy,
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            aria-busy={busy || undefined}
            className={cn(
              'pressable chrome type-headline h-13 w-full rounded-nested px-6',
              danger ? 'bg-surface-2 text-danger' : 'bg-lime text-on-lime',
              busy && 'opacity-60',
            )}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pressable chrome type-headline h-13 w-full rounded-nested bg-surface-2 px-5 text-text-1"
          >
            {cancelLabel}
          </button>
        </div>
      }
    >
      <div className="type-body text-text-2">{body}</div>
    </Sheet>
  );
}
