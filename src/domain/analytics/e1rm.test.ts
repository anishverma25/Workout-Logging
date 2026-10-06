import { E1RM_MAX_REPS, estimateOneRepMax } from './e1rm';

describe('estimateOneRepMax', () => {
  it('uses Brzycki up to 5 reps', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(112.5, 6);
    expect(estimateOneRepMax(100, 3)).toBeCloseTo(105.882, 3);
    expect(estimateOneRepMax(140, 1)).toBe(140);
  });

  it('counts reps in reserve while the total stays at 12 or fewer', () => {
    expect(estimateOneRepMax(80, 8, 2)).toBeCloseTo(estimateOneRepMax(80, 10)!, 9);
    expect(estimateOneRepMax(140, 1, 2)).toBeCloseTo(estimateOneRepMax(140, 3)!, 9);
    expect(estimateOneRepMax(60, 11, 3)).toBeCloseTo(estimateOneRepMax(60, 11)!, 9);
    expect(estimateOneRepMax(80, 8, 0)).toBeCloseTo(estimateOneRepMax(80, 8)!, 9);
  });

  it('is never lower for more reps at the same load', () => {
    for (let r = 1; r < 12; r++)
      expect(estimateOneRepMax(100, r + 1)!).toBeGreaterThan(estimateOneRepMax(100, r)!);
  });

  it('applies weight x (1 + reps / 30)', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 3);
    expect(estimateOneRepMax(80, 8)).toBeCloseTo(101.333, 3);
  });

  it('returns the load itself for a single rep', () => {
    expect(estimateOneRepMax(140, 1)).toBe(140);
  });

  it('does not estimate above the rep cap', () => {
    expect(estimateOneRepMax(60, E1RM_MAX_REPS)).not.toBeNull();
    expect(estimateOneRepMax(60, E1RM_MAX_REPS + 1)).toBeNull();
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
