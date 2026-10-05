import { E1RM_MAX_REPS, estimateOneRepMax } from './e1rm';

describe('estimateOneRepMax (Epley)', () => {
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
