import { useEffect, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

const ITEM = 44;
const VISIBLE = 5;

/**
 * A scrolling wheel like the iOS time picker: flick to scroll, it settles on the nearest value.
 * Also a spin button for the keyboard (arrow keys, Page Up and Down, Home and End) and screen
 * readers. Tapping a value scrolls to it.
 */
export function WheelPicker({
  label,
  values,
  value,
  onChange,
  unit,
  valueText,
  format = String,
  className,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
  /** Shown fixed beside the selected row, for example "min". */
  unit?: string;
  valueText?: (value: number) => string;
  /** How each number is drawn on the wheel, for example two-digit seconds. */
  format?: (value: number) => string;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);
  /** Ignore the scroll events caused by our own scrollTo. */
  const programmatic = useRef(false);
  const index = Math.max(0, values.indexOf(value));

  const scrollToIndex = (i: number, smooth: boolean) => {
    const el = list.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTo({ top: i * ITEM, behavior: smooth ? 'smooth' : 'auto' });
    window.setTimeout(() => (programmatic.current = false), smooth ? 350 : 50);
  };

  // Follow the value when it changes from outside (or on first render).
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    if (Math.round(el.scrollTop / ITEM) !== index) scrollToIndex(index, false);
  }, [index]);

  const pick = (i: number) => {
    const clamped = Math.max(0, Math.min(values.length - 1, i));
    if (values[clamped] !== value) {
      navigator.vibrate?.(5);
      onChange(values[clamped]!);
    }
    return clamped;
  };

  const onScroll = () => {
    if (programmatic.current) return;
    if (settle.current) window.clearTimeout(settle.current);
    const el = list.current;
    if (!el) return;
    // Update as it passes each row, like the real wheel, and snap once it stops.
    pick(Math.round(el.scrollTop / ITEM));
    settle.current = window.setTimeout(() => {
      const i = pick(Math.round(el.scrollTop / ITEM));
      if (Math.abs(el.scrollTop - i * ITEM) > 1) scrollToIndex(i, true);
    }, 120);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const jumps: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      PageUp: -3,
      PageDown: 3,
      Home: -values.length,
      End: values.length,
    };
    const delta = jumps[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    scrollToIndex(pick(index + delta), true);
  };

  const text = valueText ?? ((v: number) => (unit ? `${v} ${unit}` : String(v)));

  return (
    <div
      className={cn('relative mx-auto w-full max-w-xs select-none', className)}
      style={{ height: ITEM * VISIBLE }}
    >
      {/* The selection band, behind the numbers. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 rounded-[0.9rem] bg-surface shadow-[var(--shadow-card)]"
        style={{ top: ITEM * 2, height: ITEM }}
      />
      {unit ? (
        <span
          aria-hidden
          className="pointer-events-none absolute flex items-center text-[1.05rem] font-semibold text-muted"
          style={{ top: ITEM * 2, height: ITEM, left: 'calc(50% + 2.4rem)' }}
        >
          {unit}
        </span>
      ) : null}
      <div
        ref={list}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        aria-valuenow={value}
        aria-valuetext={text(value)}
        onScroll={onScroll}
        onKeyDown={onKey}
        className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[0.9rem] outline-none [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-accent-text [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ height: ITEM * 2 }} aria-hidden />
        {values.map((v, i) => {
          const distance = Math.abs(i - index);
          return (
            <div
              key={v}
              aria-hidden
              onClick={() => scrollToIndex(pick(i), true)}
              className={cn(
                'tabular flex snap-center items-center justify-center font-display transition-[color,font-size] duration-150',
                distance === 0
                  ? 'text-[1.6rem] font-semibold text-text'
                  : distance === 1
                    ? 'text-[1.3rem] text-muted'
                    : 'text-[1.15rem] text-faint',
              )}
              style={{ height: ITEM }}
            >
              {format(v)}
            </div>
          );
        })}
        <div style={{ height: ITEM * 2 }} aria-hidden />
      </div>
    </div>
  );
}
