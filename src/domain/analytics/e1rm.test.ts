import { E1RM_MAX_REPS, estimateOneRepMax } from './e1rm';

describe('estimateOneRepMax (Epley, capped at 10 reps)', () => {
  it('applies load x (1 + reps / 30)', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 3);
    expect(estimateOneRepMax(80, 8)).toBeCloseTo(101.333, 3);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 3);
  });

  it('counts reps in reserve while the total stays at 10 or fewer', () => {
    expect(estimateOneRepMax(80, 8, 2)).toBeCloseTo(estimateOneRepMax(80, 10)!, 9);
    expect(estimateOneRepMax(140, 1, 2)).toBeCloseTo(estimateOneRepMax(140, 3)!, 9);
    expect(estimateOneRepMax(60, 9, 3)).toBeCloseTo(estimateOneRepMax(60, 9)!, 9);
    expect(estimateOneRepMax(80, 8, 0)).toBeCloseTo(estimateOneRepMax(80, 8)!, 9);
  });

  it('returns the load itself for a single rep with nothing left', () => {
    expect(estimateOneRepMax(140, 1)).toBe(140);
    expect(estimateOneRepMax(140, 1, 0)).toBe(140);
  });

  it('is never lower for more reps at the same load', () => {
    for (let r = 1; r < E1RM_MAX_REPS; r++)
      expect(estimateOneRepMax(100, r + 1)!).toBeGreaterThan(estimateOneRepMax(100, r)!);
  });

  it('does not estimate above 10 reps', () => {
    expect(E1RM_MAX_REPS).toBe(10);
    expect(estimateOneRepMax(60, 10)).not.toBeNull();
    expect(estimateOneRepMax(60, 11)).toBeNull();
  });

  it('rejects missing, zero, negative and fractional input', () => {
    expect(estimateOneRepMax(null, 5)).toBeNull();
    expect(estimateOneRepMax(100, null)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(-20, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(100, 2.5)).toBeNull();
  });
});
