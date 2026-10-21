import type { EnergyPlan } from '../analytics/body';

/** The day's calorie and protein targets: the person's own, else the calculated ones. */
export interface DailyTargets {
  kcal: number | null;
  proteinG: number | null;
  kcalSource: 'set' | 'calculated' | null;
  proteinSource: 'set' | 'calculated' | null;
}

export function dailyTargets(
  profile: { calorieTarget?: number | null; proteinTargetG?: number | null } | null,
  energy: EnergyPlan | null,
): DailyTargets {
  const setKcal = profile?.calorieTarget ?? null;
  const setProtein = profile?.proteinTargetG ?? null;
  const calcProtein = energy ? Math.round((energy.proteinG[0] + energy.proteinG[1]) / 2) : null;
  return {
    kcal: setKcal ?? energy?.targetKcal ?? null,
    proteinG: setProtein ?? calcProtein,
    kcalSource: setKcal !== null ? 'set' : energy ? 'calculated' : null,
    proteinSource: setProtein !== null ? 'set' : calcProtein !== null ? 'calculated' : null,
  };
}
