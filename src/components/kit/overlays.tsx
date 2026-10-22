import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DestructiveButton, IconButton, PrimaryButton, SecondaryButton } from './actions';
import { keyboardInset } from './keyboard';

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
  /** Kept for older callers: every sheet is now a centred dialog. */
  presentation?: 'sheet' | 'dialog';
  /** Wider on desktop (672 instead of 480), for forms with columns. */
  wide?: boolean;
  /**
   * A fixed, tall panel (most of the screen) that does not change size as its content does:
   * for search and logging, so results have room and the panel never jumps while typing.
   */
  tall?: boolean;
  className?: string;
}

/**
 * Keeps the page behind an open sheet still. Fixing the body in place is the one way that also
 * stops touch scrolling on iPhone; the scroll position is put back when the last sheet closes.
 */
let locks = 0;
let lockedAt = 0;
function lockPageScroll() {
  locks += 1;
  if (locks > 1) return;
  lockedAt = window.scrollY;
  const body = document.body.style;
  body.position = 'fixed';
  body.top = `-${lockedAt}px`;
  body.left = '0';
  body.right = '0';
  body.width = '100%';
  document.documentElement.style.overscrollBehavior = 'none';
}
function unlockPageScroll() {
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;
  const body = document.body.style;
  body.position = '';
  body.top = '';
  body.left = '';
  body.right = '';
  body.width = '';
  document.documentElement.style.overscrollBehavior = '';
  window.scrollTo(0, lockedAt);
}

/** Follows the keyboard while a sheet is open, so the sheet can sit above it. */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => setInset(keyboardInset(window.innerHeight, vv));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);
  return inset;
}

/**
 * A centred panel on every screen size (max 480, or 672 when `wide`), fading and scaling in.
 * It never slides up from the bottom: iPhones placed bottom-anchored dialogs partly below the
 * screen. Built on <dialog>: focus is trapped, Escape and a tap outside close it, and focus
 * returns to the control that opened it. With the keyboard up it moves above it.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  hideHeader,
  children,
  footer,
  wide,
  tall,
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
  const keyboard = useKeyboardInset(open);

  useEffect(() => {
    if (!open) return;
    lockPageScroll();
    return unlockPageScroll;
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      // The browser focuses the first control; a sheet can name a better one.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const restoreFocus = () => {
    const el = opener.current;
    opener.current = null;
    if (el instanceof HTMLElement && el.isConnected) el.focus({ preventScroll: true });
  };

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
      style={
        // Above the keyboard on iPhone, and never taller than the space left.
        keyboard
          ? {
              marginBottom: keyboard + 8,
              maxHeight: `calc(100% - ${keyboard}px - 1.5rem)`,
              ...(tall ? { height: `calc(100% - ${keyboard}px - 1.5rem)` } : {}),
            }
          : undefined
      }
      className={cn(
        'kit-sheet hidden flex-col overflow-hidden rounded-panel bg-surface p-0 text-text-1 open:flex backdrop:bg-overlay',
        // 80vh first for browsers without dvh (Chrome before 108, older Samsung Internet).
        'm-auto max-h-[80vh] w-[calc(100vw-1.5rem)] supports-[height:1dvh]:max-h-[80dvh]',
        wide ? 'max-w-2xl' : 'max-w-[30rem]',
        tall &&
          'h-[88vh] max-h-[88vh] supports-[height:1dvh]:h-[88dvh] supports-[height:1dvh]:max-h-[88dvh]',
        className,
      )}
    >
      {open ? (
        <>
          <div className="chrome shrink-0">
            {hideHeader ? (
              // The visible title is part of the content; this names the dialog.
              <h2 id={titleId} className="sr-only">
                {title}
              </h2>
            ) : (
              <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
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
              footer ? 'pb-4' : 'pb-5',
            )}
          >
            {children}
          </div>
          {footer ? (
            <footer className="shrink-0 border-t-[0.5px] border-divider bg-surface px-5 pt-3 pb-4">
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
