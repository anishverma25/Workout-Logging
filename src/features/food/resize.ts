import { measurePortion, type FoodPortion } from '@/data/repositories/food';

/** The largest serving the amount box takes, as `measurePortion` allows. */
export const MAX_SERVING_G = 5000;

/**
 * The same food at a new weight, everything else scaling with it. An OverloadGPT food is "1
 * serving" of that many grams, so the serving itself changes and keeps its source; a library
 * food keeps its unit and the number of katoris, rotis or pieces changes instead.
 */
export function resizedPortion(
  p: FoodPortion,
  grams: number,
  katoriMl: number | null,
): FoodPortion | null {
  if (!(grams > 0) || grams > MAX_SERVING_G) return null;
  const g = Math.round(grams);
  if (p.food.ai && p.unit === 'serving')
    return {
      ...p,
      amount: 1,
      food: { ...p.food, servingG: g, ai: { ...p.food.ai, portion: `${g} g` } },
    };
  let now: number;
  try {
    now = measurePortion(p, katoriMl).grams;
  } catch {
    return null;
  }
  if (!(now > 0)) return null;
  if (p.food.units.includes('g')) return { ...p, unit: 'g', amount: g, size: null };
  return { ...p, amount: Math.round(((p.amount * g) / now) * 100) / 100 };
}
