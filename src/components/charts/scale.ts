/** Small, dependency-free helpers for chart axes. */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
  ticks: number[];
}

/** A "nice" step (1, 2, 2.5 or 5 times a power of ten) covering the span in about `count` steps. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0)) return 1;
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Domain rounded outward to clean ticks. `zero` forces the domain to include 0 (bars must;
 * lines of e1RM or body weight should not, or every change looks flat).
 */
export function niceDomain(
  min: number,
  max: number,
  count = 4,
  zero = false,
): { domain: [number, number]; ticks: number[] } {
  let lo = zero ? Math.min(0, min) : min;
  let hi = zero ? Math.max(0, max) : max;
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.05;
    lo -= zero && lo === 0 ? 0 : pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { domain: [start, end], ticks };
}

export function linearScale(
  domain: [number, number],
  range: [number, number],
  ticks: number[] = [],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = ((v: number) => r0 + (v - d0) * k) as LinearScale;
  f.domain = domain;
  f.ticks = ticks;
  return f;
}

/** Index of the item whose x is closest to `px`. Items must be sorted by x. */
export function nearestIndex(xs: number[], px: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! < px) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[lo]! - px) <= Math.abs(xs[hi]! - px) ? lo : hi;
}

/** Up to `count` evenly spaced indices, always including the first and last. */
export function spacedIndices(length: number, count: number): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const out = new Set<number>();
  for (let i = 0; i < count; i++) out.add(Math.round((i * (length - 1)) / (count - 1)));
  return [...out];
}
