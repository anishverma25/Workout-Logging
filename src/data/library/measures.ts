import type { Food } from '@/domain/nutrition/calc';
import type { FoodCategory, UnitId } from '@/domain/nutrition/types';

/**
 * The measures a food is eaten in, beyond the katori: a plate of biryani or chaat, a bowl of
 * dal or curd, ml of a drink. Weights are typical Indian servings (a full plate, a cereal-size
 * bowl), and the person can always type grams or any number of plates instead.
 */
export const PLATE_G: Partial<Record<FoodCategory, number>> = {
  rice: 300,
  chicken: 250,
  paneer: 250,
  meat: 250,
  fish: 250,
  egg: 250,
  breakfast: 200,
  snack: 200,
};

/** A full restaurant plate of biryani, pulao or fried rice. */
export const RICE_DISH_PLATE_G = 350;

export const BOWL_G: Partial<Record<FoodCategory, number>> = {
  dal: 250,
  sabzi: 250,
  dairy: 250,
  south: 250,
  fruit: 150,
};

/** The food with its extra measures, after its own first unit so the usual default stays. */
export function withMeasures(food: Food): Food {
  const has = (u: UnitId) => food.units.includes(u);
  const named = (food.pieceName ?? []).map((n) => n.toLowerCase());
  const add: UnitId[] = [];
  let plateG: number | null = null;
  let bowlG: number | null = null;
  // A full plate of biryani, pulao or fried rice is bigger than a plate of curry.
  const plate = /biryani|biriyani|pulao|pulav|fried rice/i.test(food.name)
    ? RICE_DISH_PLATE_G
    : PLATE_G[food.category];
  if (plate && has('katori') && !named.some((n) => n.startsWith('plate'))) {
    add.push('plate');
    plateG = plate;
  }
  const bowl = BOWL_G[food.category];
  if (
    bowl &&
    (has('katori') || (food.category === 'fruit' && has('piece'))) &&
    !named.includes('bowl')
  ) {
    add.push('bowl');
    bowlG = bowl;
  }
  if ((has('glass') || has('cup') || food.category === 'drink') && has('g')) add.push('ml');
  if (!add.length) return food;
  const [first, ...rest] = food.units;
  return { ...food, units: [first!, ...add, ...rest], plateG, bowlG };
}
