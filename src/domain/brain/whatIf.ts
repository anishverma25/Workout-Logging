import { KCAL_PER_KG, calorieFloor } from './limits';
import { SET_BANDS, findingFor, setBand, type ResponseModel } from './response';

/**
 * "Try a different plan": what a calorie target and a number of weekly sets would likely do over
 * the next 8 weeks, from the same model the weekly decision uses. A way to understand a choice
 * next to the real decision, not a promise: the range widens the less of the person's own data
 * there is, and a lift's line is only bent by sets when their own logs support it.
 */

export const WHAT_IF_WEEKS = 8;
/** How unsure maintenance is, by how much of the person's data is behind it. */
export const MAINTENANCE_SPREAD = { research: 0.12, learning: 0.08, personal: 0.05 } as const;

export interface WhatIfInput {
  model: ResponseModel;
  weightKg: number;
  bmrKcal: number | null;
  kcal: number;
  /** The lift to project, and its muscle with the weekly sets being tried. */
  lift: { exerciseId: string; muscle: string; sets: number } | null;
}

export interface Range {
  mid: number;
  lo: number;
  hi: number;
}

export interface WhatIf {
  weeks: number;
  /** False when the calories are under the lowest target the plan allows. */
  allowed: boolean;
  floor: number;
  /** Body weight at the end, and the weekly change behind it. */
  weight: (Range & { perWeek: number }) | null;
  /** Estimated 1RM of the lift at the end. */
  lift: (Range & { now: number; personal: boolean }) | null;
}

export function whatIf(input: WhatIfInput): WhatIf {
  const { model, weightKg, kcal } = input;
  const floor = calorieFloor(input.bmrKcal);
  const weeks = WHAT_IF_WEEKS;
  let weight: WhatIf['weight'] = null;
  if (model.maintenance) {
    const m = model.maintenance.value;
    const spread = MAINTENANCE_SPREAD[model.maintenance.confidence];
    const perWeek = ((kcal - m) * 7) / KCAL_PER_KG;
    const at = (maintenance: number) =>
      weightKg + (((kcal - maintenance) * 7) / KCAL_PER_KG) * weeks;
    weight = { mid: at(m), lo: at(m * (1 + spread)), hi: at(m * (1 - spread)), perWeek };
  }

  let lift: WhatIf['lift'] = null;
  const trend = input.lift ? model.lifts[input.lift.exerciseId] : undefined;
  if (input.lift && trend) {
    let weekly = trend.weekly;
    let personal = false;
    // Sets bend the line only when the person's own logs show which range moves this muscle.
    const finding = findingFor(model, 'sets', input.lift.muscle);
    if (finding?.confidence === 'personal') {
      const tried = finding.groups.find((g) => g.cond === setBand(input.lift!.sets));
      if (tried && tried.n >= 5) {
        weekly = tried.mean;
        personal = true;
      }
    }
    // Eating under maintenance bends it too, again only on the person's own evidence.
    const energy = findingFor(model, 'energy', 'all');
    if (energy?.confidence === 'personal' && model.maintenance) {
      const cond = kcal <= model.maintenance.value - 250 ? 'deficit' : 'fed';
      const fed = energy.groups.find((g) => g.cond === 'fed');
      const mine = energy.groups.find((g) => g.cond === cond);
      if (fed && mine) weekly += mine.mean - fed.mean;
    }
    const band = trend.spread * Math.sqrt(weeks);
    const mid = trend.latest * (1 + weekly) ** weeks;
    lift = {
      now: trend.latest,
      mid,
      lo: mid * (1 - band),
      hi: mid * (1 + band),
      personal,
    };
  }
  return { weeks, allowed: kcal >= floor, floor, weight, lift };
}

export { SET_BANDS };
