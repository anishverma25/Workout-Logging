import { describe, expect, it } from 'vitest';
import { foodFromItem } from '@/app/foodAi';
import { FOOD_BY_ID } from '@/data/library/foods';
import { measurePortion } from '@/data/repositories/food';
import { defaultPortion } from './foodText';
import { resizedPortion } from './resize';

describe('resizedPortion', () => {
  it('changes an AI serving and keeps where its numbers came from', () => {
    const food = foodFromItem({
      name: 'Paneer bhurji',
      portion: '1 plate',
      grams: 150,
      kcal: 240,
      proteinG: 12,
      carbsG: 30,
      fatG: 8,
      fibreG: 2,
      diet: 'veg',
      basis: 'photo',
      ref: 'From the photo',
    });
    const p = { food, amount: 1, unit: 'serving' as const, size: null, oilLevel: null };
    const next = resizedPortion(p, 200, null)!;
    expect(next.food.servingG).toBe(200);
    expect(next.food.ai?.basis).toBe('photo');
    expect(next.food.ai?.portion).toBe('200 g');
    expect(measurePortion(next, null).nutrients.kcal).toBe(320);
  });

  it('weighs a library food in grams when it can be', () => {
    const roti = [...FOOD_BY_ID.values()].find((f) => f.units.includes('g'))!;
    const next = resizedPortion(defaultPortion(roti), 90, null)!;
    expect(measurePortion(next, null).grams).toBe(90);
  });

  it('refuses an empty or huge amount', () => {
    const roti = [...FOOD_BY_ID.values()][0]!;
    expect(resizedPortion(defaultPortion(roti), 0, null)).toBeNull();
    expect(resizedPortion(defaultPortion(roti), 6000, null)).toBeNull();
  });
});
