import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const ACTION_WIDTH = 88;
const LONG_PRESS_MS = 480;
/** Movement that turns a press into a swipe or a scroll. */
const SLOP = 8;

/**
 * A list row with the two iOS gestures: swipe left to reveal Delete (a long swipe deletes
 * straight away), and press and hold for a menu. Right click opens the menu on a computer.
 * Vertical scrolling is left to the browser; a drag only becomes a swipe once it is clearly
 * sideways. Whatever the gestures do must also be reachable from the menu or a tap, for
 * keyboard and screen reader users.
 */
export function SwipeRow({
  children,
  onDelete,
  onLongPress,
  deleteLabel,
  disabled,
}: {
  children: ReactNode;
  onDelete: () => void;
  onLongPress: () => void;
  /** Accessible name of the revealed button, for example "Delete Barbell bench press". */
  deleteLabel: string;
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    base: number;
    mode: 'pending' | 'swipe' | 'scroll';
    timer: number | null;
    pressed: boolean;
  } | null>(null);
  /** Set when a gesture happened, so the click that follows it is swallowed. */
  const swallowClick = useRef(false);
  const open = offset <= -ACTION_WIDTH + 1;

  // Close when tapping anywhere else.
  useEffect(() => {
    if (offset === 0) return;
    const close = (e: Event) => {
      if (!row.current?.contains(e.target as Node)) setOffset(0);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [offset]);

  const clearTimer = () => {
    const g = gesture.current;
    if (g?.timer) window.clearTimeout(g.timer);
    if (g) g.timer = null;
  };

  function down(e: PointerEvent<HTMLDivElement>) {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    swallowClick.current = false;
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      base: offset,
      mode: 'pending',
      pressed: false,
      timer: window.setTimeout(() => {
        const g = gesture.current;
        if (!g || g.mode !== 'pending') return;
        g.pressed = true;
        swallowClick.current = true;
        navigator.vibrate?.(10);
        setOffset(0);
        onLongPress();
      }, LONG_PRESS_MS),
    };
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.pressed) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.mode === 'pending') {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      clearTimer();
      g.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll';
      if (g.mode === 'swipe') {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (g.mode !== 'swipe') return;
    swallowClick.current = true;
    const width = row.current?.offsetWidth ?? 360;
    // Free to the left, a little rubber band past the edge, none to the right.
    setOffset(Math.max(-width, Math.min(0, g.base + dx)));
  }

  function up() {
    const g = gesture.current;
    clearTimer();
    gesture.current = null;
    setDragging(false);
    if (!g || g.mode !== 'swipe') return;
    const width = row.current?.offsetWidth ?? 360;
    if (offset < -width * 0.55) {
      setOffset(-width);
      window.setTimeout(onDelete, 160);
    } else {
      setOffset(offset < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
    }
  }

  return (
    <div
      ref={row}
      className="relative overflow-hidden rounded-xl"
      onContextMenu={(e) => {
        if (disabled) return;
        e.preventDefault();
        clearTimer();
        onLongPress();
      }}
    >
      <button
        type="button"
        aria-label={deleteLabel}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={onDelete}
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end gap-1.5 bg-danger pr-5 font-semibold text-white',
          offset === 0 && 'invisible',
        )}
        style={{ width: Math.max(ACTION_WIDTH, -offset) }}
      >
        <Trash2 className="size-5" aria-hidden />
        <span className="text-sm">Delete</span>
      </button>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          // The click at the end of a swipe or long press is not a tap.
          if (swallowClick.current) {
            e.preventDefault();
            e.stopPropagation();
            swallowClick.current = false;
            return;
          }
          // A tap on an open row closes it instead of opening it.
          if (offset !== 0) {
            e.preventDefault();
            e.stopPropagation();
            setOffset(0);
          }
        }}
        className={cn(
          'relative touch-pan-y select-none bg-surface [-webkit-touch-callout:none]',
          !dragging && 'transition-transform duration-200 ease-out',
        )}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
