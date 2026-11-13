import type { Budget, Setting } from '@/domain/nutrition/solver';

/** Where the person eats and how tight the budget is: remembered on this phone. */
export interface MealPrefs {
  setting: Setting;
  budget: Budget;
}
const KEY = 'overload.mealPrefs';
export const DEFAULT_MEAL_PREFS: MealPrefs = { setting: 'home', budget: 'medium' };

export function readMealPrefs(): MealPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<MealPrefs> | null;
    return {
      setting: ['home', 'hostel', 'mess', 'pg'].includes(raw?.setting ?? '')
        ? raw!.setting!
        : DEFAULT_MEAL_PREFS.setting,
      budget: ['tight', 'medium', 'open'].includes(raw?.budget ?? '')
        ? raw!.budget!
        : DEFAULT_MEAL_PREFS.budget,
    };
  } catch {
    return DEFAULT_MEAL_PREFS;
  }
}

export function writeMealPrefs(prefs: MealPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
}
