import type { WeekFacts } from './facts';

/**
 * Test support: generated people with a known true body, so the tests can check the brain finds
 * the truth and never steps outside its limits. Not used by the app.
 */

/** A small seeded random source, so every run of the tests sees the same people. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return {
    next,
    normal,
    between: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
  };
}

const DAY = 86_400_000;
export const mondayKey = (index: number) =>
  new Date(Date.UTC(2026, 0, 5) + index * 7 * DAY).toISOString().slice(0, 10);

export function emptyWeek(index: number): WeekFacts {
  return {
    weekStart: mondayKey(index),
    sessions: 0,
    foodDays: 0,
    meanKcal: null,
    meanProteinG: null,
    weighIns: 0,
    meanWeightKg: null,
    muscles: {},
    lifts: {},
    medianRir: null,
  };
}

/** A week fully logged: food, weigh-ins and training. */
export function week(index: number, over: Partial<WeekFacts> = {}): WeekFacts {
  return {
    ...emptyWeek(index),
    sessions: 4,
    foodDays: 7,
    meanKcal: 2200,
    meanProteinG: 130,
    weighIns: 6,
    meanWeightKg: 70,
    medianRir: 2,
    ...over,
  };
}
