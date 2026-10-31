/**
 * Gym-floor arithmetic: which plates go on each side of the bar, and warm-up sets that lead
 * up to the working weight. Pure functions over whatever unit the person uses.
 */

export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5] as const;
export const BARS_KG = [20, 15, 10] as const;
export const BARS_LB = [45, 35, 25] as const;

export interface PlateLoad {
  /** Plates for one side, heaviest first. */
  perSide: number[];
  /** What the bar actually weighs with those plates. */
  achieved: number;
  /** Target minus achieved: what the available plates cannot make up. */
  remainder: number;
}

/** Greedy, heaviest plate first: the way people load a bar, and exact for standard sets. */
export function platesFor(total: number, bar: number, plates: readonly number[]): PlateLoad | null {
  if (!(total >= bar)) return null;
  let side = (total - bar) / 2;
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side -= p;
    }
  }
  const achieved = bar + perSide.reduce((a, b) => a + b, 0) * 2;
  return { perSide, achieved, remainder: Math.round((total - achieved) * 1000) / 1000 };
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

/**
 * Warm-ups before a working weight: the empty bar for 10 (barbell lifts), then about 40% for 5,
 * 60% for 3 and 80% for 1, each rounded down to the nearest step and never repeating a weight.
 * Light working weights get fewer warm-ups, since there is little to warm up to.
 */
export function warmupSets(
  working: number,
  options: { bar: number | null; step: number },
): WarmupSet[] {
  const { bar, step } = options;
  if (!(working > 0)) return [];
  const round = (v: number) => Math.floor(v / step) * step;
  const out: WarmupSet[] = [];
  if (bar !== null && working > bar * 1.5) out.push({ weight: bar, reps: 10 });
  for (const [share, reps] of [
    [0.4, 5],
    [0.6, 3],
    [0.8, 1],
  ] as const) {
    const w = round(working * share);
    const last = out[out.length - 1]?.weight ?? 0;
    if (w > last && w < working && (bar === null || w > bar)) out.push({ weight: w, reps });
  }
  return out;
}
