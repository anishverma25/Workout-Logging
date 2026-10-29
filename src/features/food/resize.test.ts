import { describe, expect, it } from 'vitest';
import { foodFromItem } from '@/app/foodAi';
import { FOOD_BY_ID } from '@/data/library/foods';
import { measurePortion } from '@/data/repositories/food';
import { defaultPortion } from './foodText';
import { itemCount, resizedPortion, withCount } from './resize';

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

describe('itemCount and withCount', () => {
  const aiRoti = (portion: string, grams = 120, kcal = 360) => ({
    food: foodFromItem({
      name: 'Roti',
      portion,
      grams,
      kcal,
      proteinG: 9,
      carbsG: 66,
      fatG: 3,
      fibreG: 6,
      diet: 'veg',
      basis: 'photo',
      ref: 'From the photo',
    }),
    amount: 1,
    unit: 'serving' as const,
    size: null,
    oilLevel: null,
  });

  it('a photo saw 3 rotis, there were 4: one more roti, numbers and words follow', () => {
    const p = aiRoti('3 rotis');
    expect(itemCount(p)).toEqual({ count: 3, step: 1 });
    const four = withCount(p, 4)!;
    expect(four.food.servingG).toBe(160);
    expect(four.food.ai?.portion).toBe('4 rotis');
    expect(measurePortion(four, null).nutrients.kcal).toBe(480);
    expect(four.food.ai?.basis).toBe('photo');
  });

  it('one to two and back keeps the words right', () => {
    const two = withCount(aiRoti('1 roti', 40, 120), 2)!;
    expect(two.food.ai?.portion).toBe('2 rotis');
    expect(withCount(two, 1)!.food.ai?.portion).toBe('1 roti');
  });

  it('a weight is not a count: the grams box changes it', () => {
    expect(itemCount(aiRoti('150 g rice'))).toBeNull();
    expect(itemCount(aiRoti('150g rice'))).toBeNull();
  });

  it('a portion without a number counts as one serving', () => {
    const two = withCount(aiRoti('a bowl of dal', 200, 240), 2)!;
    expect(two.food.servingG).toBe(400);
    expect(two.food.ai?.portion).toBe('2 × a bowl of dal');
  });

  it('library foods change by pieces, or halves of a katori', () => {
    const roti = [...FOOD_BY_ID.values()].find((f) => f.units.includes('piece') && f.pieceG)!;
    const p = { ...defaultPortion(roti), unit: 'piece' as const, amount: 3 };
    expect(itemCount(p)).toEqual({ count: 3, step: 1 });
    expect(withCount(p, 4)!.amount).toBe(4);
    const dal = [...FOOD_BY_ID.values()].find((f) => f.units.includes('katori'))!;
    const k = {
      ...defaultPortion(dal),
      unit: 'katori' as const,
      amount: 1,
      size: 'medium' as const,
    };
    expect(itemCount(k)).toEqual({ count: 1, step: 0.5 });
  });

  it('never goes to zero or past the limit', () => {
    expect(withCount(aiRoti('3 rotis'), 0)).toBeNull();
    expect(withCount(aiRoti('3 rotis'), 51)).toBeNull();
  });
});
