import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Shown only while the item is off, to say why: short rows keep the menu on screen. */
  hint?: string;
}

interface ActionMenuProps {
  open: boolean;
  onClose: () => void;
  /** The button that opened it: the menu drops from its corner. */
  anchor: RefObject<HTMLElement | null>;
  /** What the menu is for, read by screen readers. */
  label: string;
  items: MenuItem[];
}

const GAP = 6;
const EDGE = 12;
const WIDTH = 288;

/**
 * The options behind a three-dot button: a small menu that drops from the button and fades in.
 * Not a sheet and not a <dialog>: nothing slides up from the bottom, the page is not locked, so
 * it opens the same way on every phone. Tap outside, scroll the page or press Escape to close; arrow keys
 * move between items and focus goes back to the button.
 */
export function ActionMenu(props: ActionMenuProps) {
  // Mounted only while open, so each opening measures afresh.
  return props.open ? <MenuPanel {...props} /> : null;
}

function MenuPanel({ onClose, anchor, label, items }: ActionMenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  const id = useId();

  // Place it at the button before the first paint: below it, or above when there is more room.
  useLayoutEffect(() => {
    const el = anchor.current;
    const box = panel.current;
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    // Stop above the tab bar, which sits over the bottom of the page on phones.
    const bar = document.querySelector<HTMLElement>('[data-bottom-bar]');
    const barRect = bar?.getBoundingClientRect();
    const barTop = barRect && barRect.height > 0 ? barRect.top : vh;
    const floor = Math.min(vh, barTop);
    const vw = window.innerWidth;
    const below = floor - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    // Below the button when it all fits there, above when it fits there instead, otherwise on
    // the roomier side with the list scrolling.
    const need = box.scrollHeight;
    const down = need <= below || (need > above && below >= above);
    box.style.top = down ? `${r.bottom + GAP}px` : '';
    box.style.bottom = down ? '' : `${vh - r.top + GAP}px`;
    box.style.right = `${Math.max(EDGE, vw - r.right)}px`;
    box.style.maxHeight = `${Math.max(160, down ? below : above)}px`;
    box.style.transformOrigin = down ? 'top right' : 'bottom right';
    box.style.visibility = 'visible';
    box.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [anchor]);

  // Close on a tap outside, a scroll of the page or a resize; give focus back to the button.
  useEffect(() => {
    const button = anchor.current;
    const box = panel.current;
    const close = () => onCloseRef.current();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box?.contains(t) || button?.contains(t)) return;
      close();
    };
    // Only a real scroll closes it: the end of a fling or a 1px nudge must not shut a menu that
    // just opened, so it waits until the button itself has moved.
    const startTop = button?.getBoundingClientRect().top ?? 0;
    const onScroll = (e: Event) => {
      if (box && e.target instanceof Node && box.contains(e.target)) return;
      const top = button?.getBoundingClientRect().top ?? startTop;
      if (Math.abs(top - startTop) > 24) close();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      if (button?.isConnected && box?.contains(document.activeElement))
        button.focus({ preventScroll: true });
    };
  }, [anchor]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [
      ...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();
    if (e.key === 'Escape') {
      e.preventDefault();
      onCloseRef.current();
      anchor.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      go(at - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(buttons.length - 1);
    } else if (e.key === 'Tab') {
      onCloseRef.current();
    }
  };

  return createPortal(
    <div
      ref={panel}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="kit-menu fixed z-50 overflow-y-auto overscroll-contain rounded-panel border border-border-strong bg-surface-2 p-1.5"
      style={{ visibility: 'hidden', width: `min(${WIDTH}px, calc(100vw - ${EDGE * 2}px))` }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => item.onSelect()}
          className={cn(
            'chrome flex min-h-12 w-full items-center gap-3 rounded-field px-3 py-2 text-left transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none active:bg-surface disabled:opacity-40 disabled:hover:bg-transparent',
            item.danger ? 'text-danger-text' : 'text-text-1',
          )}
        >
          <span
            className={cn(
              'inline-flex shrink-0 [&>svg]:size-5',
              item.danger ? 'text-danger-text' : 'text-text-2',
            )}
          >
            {item.icon}
          </span>
          <span className="min-w-0">
            <span className="type-body block font-medium">{item.label}</span>
            {item.hint && item.disabled ? (
              <span className="type-caption block text-text-2">{item.hint}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
