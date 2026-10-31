import { describe, expect, it } from 'vitest';
import { fillMacros } from './fillMacros';

const kcalOf = (p: number, m: { carbsG: number; fatG: number }) =>
  p * 4 + m.carbsG * 4 + m.fatG * 9;

describe('fillMacros', () => {
  it('needs both calories and protein', () => {
    expect(fillMacros(null, 10)).toBeNull();
    expect(fillMacros(300, null)).toBeNull();
  });

  it('shares the energy left after protein 60:40 without a reference', () => {
    const m = fillMacros(400, 20)!;
    // 320 kcal left: 192 from carbs (48 g), 128 from fat (14.2 g).
    expect(m).toEqual({ carbsG: 48, fatG: 14.2 });
    expect(kcalOf(20, m)).toBeCloseTo(400, 0);
  });

  it('follows the reference food when there is one', () => {
    // Reference: carbs 30 g (120 kcal), fat 10 g (90 kcal): 4/7 of the energy from carbs.
    const m = fillMacros(500, 25, { carbsG: 30, fatG: 10 })!;
    expect(m.carbsG).toBeCloseTo((400 * (120 / 210)) / 4, 1);
    expect(Math.abs(kcalOf(25, m) - 500)).toBeLessThan(1);
  });

  it('falls back to the default split when the reference has no carbs or fat', () => {
    expect(fillMacros(400, 20, { carbsG: 0, fatG: 0 })).toEqual(fillMacros(400, 20));
  });

  it('gives no carbs or fat when protein already covers the calories', () => {
    expect(fillMacros(100, 30)).toEqual({ carbsG: 0, fatG: 0 });
  });
});
