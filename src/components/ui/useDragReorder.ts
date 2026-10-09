import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

/** Movement that counts as a drag rather than a press. */
const MOVE_SLOP = 8;

interface Drag {
  id: string;
  from: number;
  to: number;
  startY: number;
  dy: number;
  moved: boolean;
  /** Top and height of each item when the drag started, in order. */
  rects: { id: string; top: number; height: number }[];
}

/**
 * Press, hold and drag to reorder a vertical list, as in iOS. Call `start` from a long press
 * (or straight from a drag handle). While dragging, the page does not scroll, the item follows
 * the finger and the others make room. On release, `onMove(id, toIndex)` runs if it moved;
 * otherwise `onPress(id)` (for example to open a menu).
 */
export function useDragReorder({
  ids,
  onMove,
  onPress,
}: {
  ids: string[];
  onMove: (id: string, toIndex: number) => void;
  onPress?: (id: string) => void;
}) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const handlers = useRef({ onMove, onPress });
  useEffect(() => {
    handlers.current = { onMove, onPress };
  });

  const update = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const start = useCallback(
    (id: string, clientY: number) => {
      const from = ids.indexOf(id);
      if (from < 0) return;
      const rects = ids.map((i) => {
        const r = nodes.current.get(i)?.getBoundingClientRect();
        return { id: i, top: r?.top ?? 0, height: r?.height ?? 0 };
      });
      navigator.vibrate?.(10);
      update({ id, from, to: from, startY: clientY, dy: 0, moved: false, rects });
    },
    [ids],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (y: number) => {
      const d = dragRef.current;
      if (!d) return;
      const dy = y - d.startY;
      const moved = d.moved || Math.abs(dy) > MOVE_SLOP;
      // Where the dragged item's centre now sits among the others' centres.
      const self = d.rects[d.from]!;
      const centre = self.top + self.height / 2 + dy;
      let to = 0;
      d.rects.forEach((r, i) => {
        if (i !== d.from && centre > r.top + r.height / 2) to++;
      });
      update({ ...d, dy, moved, to });
    };
    const onPointerMove = (e: PointerEvent) => move(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      // Keep the page still while an item is lifted.
      e.preventDefault();
      const t = e.touches[0];
      if (t) move(t.clientY);
    };
    const end = () => {
      const d = dragRef.current;
      update(null);
      if (!d) return;
      if (d.moved) {
        if (d.to !== d.from) handlers.current.onMove(d.id, d.to);
      } else handlers.current.onPress?.(d.id);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('touchend', end);
    };
    // Listeners only need adding once per drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  /** Props for each item: a ref to measure it and the style that moves it. */
  const itemProps = (id: string) => {
    const style: CSSProperties = {};
    const d = drag;
    if (d) {
      const i = ids.indexOf(id);
      if (id === d.id) {
        Object.assign(style, {
          transform: `translateY(${d.dy}px) scale(1.02)`,
          zIndex: 20,
          position: 'relative',
          boxShadow: 'var(--shadow-float)',
          transition: 'box-shadow 150ms, scale 150ms',
          borderRadius: '0.9rem',
        });
      } else {
        const h = d.rects[d.from]?.height ?? 0;
        let shift = 0;
        if (d.from < d.to && i > d.from && i <= d.to) shift = -h;
        if (d.from > d.to && i < d.from && i >= d.to) shift = h;
        Object.assign(style, {
          transform: `translateY(${shift}px)`,
          transition: 'transform 180ms ease',
        });
      }
    }
    return {
      ref: (el: HTMLElement | null) => {
        if (el) nodes.current.set(id, el);
        else nodes.current.delete(id);
      },
      style,
      'data-dragging': drag?.id === id ? 'true' : undefined,
    };
  };

  return { start, itemProps, dragging: drag?.id ?? null };
}
