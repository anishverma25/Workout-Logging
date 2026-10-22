import type { FoodLog } from '@/domain/models/schemas';
import { MEALS, type Meal } from './types';

/**
 * One day's food, analysed against the evidence (Pro). Pure: every number comes from the logs,
 * the person's targets and their trend weight. Nothing is scored or combined into a made-up
 * grade: each check shows its number, the range it is judged against and where that range
 * comes from (science topic `day-analysis`).
 *
 * - Energy against the day's target, and against real maintenance when it is known.
 * - Macronutrient split against the Acceptable Macronutrient Distribution Ranges (Institute of
 *   Medicine 2005): protein 10 to 35%, carbohydrate 45 to 65%, fat 20 to 35% of energy.
 * - Protein per kg of body weight against the goal's range (Morton 2018, Helms 2014).
 * - Protein spread: meals with at least 0.4 g/kg (Schoenfeld and Aragon 2018).
 * - Fibre against 14 g per 1,000 kcal eaten (Institute of Medicine 2005).
 * - On training days, carbohydrate per kg against 4 to 7 g/kg for strength training (Slater
 *   and Phillips 2011).
 */

export type Verdict = 'low' | 'in_range' | 'high';

export const AMDR = {
  protein: [10, 35],
  carbs: [45, 65],
  fat: [20, 35],
} as const;
export const PROTEIN_PER_MEAL_G_PER_KG = 0.4;
export const FIBRE_G_PER_1000_KCAL = 14;
export const TRAINING_CARBS_G_PER_KG: [number, number] = [4, 7];
/** Within this share of the target counts as on target. */
export const ENERGY_TOLERANCE = 0.1;

export interface Check {
  value: number;
  range: [number, number];
  verdict: Verdict;
}

export interface DayAnalysis {
  kcal: number;
  energy: {
    target: number | null;
    /** Intake as a share of the target, 1 = on target. */
    ofTarget: number | null;
    verdict: Verdict | null;
    /** Intake minus real maintenance, when maintenance is known. */
    vsMaintenance: number | null;
  };
  /** Share of energy (%) from each macronutrient, judged against the AMDR. */
  split: { protein: Check; carbs: Check; fat: Check } | null;
  proteinPerKg: Check | null;
  /** Meals eaten today, and how many reached the per-meal protein dose. */
  proteinSpread: { meals: Meal[]; reached: Meal[]; doseG: number } | null;
  fibre: Check;
  /** Only on training days with a body weight. */
  trainingCarbs: Check | null;
  /** Today and still being logged: judged as it stands, and labelled so. */
  partial: boolean;
}

const verdictOf = (value: number, [lo, hi]: [number, number]): Verdict =>
  value < lo ? 'low' : value > hi ? 'high' : 'in_range';

const r1 = (v: number) => Math.round(v * 10) / 10;

export function analyseDay(input: {
  logs: FoodLog[];
  date: string;
  today: string;
  targets: { kcal: number | null; proteinG: number | null };
  proteinRangeGPerKg: [number, number] | null;
  weightKg: number | null;
  maintenanceKcal: number | null;
  trainingDay: boolean;
}): DayAnalysis | null {
  const logs = input.logs.filter((l) => l.date === input.date && !l.deletedAt);
  if (logs.length === 0) return null;
  const sum = (k: 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG') =>
    logs.reduce((t, l) => t + (l[k] ?? 0), 0);
  const kcal = Math.round(sum('kcal'));
  const protein = sum('proteinG');
  const carbs = sum('carbsG');
  const fat = sum('fatG');
  const fibre = sum('fibreG');
  const w = input.weightKg && input.weightKg > 0 ? input.weightKg : null;

  const target = input.targets.kcal;
  const ofTarget = target ? kcal / target : null;
  const energy = {
    target,
    ofTarget: ofTarget === null ? null : Math.round(ofTarget * 100) / 100,
    verdict:
      ofTarget === null ? null : verdictOf(ofTarget, [1 - ENERGY_TOLERANCE, 1 + ENERGY_TOLERANCE]),
    vsMaintenance: input.maintenanceKcal ? kcal - Math.round(input.maintenanceKcal) : null,
  };

  // Shares of the energy the macronutrients supply (4, 4 and 9 kcal per g).
  const macroKcal = protein * 4 + carbs * 4 + fat * 9;
  const share = (k: number) => (macroKcal > 0 ? Math.round((k / macroKcal) * 100) : 0);
  const check = (value: number, range: readonly [number, number]): Check => ({
    value,
    range: [range[0], range[1]],
    verdict: verdictOf(value, [range[0], range[1]]),
  });
  const split =
    macroKcal > 0
      ? {
          protein: check(share(protein * 4), AMDR.protein),
          carbs: check(share(carbs * 4), AMDR.carbs),
          fat: check(share(fat * 9), AMDR.fat),
        }
      : null;

  const proteinPerKg =
    w && input.proteinRangeGPerKg ? check(r1(protein / w), input.proteinRangeGPerKg) : null;

  let proteinSpread: DayAnalysis['proteinSpread'] = null;
  if (w) {
    const doseG = Math.round(PROTEIN_PER_MEAL_G_PER_KG * w);
    const meals = MEALS.filter((m) => logs.some((l) => l.meal === m));
    const reached = meals.filter(
      (m) => logs.filter((l) => l.meal === m).reduce((t, l) => t + l.proteinG, 0) >= doseG,
    );
    proteinSpread = { meals, reached, doseG };
  }

  const fibreTarget = Math.round((FIBRE_G_PER_1000_KCAL * kcal) / 1000);
  const fibreCheck: Check = {
    value: r1(fibre),
    range: [fibreTarget, Number.POSITIVE_INFINITY],
    verdict: fibre >= fibreTarget ? 'in_range' : 'low',
  };

  const trainingCarbs =
    input.trainingDay && w ? check(r1(carbs / w), TRAINING_CARBS_G_PER_KG) : null;

  return {
    kcal,
    energy,
    split,
    proteinPerKg,
    proteinSpread,
    fibre: fibreCheck,
    trainingCarbs,
    partial: input.date === input.today,
  };
}
