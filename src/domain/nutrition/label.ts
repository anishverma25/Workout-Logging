/**
 * Working out a portion from a nutrition label: the person's amount, in grams or servings,
 * times the label's values per 100 g or per serving. The AI only reads the label; this does
 * the arithmetic, so the numbers are exactly the pack's.
 */

export type LabelColumn = 'per100' | 'perServing';

export interface LabelNumbers {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
}

export interface LabelPortion {
  /** Grams eaten, or null when the pack gives no serving weight and they counted servings. */
  grams: number | null;
  /** Servings eaten, when that is how they measured it and no gram weight is known. */
  servings: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Less than this many servings is almost always a typing slip (0.1 for 1). */
export const MIN_SERVINGS = 0.25;

/**
 * Null when something needed is missing: the calories, an amount, or the serving size when
 * per-serving values meet an amount in grams (or servings meet per 100 g values).
 */
export function labelPortion(input: {
  values: LabelNumbers;
  column: LabelColumn;
  servingG: number | null;
  amount: number | null;
  unit: 'g' | 'serving';
}): LabelPortion | null {
  const { values, column, servingG, amount, unit } = input;
  if (values.kcal === null || !amount || !(amount > 0) || !Number.isFinite(amount)) return null;
  if (unit === 'serving' && amount < MIN_SERVINGS) return null;
  const grams = unit === 'g' ? amount : servingG ? amount * servingG : null;
  // How many of the label's columns the portion is.
  const factor =
    column === 'per100'
      ? grams !== null
        ? grams / 100
        : null
      : unit === 'serving'
        ? amount
        : servingG
          ? amount / servingG
          : null;
  if (factor === null || !Number.isFinite(factor)) return null;
  const out = {
    // Never the amount typed as if it were grams: without a weight, the portion is servings.
    grams: grams !== null ? Math.round(grams) : null,
    servings: grams === null ? amount : null,
    kcal: Math.round(values.kcal * factor),
    proteinG: r1((values.proteinG ?? 0) * factor),
    carbsG: r1((values.carbsG ?? 0) * factor),
    fatG: r1((values.fatG ?? 0) * factor),
    fibreG: r1((values.fibreG ?? 0) * factor),
  };
  const numbers = [out.kcal, out.proteinG, out.carbsG, out.fatG, out.fibreG];
  if (!numbers.every(Number.isFinite) || (out.grams !== null && out.grams < 1)) return null;
  return out;
}

/** Whether a label column's energy roughly matches its macros (labels round; fibre counts less). */
export function labelAddsUp(v: LabelNumbers): boolean {
  if (v.kcal === null || v.proteinG === null || v.carbsG === null || v.fatG === null) return true;
  const macros = 4 * v.proteinG + 4 * v.carbsG + 9 * v.fatG;
  if (v.kcal < 20) return macros < 40;
  return Math.abs(macros - v.kcal) / v.kcal <= 0.2;
}

/** A diet for a packaged food from its name: meat and fish, eggs, else vegetarian. */
export function dietFromName(name: string): 'veg' | 'egg' | 'nonveg' {
  if (/chicken|mutton|fish|tuna|salmon|prawn|meat|beef|pork|lamb|keema/i.test(name))
    return 'nonveg';
  if (/\begg/i.test(name)) return 'egg';
  return 'veg';
}
