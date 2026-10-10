import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * One line of text that shrinks to fit its box, down to `minScale` of its size (85% by
 * default), instead of being cut with an ellipsis. Past that it wraps rather than hiding letters.
 */
export function FitText({
  children,
  className,
  minScale = 0.85,
}: {
  children: ReactNode;
  className?: string;
  minScale?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      el.style.whiteSpace = 'nowrap';
      const base = parseFloat(getComputedStyle(el).fontSize);
      const ratio = el.clientWidth > 0 ? el.clientWidth / el.scrollWidth : 1;
      if (ratio >= 1) return;
      if (ratio >= minScale) {
        el.style.fontSize = `${Math.floor(base * ratio * 10) / 10}px`;
      } else {
        el.style.fontSize = `${base * minScale}px`;
        el.style.whiteSpace = 'normal';
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, minScale]);

  return (
    <span
      ref={ref}
      className={cn(
        'block w-full overflow-hidden text-center leading-tight break-words',
        className,
      )}
    >
      {children}
    </span>
  );
}
