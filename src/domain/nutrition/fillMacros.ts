/**
 * Carbohydrate and fat for a food when the person knows only its calories and protein.
 *
 * The energy left after protein (Atwater: 4 kcal per g of protein and carbohydrate, 9 per g of
 * fat) is shared between carbohydrate and fat the way the reference food shares it, for
 * example the food OverloadGPT suggested. With no reference, 60% of that energy goes to
 * carbohydrate and 40% to fat, close to a typical Indian home meal. The result is a starting
 * point the person can change; anything they type themselves is never replaced.
 */

/** Share of the non-protein energy from carbohydrate when there is no reference food. */
export const DEFAULT_CARB_SHARE = 0.6;

const round1 = (v: number) => Math.round(v * 10) / 10;

export interface FilledMacros {
  carbsG: number;
  fatG: number;
}

export function fillMacros(
  kcal: number | null,
  proteinG: number | null,
  reference?: { carbsG: number | null; fatG: number | null } | null,
): FilledMacros | null {
  if (kcal === null || proteinG === null || !(kcal >= 0) || !(proteinG >= 0)) return null;
  const left = kcal - proteinG * 4;
  if (left <= 0) return { carbsG: 0, fatG: 0 };
  const refCarbKcal = (reference?.carbsG ?? 0) * 4;
  const refFatKcal = (reference?.fatG ?? 0) * 9;
  const share =
    refCarbKcal + refFatKcal > 0 ? refCarbKcal / (refCarbKcal + refFatKcal) : DEFAULT_CARB_SHARE;
  return { carbsG: round1((left * share) / 4), fatG: round1((left * (1 - share)) / 9) };
}
