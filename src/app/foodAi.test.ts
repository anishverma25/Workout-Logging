import { describe, expect, it } from 'vitest';
import { portionNutrients, unitGrams } from '@/domain/nutrition/calc';
import { editedPortion } from './foodAi';

describe('a label portion counted in servings (D1)', () => {
  it('logs the calories the preview showed, as servings', () => {
    const item = editedPortion('Protein bar', 'veg', {
      grams: null,
      servings: 2,
      kcal: 480,
      proteinG: 48,
      carbsG: 40,
      fatG: 14,
      fibreG: 4,
    });
    expect(item.unit).toBe('serving');
    expect(item.amount).toBe(2);
    const n = portionNutrients(item.food, item.amount * unitGrams(item.food, item.unit, null)!);
    expect(Math.round(n.kcal)).toBe(480);
    expect(Math.round(n.proteinG)).toBe(48);
  });

  it('keeps a big serving (a mass gainer) exact, past the 900 kcal per 100 g limit', () => {
    const item = editedPortion('Mass gainer', 'veg', {
      grams: null,
      servings: 1,
      kcal: 1250,
      proteinG: 50,
      carbsG: 250,
      fatG: 5,
      fibreG: 0,
    });
    const n = portionNutrients(item.food, item.amount * unitGrams(item.food, item.unit, null)!);
    expect(Math.round(n.kcal)).toBe(1250);
    expect(Math.round(n.carbsG)).toBe(250);
  });
});
