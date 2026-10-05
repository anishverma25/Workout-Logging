/**
 * Deterministic pseudo-random generator (mulberry32).
 * Used by the demo engine so the same seed and anchor date always produce identical data.
 */
export interface Rng {
  next(): number;
  between(min: number, max: number): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Roughly normal noise in [-spread, spread] (sum of uniforms). */
  noise(spread: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      return items[Math.floor(next() * items.length)] as never;
    },
    noise: (spread) => ((next() + next() + next()) / 3 - 0.5) * 2 * spread,
  };
}
