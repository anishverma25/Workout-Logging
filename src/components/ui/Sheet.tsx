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
        'sheet m-0 mt-auto hidden max-h-[min(92dvh,52rem)] w-full max-w-none flex-col open:flex overflow-hidden rounded-t-[1.6rem] border border-b-0 border-line-strong bg-surface p-0 text-text shadow-2xl backdrop:bg-black/55 sm:m-auto sm:rounded-[1.4rem] sm:border-b',
        size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
        className,
      )}
    >
      {open ? (
        <>
          <div
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden"
            aria-hidden
          />
          <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-[1.6rem] font-bold leading-tight">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            {children}
          </div>
          {footer ? (
            <footer className="shrink-0 border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-[var(--radius-control)] px-5 font-semibold text-muted hover:bg-surface-2 hover:text-text"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              'h-12 rounded-[var(--radius-control)] px-5 font-semibold transition-[filter] disabled:opacity-50',
              danger ? 'bg-danger text-bg hover:brightness-110' : 'bg-accent text-accent-ink',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-[0.95rem] leading-relaxed text-muted">{body}</div>
    </Sheet>
  );
}
