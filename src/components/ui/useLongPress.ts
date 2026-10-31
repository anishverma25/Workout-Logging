import { useRef, type PointerEvent } from 'react';

const HOLD_MS = 480;
const SLOP = 8;

/**
 * Press and hold for `HOLD_MS` without moving. Returns pointer handlers to spread on an element.
 * A tap or a scroll does nothing; the click after a successful hold is swallowed.
 */
export function useLongPress(onHold: (clientY: number) => void) {
  const state = useRef<{ x: number; y: number; timer: number } | null>(null);
  const held = useRef(false);
  const cancel = () => {
    if (state.current) window.clearTimeout(state.current.timer);
    state.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      held.current = false;
      const { clientX: x, clientY: y } = e;
      state.current = {
        x,
        y,
        timer: window.setTimeout(() => {
          held.current = true;
          state.current = null;
          onHold(y);
        }, HOLD_MS),
      };
    },
    onPointerMove: (e: PointerEvent) => {
      const s = state.current;
      if (s && (Math.abs(e.clientX - s.x) > SLOP || Math.abs(e.clientY - s.y) > SLOP)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (held.current) {
        e.preventDefault();
        e.stopPropagation();
        held.current = false;
      }
    },
  };
}
