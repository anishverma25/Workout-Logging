import {
  OIL_FACTOR,
  ZERO,
  type DietType,
  type FoodCategory,
  type Ingredient,
  type Meal,
  type Nutrients,
  type OilLevel,
  type Region,
  type SizeId,
  type UnitId,
} from './types';

/**
 * How every food's numbers are made (science topic `food-values`):
 *
 * 1. A standard home recipe in grams of raw ingredients.
 * 2. Ingredient values per 100 g from USDA SR28.
 * 3. The cooked weight of the whole pot, either stated by the recipe or, for breads and batters,
 *    from the moisture of the cooked food: cooked = dry matter / (1 − moisture).
 * 4. Per 100 g cooked = Σ(m × n / 100) / cooked weight × 100.
 * 5. Per portion = per 100 g × portion grams / 100; portion grams = volume × fill × density.
 * 6. The cooking fat is kept apart, so light, normal and rich change only the fat
 *    (half, standard, double).
 */

export interface RecipeLine {
  id: string;
  grams: number;
}

/** A food the app can log, with everything resolved to per 100 g. */
export interface Food {
  id: string;
  name: string;
  aliases: string[];
  category: FoodCategory;
  region: Region;
  /** Meals it is usually eaten at, for suggestions. */
  meals: Meal[];
  diet: Exclude<DietType, 'jain'>;
  jain: boolean;
  /** Per 100 g as cooked with the standard amount of fat. */
  per100: Nutrients;
  /** What the adjustable fat adds per 100 g of the dish, or null when there is none. */
  fatPer100: Nutrients | null;
  /** Units offered, the first is the default. */
  units: UnitId[];
  defaultAmount: number;
  /** g per ml, for volume units. */
  density: number;
  pieceG: number | null;
  /** What one piece is called: ['roti', 'rotis']. */
  pieceName: [string, string] | null;
  servingG: number | null;
  /** Where the numbers come from, shown under the name. */
  source: 'recipe' | 'ingredient' | 'custom' | 'custom_recipe';
  /** The recipe as it was calculated, for the detail view. */
  recipe: { lines: { name: string; grams: number }[]; cookedG: number; makes: string } | null;
}

/** Kitchen volumes in ml (common steel katori, ladle, glass and tea cup sizes). */
export const KATORI_ML: Record<SizeId, number> = { small: 150, medium: 200, large: 250 };
export const CUP_ML: Record<Exclude<SizeId, 'large'>, number> = { small: 100, medium: 150 };
export const LADLE_ML = 60;
export const GLASS_ML = 200;
export const TBSP_ML = 15;
export const TSP_ML = 5;
/** A katori, glass or cup is rarely filled to the brim. */
export const FILL: Partial<Record<UnitId, number>> = { katori: 0.8, glass: 0.9, cup: 0.9 };

const round1 = (v: number) => Math.round(v * 10) / 10;

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
    fibreG: a.fibreG + b.fibreG,
  };
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return {
    kcal: n.kcal * factor,
    proteinG: n.proteinG * factor,
    carbsG: n.carbsG * factor,
    fatG: n.fatG * factor,
    fibreG: n.fibreG * factor,
  };
}

export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    proteinG: round1(n.proteinG),
    carbsG: round1(n.carbsG),
    fatG: round1(n.fatG),
    fibreG: round1(n.fibreG),
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(addNutrients, ZERO);
}

/** Nutrients in `grams` of an ingredient. */
export const ingredientNutrients = (ing: Ingredient, grams: number): Nutrients =>
  scaleNutrients(ing, grams / 100);

/** Dry matter in grams: what is left when the water is taken out. */
export const dryMatter = (ing: Ingredient, grams: number) => (grams * (100 - ing.water)) / 100;

/** Cooked weight of breads, batters and anything else cooked to a known moisture. */
export function cookedFromMoisture(
  lines: RecipeLine[],
  lookup: (id: string) => Ingredient,
  moisture: number,
): number {
  const dry = lines.reduce((s, l) => s + dryMatter(lookup(l.id), l.grams), 0);
  return dry / (1 - moisture);
}

/**
 * Energy from protein, carbs (less fibre), fibre and fat with the general factors 4, 4, 2, 9.
 * USDA uses food-specific factors, so this is a check, not the value shown.
 */
export const atwaterKcal = (n: Nutrients) =>
  4 * n.proteinG + 4 * Math.max(0, n.carbsG - n.fibreG) + 2 * n.fibreG + 9 * n.fatG;

/** The grams in one of `unit`, or null when the food has no such unit. */
export function unitGrams(
  food: Pick<Food, 'density' | 'pieceG' | 'servingG'>,
  unit: UnitId,
  size: SizeId | null,
  katoriMl?: number | null,
): number | null {
  const vol = (ml: number) => ml * (FILL[unit] ?? 1) * food.density;
  switch (unit) {
    case 'katori': {
      const s = size ?? 'medium';
      const ml = katoriMl ? katoriMl * { small: 0.75, medium: 1, large: 1.25 }[s] : KATORI_ML[s];
      return vol(ml);
    }
    case 'cup':
      return vol(size === 'small' ? CUP_ML.small : CUP_ML.medium);
    case 'ladle':
      return vol(LADLE_ML);
    case 'glass':
      return vol(GLASS_ML);
    case 'tbsp':
      return vol(TBSP_ML);
    case 'tsp':
      return vol(TSP_ML);
    case 'piece':
      return food.pieceG;
    case 'serving':
    case 'share':
      return food.servingG;
    case 'g':
      return 1;
  }
}

/** Nutrients in `grams` of a food at an oil level. */
export function portionNutrients(
  food: Pick<Food, 'per100' | 'fatPer100'>,
  grams: number,
  oil: OilLevel | null = 'normal',
): Nutrients {
  const base = scaleNutrients(food.per100, grams / 100);
  if (!food.fatPer100 || !oil || oil === 'normal') return base;
  return addNutrients(base, scaleNutrients(food.fatPer100, ((OIL_FACTOR[oil] - 1) * grams) / 100));
}

export const UNIT_LABEL: Record<UnitId, [string, string]> = {
  katori: ['katori', 'katori'],
  ladle: ['ladle', 'ladles'],
  glass: ['glass', 'glasses'],
  cup: ['cup', 'cups'],
  tbsp: ['tbsp', 'tbsp'],
  tsp: ['tsp', 'tsp'],
  piece: ['piece', 'pieces'],
  serving: ['serving', 'servings'],
  share: ['share', 'shares'],
  g: ['g', 'g'],
};

const SIZE_LABEL: Record<SizeId, string> = { small: 'small', medium: '', large: 'large' };

function amountText(amount: number): string {
  const whole = Math.floor(amount);
  const frac = amount - whole;
  const f =
    Math.abs(frac - 0.5) < 0.01
      ? '½'
      : Math.abs(frac - 0.25) < 0.01
        ? '¼'
        : Math.abs(frac - 0.75) < 0.01
          ? '¾'
          : '';
  if (f) return whole ? `${whole}${f}` : f;
  return String(round1(amount));
}

/** "2 rotis", "1½ katori", "150 g", "1 large katori". */
export function portionText(
  amount: number,
  unit: UnitId,
  size: SizeId | null,
  pieceName?: [string, string] | null,
): string {
  if (unit === 'g') return `${Math.round(amount)} g`;
  const [one, many] = unit === 'piece' && pieceName ? pieceName : UNIT_LABEL[unit];
  const sized = size && (unit === 'katori' || unit === 'cup') ? SIZE_LABEL[size] : '';
  const noun = amount > 1 ? many : one;
  return [amountText(amount), sized, noun].filter(Boolean).join(' ');
}
