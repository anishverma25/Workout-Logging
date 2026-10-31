import { useEffect, useRef, useState } from 'react';
import { viewportBaseline } from '@/components/kit/keyboard';
import { CELL_STEP_EVENT } from './CellInput';

interface Focused {
  el: HTMLInputElement;
  step: number;
}

const coarse = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

const stepText = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * A row above the phone keyboard while a set cell is focused: − and + by the cell's step
 * (2.5 kg, 1 rep) and Next. It sits on the visual viewport, so it follows the keyboard. Buttons
 * never take focus, so the keyboard stays open.
 */
export function KeyboardToolbar() {
  const [focused, setFocused] = useState<Focused | null>(null);
  const [bottom, setBottom] = useState(0);
  // What the visual viewport misses before the keyboard (newer iPhones' browser toolbars).
  const baseline = useRef<number | null>(null);

  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.matches('input[data-cell]') || !coarse()) return;
      const vv = window.visualViewport;
      if (baseline.current === null && vv)
        baseline.current = viewportBaseline(window.innerHeight, vv);
      setFocused({ el: t, step: Number(t.dataset.step) || 1 });
    };
    const onOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (next instanceof HTMLInputElement && next.matches('input[data-cell]')) return;
      baseline.current = null;
      setFocused(null);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!focused || !vv) return;
    const place = () =>
      setBottom(
        Math.max(0, window.innerHeight - (vv.height + vv.offsetTop) - (baseline.current ?? 0)),
      );
    place();
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
    return () => {
      vv.removeEventListener('resize', place);
      vv.removeEventListener('scroll', place);
    };
  }, [focused]);

  if (!focused) return null;
  const nudge = (delta: number) =>
    focused.el.dispatchEvent(new CustomEvent(CELL_STEP_EVENT, { detail: delta }));
  const next = () => {
    const cells = [...document.querySelectorAll<HTMLInputElement>('input[data-cell]')];
    const after = cells[cells.indexOf(focused.el) + 1];
    if (after) after.focus();
    else focused.el.blur();
  };
  const btn =
    'pressable chrome type-headline tabular h-11 flex-1 rounded-field bg-surface-2 text-text-1';
  // pointerdown is cancelled so the input keeps focus and the keyboard stays up.
  const keep = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div
      role="toolbar"
      aria-label="Number keys"
      className="fixed inset-x-0 z-50 flex gap-2 border-t-[0.5px] border-divider bg-bar px-3 py-2"
      style={{ bottom }}
    >
      <button
        type="button"
        className={btn}
        onPointerDown={keep}
        onClick={() => nudge(-focused.step)}
      >
        −{stepText(focused.step)}
      </button>
      <button
        type="button"
        className={btn}
        onPointerDown={keep}
        onClick={() => nudge(focused.step)}
      >
        +{stepText(focused.step)}
      </button>
      <button type="button" className={btn} onPointerDown={keep} onClick={next}>
        Next
      </button>
    </div>
  );
}
