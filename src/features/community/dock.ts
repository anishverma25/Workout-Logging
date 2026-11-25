import { useEffect } from 'react';

/**
 * A bar docked at the bottom of a screen without the tab bar: toasts and the workout dock read
 * `--tabbar-h`, so they float above it. Set after the shell's own effect, and on every resize.
 */
export function useDockHeight(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--tabbar-h', `${el.offsetHeight}px`);
    const frame = requestAnimationFrame(set);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set);
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      root.style.setProperty('--tabbar-h', '0px');
    };
  }, [ref]);
}
