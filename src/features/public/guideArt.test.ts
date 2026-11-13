import { expect, it } from 'vitest';
import { FOOD_BY_ID } from '@/data/library/foods';
import { portionNutrients, unitGrams } from '@/domain/nutrition/calc';
import { defaultPortion } from '@/features/food/foodText';
import { GUIDES } from '@/app/marketing';
import { GUIDE_ART } from './guideArt';

const kcal = (id: string) => {
  const food = FOOD_BY_ID.get(id)!;
  const p = defaultPortion(food);
  return portionNutrients(food, unitGrams(food, p.unit, p.size)!).kcal;
};

it("gives every guide a picture, and the food guide's sum is the app's own", () => {
  for (const g of GUIDES) expect(GUIDE_ART[g.path], g.path).toBeDefined();
  const total = Math.round(2 * kcal('roti') + kcal('dal-tadka'));
  expect(GUIDE_ART['/indian-food-calorie-counter']!.caption).toBe(
    `2 rotis + 1 katori dal = ${total} kcal`,
  );
});
