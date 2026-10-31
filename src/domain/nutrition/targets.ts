import { GOAL_PROTEIN, type EnergyPlan } from '../analytics/body';
import type { Goal } from '../models/schemas';

/**
 * Daily targets for food and water. Two ways to get them (science topic `targets`):
 *
 * - calculated: worked out from the person's body, goal and training. Energy from the energy
 *   plan, protein from the goal's g/kg range, fat at least 0.8 g/kg and a quarter of energy,
 *   carbohydrate the rest, fibre 14 g per 1,000 kcal (Institute of Medicine 2005), water 35 ml
 *   per kg of body weight.
 * - own: whatever the person typed. Anything left empty falls back to the calculated number.
 */
export type TargetMode = 'calculated' | 'own';

export interface OwnTargets {
  calorieTarget?: number | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
  fibreTargetG?: number | null;
  waterTargetMl?: number | null;
}

export interface TargetProfile extends OwnTargets {
  targetMode?: TargetMode | null;
  /** The training goal, for the macros of a calorie target the person typed. */
  goal?: Goal | null;
}

/** The day's targets, and where each number came from. */
export interface DailyTargets {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
  waterMl: number | null;
  kcalSource: 'set' | 'calculated' | null;
  proteinSource: 'set' | 'calculated' | null;
  /** The mode in force; null until the person has chosen and has no numbers of their own. */
  mode: TargetMode | null;
}

/** Fat share of energy for the calculated plan: inside the 20 to 35% range, near the low end. */
export const CALC_FAT_SHARE = 0.25;
/** Minimum fat in g per kg of body weight. */
export const FAT_MIN_G_PER_KG = 0.8;
export const FIBRE_G_PER_1000_KCAL_TARGET = 14;
export const WATER_ML_PER_KG = 35;
export const WATER_MIN_ML = 1500;
export const WATER_MAX_ML = 4500;

const round = (v: number, step: number) => Math.round(v / step) * step;

export interface CalculatedTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  waterMl: number | null;
}

/** Water for a body weight: 35 ml per kg to the nearest 250 ml, kept between 1.5 and 4.5 L. */
export function calculatedWaterMl(weightKg: number | null): number | null {
  if (!weightKg || weightKg <= 0) return null;
  return Math.min(WATER_MAX_ML, Math.max(WATER_MIN_ML, round(WATER_ML_PER_KG * weightKg, 250)));
}

/** Every target worked out from the energy plan. Null without an energy plan (no weight). */
export function calculatedTargets(
  energy: EnergyPlan | null,
  weightKg: number | null,
): CalculatedTargets | null {
  if (!energy) return null;
  const kcal = energy.targetKcal;
  const proteinG = Math.round((energy.proteinG[0] + energy.proteinG[1]) / 2);
  const fatMin = weightKg ? FAT_MIN_G_PER_KG * weightKg : energy.fatMinG;
  const fatG = Math.max(round(fatMin, 5), round((CALC_FAT_SHARE * kcal) / 9, 5));
  const carbsG = Math.max(0, round((kcal - proteinG * 4 - fatG * 9) / 4, 5));
  return {
    kcal,
    proteinG,
    carbsG,
    fatG,
    fibreG: Math.round((FIBRE_G_PER_1000_KCAL_TARGET * kcal) / 1000),
    waterMl: calculatedWaterMl(weightKg),
  };
}

const hasOwn = (p: TargetProfile | null) =>
  p !== null &&
  [
    p.calorieTarget,
    p.proteinTargetG,
    p.carbsTargetG,
    p.fatTargetG,
    p.fibreTargetG,
    p.waterTargetMl,
  ].some((v) => v != null);

/** The mode in force: the one chosen, else "own" for people who set numbers before the choice existed. */
export function targetMode(profile: TargetProfile | null): TargetMode | null {
  if (profile?.targetMode) return profile.targetMode;
  return hasOwn(profile) ? 'own' : null;
}

export function dailyTargets(
  profile: TargetProfile | null,
  energy: EnergyPlan | null,
  weightKg: number | null = null,
): DailyTargets {
  const mode = targetMode(profile);
  const calc = calculatedTargets(energy, weightKg);
  // In calculated mode the person's typed numbers stay saved but are not used.
  const own: OwnTargets = mode === 'calculated' ? {} : (profile ?? {});
  const pick = (mine: number | null | undefined, calculated: number | null | undefined) =>
    mine ?? calculated ?? null;
  const kcal = pick(own.calorieTarget, calc?.kcal);
  // With calories of their own, the macros they left empty follow those calories and their goal.
  const fromKcal =
    own.calorieTarget != null
      ? macrosForCalories({
          kcal: own.calorieTarget,
          weightKg,
          goal: profile?.goal ?? 'general_fitness',
          fixed: {
            proteinG: own.proteinTargetG ?? undefined,
            carbsG: own.carbsTargetG ?? undefined,
            fatG: own.fatTargetG ?? undefined,
            fibreG: own.fibreTargetG ?? undefined,
          },
        })
      : null;
  const base = fromKcal ?? calc;
  const proteinG = pick(own.proteinTargetG, base?.proteinG);
  return {
    kcal,
    proteinG,
    carbsG: pick(own.carbsTargetG, base?.carbsG),
    fatG: pick(own.fatTargetG, base?.fatG),
    fibreG: pick(own.fibreTargetG, base?.fibreG),
    waterMl: pick(own.waterTargetMl, calc?.waterMl ?? calculatedWaterMl(weightKg)),
    kcalSource: own.calorieTarget != null ? 'set' : calc ? 'calculated' : null,
    proteinSource: own.proteinTargetG != null ? 'set' : calc ? 'calculated' : null,
    mode,
  };
}

/** Energy in a set of macro targets, to show whether a person's own numbers add up. */
export function macroKcal(t: { proteinG: number; carbsG: number; fatG: number }) {
  return t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
}

/**
 * Fat as a share of energy for each goal, inside the 20 to 35% range (Institute of Medicine
 * 2005). A quarter for goals that need the carbohydrate for training volume, a little more for
 * strength and general fitness.
 */
export const GOAL_FAT_SHARE: Record<Goal, number> = {
  hypertrophy: 0.25,
  strength_hypertrophy: 0.25,
  strength: 0.3,
  fat_loss: 0.25,
  recomposition: 0.25,
  general_fitness: 0.3,
};

/** Protein as a share of energy when there is no body weight to work from. */
const PROTEIN_SHARE_NO_WEIGHT: Record<Goal, number> = {
  hypertrophy: 0.25,
  strength_hypertrophy: 0.25,
  strength: 0.25,
  fat_loss: 0.3,
  recomposition: 0.3,
  general_fitness: 0.2,
};

export interface MacroSplit {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}

/**
 * Macros for a calorie target the person typed, for their goal. Anything they typed themselves
 * is kept as it is and the rest is worked out around it:
 * protein from the goal's g/kg range (its middle), fat from the goal's share of energy but at
 * least 0.8 g/kg, carbohydrate whatever energy is left at 4 kcal/g, fibre 14 g per 1,000 kcal.
 * When the typed numbers leave too little energy, carbohydrate goes to zero first, then fat.
 */
export function macrosForCalories(input: {
  kcal: number;
  weightKg: number | null;
  goal: Goal;
  fixed?: Partial<MacroSplit>;
}): MacroSplit {
  const { kcal, weightKg, goal } = input;
  const fixed = input.fixed ?? {};
  const kg = weightKg && weightKg > 0 ? weightKg : null;
  const [lo, hi] = GOAL_PROTEIN[goal];
  const proteinG =
    fixed.proteinG ??
    (kg
      ? Math.round(((lo + hi) / 2) * kg)
      : Math.round((PROTEIN_SHARE_NO_WEIGHT[goal] * kcal) / 4));
  const left = (g: { p: number; c?: number; f?: number }) =>
    kcal - g.p * 4 - (g.c ?? 0) * 4 - (g.f ?? 0) * 9;

  let fatG: number;
  let carbsG: number;
  if (fixed.fatG != null) {
    fatG = fixed.fatG;
    carbsG = fixed.carbsG ?? Math.max(0, round(left({ p: proteinG, f: fatG }) / 4, 5));
  } else if (fixed.carbsG != null) {
    carbsG = fixed.carbsG;
    fatG = Math.max(0, round(left({ p: proteinG, c: carbsG }) / 9, 5));
  } else {
    const fatMin = kg ? FAT_MIN_G_PER_KG * kg : 0;
    fatG = Math.max(round(fatMin, 5), round((GOAL_FAT_SHARE[goal] * kcal) / 9, 5));
    const rest = left({ p: proteinG, f: fatG });
    if (rest >= 0) carbsG = round(rest / 4, 5);
    else {
      // Protein and the fat floor already pass the calories: no carbohydrate, less fat.
      carbsG = 0;
      fatG = Math.max(0, round(left({ p: proteinG }) / 9, 5));
    }
  }
  return {
    proteinG,
    carbsG,
    fatG,
    fibreG: fixed.fibreG ?? Math.round((FIBRE_G_PER_1000_KCAL_TARGET * kcal) / 1000),
  };
}
