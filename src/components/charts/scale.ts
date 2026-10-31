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
  /** Whole-number data (reps, workouts): ticks never fall between whole numbers. */
  integer = false,
): { domain: [number, number]; ticks: number[] } {
  let lo = zero ? Math.min(0, min) : min;
  let hi = zero ? Math.max(0, max) : max;
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.05;
    lo -= zero && lo === 0 ? 0 : pad;
    hi += pad;
  }
  let step = niceStep(hi - lo, count);
  if (integer) step = step < 1 ? 1 : Number.isInteger(step) ? step : Math.floor(step);
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

/**
 * Which bars of a column chart get an axis label, so that labels never touch (UI v3, F2): a
 * steady step wide enough for the longest label plus a gap, counted back from the newest bar,
 * which is always labelled.
 */
export function bandLabelIndices(length: number, band: number, labelWidth: number, gap = 8) {
  if (length <= 0) return [];
  const step = band > 0 ? Math.max(1, Math.ceil((labelWidth + gap) / band)) : length;
  const out: number[] = [];
  for (let i = length - 1; i >= 0; i -= step) out.unshift(i);
  return out;
}

const DAY_MS = 86_400_000;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Axis labels for timestamps. A short range shows "5 Oct"; a range over about four months shows
 * "Oct 2025". When the data is not all from this year, the first label and every label where the
 * year changes carry the year, so a date is never read as the wrong year.
 */
export function dateAxisLabels(xs: number[], now = new Date()): string[] {
  if (xs.length === 0) return [];
  const span = xs[xs.length - 1]! - xs[0]!;
  const dates = xs.map((x) => new Date(x));
  if (span > 120 * DAY_MS) {
    return dates.map((d) => `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`);
  }
  const allThisYear = dates.every((d) => d.getFullYear() === now.getFullYear());
  return dates.map((d, i) => {
    const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    const yearChanged = i > 0 && dates[i - 1]!.getFullYear() !== d.getFullYear();
    return !allThisYear && (i === 0 || yearChanged) ? `${base} ${d.getFullYear()}` : base;
  });
}

/**
 * Which x labels to draw so none overlap: walks left to right keeping a label only when it
 * clears the last kept one by `gap` px and reads differently from it. The first and last are
 * preferred; a middle label too close to the last is dropped instead of the last.
 */
export function pickAxisLabels(
  positions: number[],
  texts: string[],
  charWidth = 6.6,
  gap = 14,
): number[] {
  const n = positions.length;
  if (n === 0) return [];
  const width = (i: number) => texts[i]!.length * charWidth;
  // Edges are anchored start/end, middles centred: compute each label's [left, right].
  const box = (i: number): [number, number] =>
    i === 0
      ? [positions[i]!, positions[i]! + width(i)]
      : i === n - 1
        ? [positions[i]! - width(i), positions[i]!]
        : [positions[i]! - width(i) / 2, positions[i]! + width(i) / 2];
  const kept = [0];
  const lastBox = n > 1 ? box(n - 1) : null;
  for (let i = 1; i < n - 1; i++) {
    const prev = kept[kept.length - 1]!;
    const [l, r] = box(i);
    if (l < box(prev)[1] + gap) continue;
    if (texts[i] === texts[prev]) continue;
    if (lastBox && (r + gap > lastBox[0] || texts[i] === texts[n - 1])) continue;
    kept.push(i);
  }
  if (n > 1) {
    const prev = kept[kept.length - 1]!;
    if (texts[n - 1] !== texts[prev] && box(n - 1)[0] >= box(prev)[1] + gap) kept.push(n - 1);
    else if (prev === 0 && texts[n - 1] !== texts[0]) {
      // Two labels that do not fit side by side: keep the latest, it matters most.
      kept[0] = n - 1;
    }
  }
  return kept;
}

/**
 * Splits points into runs with no gap longer than `maxGap` (ms). A line across a long break
 * would draw a trend that never happened.
 */
export function splitAtGaps<T extends { x: number }>(points: T[], maxGap: number): T[][] {
  const runs: T[][] = [];
  for (const p of points) {
    const run = runs[runs.length - 1];
    if (run && p.x - run[run.length - 1]!.x <= maxGap) run.push(p);
    else runs.push([p]);
  }
  return runs;
}
