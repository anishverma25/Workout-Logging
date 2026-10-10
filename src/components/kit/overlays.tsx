import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DestructiveButton, IconButton, PrimaryButton, SecondaryButton } from './actions';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Title (Title style) in the sticky header. Always given, for the accessible name. */
  title: ReactNode;
  /** Meta --text-2 line under the title. */
  subtitle?: ReactNode;
  /** No visible header or close button; the content shows its own title. Escape and the
   * backdrop still close it. */
  hideHeader?: boolean;
  children: ReactNode;
  /** Pinned footer: buttons 52 high, above the safe area. */
  footer?: ReactNode;
  /** Always a centred dialog, never a bottom sheet. */
  presentation?: 'sheet' | 'dialog';
  className?: string;
}

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.6; // px per ms

/**
 * Bottom sheet on phones, centred dialog (max 480, radius 24) from 1024px. Built on <dialog>:
 * focus is trapped, Escape and a backdrop tap close it, and focus returns to the control that
 * opened it. Drag the handle or header down to dismiss.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  hideHeader,
  children,
  footer,
  presentation = 'sheet',
  className,
}: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const subtitleId = useId();
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<{ y: number; t: number } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = '';
    },
    [],
  );

  const restoreFocus = () => {
    document.documentElement.style.overflow = '';
    const el = opener.current;
    opener.current = null;
    if (el instanceof HTMLElement && el.isConnected) el.focus({ preventScroll: true });
  };

  const onPointerDown = (e: PointerEvent) => {
    if (presentation === 'dialog' || window.matchMedia('(min-width: 1024px)').matches) return;
    dragStart.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragStart.current) return;
    setDrag(Math.max(0, e.clientY - dragStart.current.y));
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const distance = e.clientY - start.y;
    const velocity = distance / Math.max(1, performance.now() - start.t);
    setDrag(0);
    if (distance > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) onCloseRef.current();
  };

  const dialogLike = presentation === 'dialog';
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onClose={() => {
        restoreFocus();
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
      style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      className={cn(
        'kit-sheet hidden w-full max-w-none flex-col overflow-hidden bg-surface p-0 text-text-1 open:flex backdrop:bg-overlay',
        'transition-transform duration-[var(--dur-move)] ease-[var(--ease-standard)]',
        dialogLike
          ? 'kit-dialog m-auto max-h-[85dvh] max-w-[min(30rem,calc(100vw-2rem))] rounded-panel'
          : 'm-0 mt-auto max-h-[85dvh] rounded-t-panel lg:m-auto lg:max-w-[30rem] lg:rounded-panel',
        className,
      )}
    >
      {open ? (
        <>
          <div
            className="chrome shrink-0 touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {!dialogLike ? (
              <div
                aria-hidden
                className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-text-1/20 lg:hidden"
              />
            ) : null}
            {hideHeader ? (
              // The visible title is part of the content; this names the dialog.
              <h2 id={titleId} className="sr-only">
                {title}
              </h2>
            ) : (
              <header
                className={cn(
                  'flex items-start justify-between gap-3 px-5 pt-3 pb-3',
                  dialogLike ? 'pt-5' : 'lg:pt-5',
                )}
              >
                <div className="min-w-0">
                  <h2 id={titleId} className="type-title text-text-1">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p id={subtitleId} className="type-meta mt-0.5 text-text-2">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <IconButton
                  label="Close"
                  size={32}
                  icon={<X strokeWidth={2.25} />}
                  onClick={() => onCloseRef.current()}
                  className="text-text-2"
                />
              </header>
            )}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5',
              footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
            )}
          >
            {children}
          </div>
          {footer ? (
            <footer className="shrink-0 border-t-[0.5px] border-divider bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}

/** A centred dialog: the desktop presentation of a sheet, available on every width. */
export function Dialog(props: Omit<BottomSheetProps, 'presentation'>) {
  return <BottomSheet {...props} presentation="dialog" />;
}

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  /** The neutral action below the primary one. */
  cancelLabel?: string;
  /** Destructive confirm: DestructiveButton instead of PrimaryButton. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Headline title, Body --text-2 body, the confirm on top and the neutral action below. */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  busy,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const Confirm = destructive ? DestructiveButton : PrimaryButton;
  return (
    <BottomSheet open={open} onClose={onClose} title={title} hideHeader>
      <div className="pt-4">
        <p className="type-headline text-text-1" aria-hidden>
          {title}
        </p>
        {body ? <div className="type-body mt-2 text-text-2">{body}</div> : null}
        <div className="mt-6 flex flex-col gap-2">
          <Confirm block loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Confirm>
          <SecondaryButton block onClick={onClose}>
            {cancelLabel}
          </SecondaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
