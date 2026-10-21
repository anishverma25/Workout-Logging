import type { FoodLog } from '../models/schemas';
import { KCAL_PER_KG } from '../analytics/targets';
import type { TrendPoint } from '../analytics/body';
import { addDays, toDateKey } from '@/lib/dates';
import {
  portionNutrients,
  roundNutrients,
  scaleNutrients,
  sumNutrients,
  unitGrams,
  type Food,
} from './calc';
import { fitsDiet } from './search';
import { ZERO, type DietType, type Meal, type Nutrients, type UnitId } from './types';

/**
 * What the food log says, as pure functions: daily totals, the meals a person repeats, real
 * maintenance calories from intake and the weight trend, and protein suggestions. Topic
 * `food-values` on the science page explains each rule.
 */

export const nutrientsOf = (l: FoodLog): Nutrients => ({
  kcal: l.kcal,
  proteinG: l.proteinG,
  carbsG: l.carbsG,
  fatG: l.fatG,
  fibreG: l.fibreG,
});

export function totalsByDay(logs: FoodLog[]): Map<string, Nutrients> {
  const map = new Map<string, Nutrients>();
  for (const l of logs) {
    if (l.deletedAt !== null) continue;
    map.set(l.date, sumNutrients([map.get(l.date) ?? ZERO, nutrientsOf(l)]));
  }
  for (const [k, v] of map) map.set(k, roundNutrients(v));
  return map;
}

export function dayTotals(logs: FoodLog[], date: string): Nutrients {
  return totalsByDay(logs.filter((l) => l.date === date)).get(date) ?? ZERO;
}

export function mealsOn(logs: FoodLog[], date: string): Record<Meal, FoodLog[]> {
  const out: Record<Meal, FoodLog[]> = { breakfast: [], lunch: [], snacks: [], dinner: [] };
  for (const l of logs) if (l.date === date && l.deletedAt === null) out[l.meal].push(l);
  for (const m of Object.keys(out) as Meal[])
    out[m].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return out;
}

/** A meal to log again: the foods and portions as they were. */
export interface MealTemplate {
  /** Usual: eaten at this meal on 3 or more days in the last 4 weeks. */
  kind: 'usual' | 'previous';
  date: string;
  items: FoodLog[];
  times: number;
}

const signature = (items: FoodLog[]) =>
  items
    .map((l) => `${l.foodId}:${l.amount}:${l.unit}:${l.size ?? ''}`)
    .sort()
    .join('|');

/** Days a usual meal must repeat on, within USUAL_WINDOW_DAYS. */
export const USUAL_MIN_TIMES = 3;
export const USUAL_WINDOW_DAYS = 28;

/**
 * The meal the person eats most often at this time (same foods and portions on at least 3 days
 * in 4 weeks), and the last time they had this meal, for one-tap logging.
 */
export function mealTemplates(logs: FoodLog[], meal: Meal, today: string): MealTemplate[] {
  const from = toDateKey(addDays(new Date(`${today}T12:00:00`), -USUAL_WINDOW_DAYS));
  const groups = new Map<string, FoodLog[]>();
  for (const l of logs) {
    if (l.deletedAt !== null || l.meal !== meal || l.date >= today || l.date < from) continue;
    const g = groups.get(l.date) ?? [];
    g.push(l);
    groups.set(l.date, g);
  }
  const dates = [...groups.keys()].sort().reverse();
  const out: MealTemplate[] = [];
  const counts = new Map<string, { n: number; date: string }>();
  for (const d of dates) {
    const sig = signature(groups.get(d)!);
    const c = counts.get(sig);
    counts.set(sig, { n: (c?.n ?? 0) + 1, date: c?.date ?? d });
  }
  const best = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  if (best && best[1].n >= USUAL_MIN_TIMES)
    out.push({
      kind: 'usual',
      date: best[1].date,
      items: groups.get(best[1].date)!,
      times: best[1].n,
    });
  const last = dates[0];
  if (last && (!out[0] || signature(groups.get(last)!) !== signature(out[0].items)))
    out.push({ kind: 'previous', date: last, items: groups.get(last)!, times: 1 });
  return out;
}

/** Foods logged before, most recent first, each with the portion used last time. */
export function recentFoods(logs: FoodLog[], limit = 12): FoodLog[] {
  const seen = new Set<string>();
  const out: FoodLog[] = [];
  const sorted = logs
    .filter((l) => l.deletedAt === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const l of sorted) {
    if (seen.has(l.foodId)) continue;
    seen.add(l.foodId);
    out.push(l);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Real maintenance
// ---------------------------------------------------------------------------------------------

/** Days of logging and weight trend real maintenance needs. */
export const MAINTENANCE_WINDOW_DAYS = 28;
export const MAINTENANCE_MIN_DAYS = 14;
/** A day under this is treated as not fully logged and left out of the average. */
export const LOGGED_DAY_MIN_KCAL = 1000;

export interface RealMaintenance {
  kcal: number;
  meanIntake: number;
  loggedDays: number;
  days: number;
  changeKg: number;
}

/**
 * Maintenance = mean daily intake − 7,700 × trend weight change ÷ days. Uses the last 4 weeks
 * before today, needs 14 fully logged days and a weight trend at both ends. Because it uses
 * what was logged, steady under-logging is absorbed: targets set from it still work.
 */
export function realMaintenance(input: {
  logs: FoodLog[];
  trend: TrendPoint[];
  now: Date;
}): RealMaintenance | null {
  const end = addDays(new Date(input.now), -1);
  const start = addDays(end, -(MAINTENANCE_WINDOW_DAYS - 1));
  const from = toDateKey(start);
  const to = toDateKey(end);
  const totals = totalsByDay(input.logs.filter((l) => l.date >= from && l.date <= to));
  const full = [...totals.values()].filter((t) => t.kcal >= LOGGED_DAY_MIN_KCAL);
  if (full.length < MAINTENANCE_MIN_DAYS) return null;
  const near = (target: Date) => {
    let best: TrendPoint | null = null;
    for (const p of input.trend) {
      const gap = Math.abs(p.date.getTime() - target.getTime());
      if (
        gap <= 4 * 86_400_000 &&
        (!best || gap < Math.abs(best.date.getTime() - target.getTime()))
      )
        best = p;
    }
    return best;
  };
  const a = near(start);
  const b = near(end);
  if (!a || !b || a === b) return null;
  const days = (b.date.getTime() - a.date.getTime()) / 86_400_000;
  if (days < MAINTENANCE_MIN_DAYS) return null;
  const meanIntake = full.reduce((s, t) => s + t.kcal, 0) / full.length;
  const changeKg = b.trendKg - a.trendKg;
  const kcal = Math.round((meanIntake - (KCAL_PER_KG * changeKg) / days) / 10) * 10;
  return {
    kcal,
    meanIntake: Math.round(meanIntake),
    loggedDays: full.length,
    days: Math.round(days),
    changeKg,
  };
}

// ---------------------------------------------------------------------------------------------
// Summaries for Progress, Home and OverloadGPT
// ---------------------------------------------------------------------------------------------

export interface NutritionSummary {
  days: number;
  loggedDays: number;
  avg: Nutrients | null;
  /** Logged days at or above the protein target. */
  proteinHitDays: number;
  /** Mean protein on days with a workout, and on days without, when both have 3 days. */
  proteinTraining: number | null;
  proteinRest: number | null;
  series: { date: string; kcal: number; proteinG: number }[];
  topProtein: { foodName: string; proteinG: number }[];
}

export function nutritionSummary(input: {
  logs: FoodLog[];
  days: number;
  now: Date;
  proteinTargetG: number | null;
  trainingDates: Set<string>;
}): NutritionSummary {
  const today = toDateKey(input.now);
  const from = toDateKey(addDays(input.now, -(input.days - 1)));
  const logs = input.logs.filter((l) => l.deletedAt === null && l.date >= from && l.date <= today);
  const totals = totalsByDay(logs);
  const series: NutritionSummary['series'] = [];
  for (let i = input.days - 1; i >= 0; i -= 1) {
    const key = toDateKey(addDays(input.now, -i));
    const t = totals.get(key);
    if (t) series.push({ date: key, kcal: t.kcal, proteinG: t.proteinG });
  }
  // Today is still going, so averages use complete days only.
  const done = series.filter((s) => s.date !== today && s.kcal >= LOGGED_DAY_MIN_KCAL);
  const avg = done.length
    ? roundNutrients(
        scaleNutrients(sumNutrients(done.map((d) => totals.get(d.date)!)), 1 / done.length),
      )
    : null;
  const mean = (list: number[]) =>
    list.length >= 3 ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;
  const byFood = new Map<string, number>();
  for (const l of logs) byFood.set(l.foodName, (byFood.get(l.foodName) ?? 0) + l.proteinG);
  return {
    days: input.days,
    loggedDays: done.length,
    avg,
    proteinHitDays:
      input.proteinTargetG === null
        ? 0
        : done.filter((s) => s.proteinG >= input.proteinTargetG!).length,
    proteinTraining: mean(
      done.filter((s) => input.trainingDates.has(s.date)).map((s) => s.proteinG),
    ),
    proteinRest: mean(done.filter((s) => !input.trainingDates.has(s.date)).map((s) => s.proteinG)),
    series,
    topProtein: [...byFood.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([foodName, proteinG]) => ({ foodName, proteinG: Math.round(proteinG) })),
  };
}

// ---------------------------------------------------------------------------------------------
// Protein suggestions
// ---------------------------------------------------------------------------------------------

/** Everyday Indian protein foods, with the portion suggested. */
const PROTEIN_FOODS: { id: string; amount: number; unit: UnitId }[] = [
  { id: 'curd', amount: 1, unit: 'katori' },
  { id: 'paneer', amount: 100, unit: 'g' },
  { id: 'boiled-egg', amount: 2, unit: 'piece' },
  { id: 'chicken-plain', amount: 150, unit: 'g' },
  { id: 'soya-curry', amount: 1, unit: 'katori' },
  { id: 'milk', amount: 1, unit: 'glass' },
  { id: 'roasted-chana', amount: 30, unit: 'g' },
  { id: 'moong-chilla', amount: 2, unit: 'piece' },
  { id: 'sprouts-chaat', amount: 1, unit: 'katori' },
  { id: 'paneer-bhurji', amount: 1, unit: 'katori' },
];

export interface ProteinSuggestion {
  food: Food;
  amount: number;
  unit: UnitId;
  nutrients: Nutrients;
}

/** Below this gap there is nothing worth suggesting. */
export const PROTEIN_GAP_MIN_G = 12;

/**
 * Up to two foods that close today's protein gap and fit the person's diet, favouring foods
 * they already eat. Logged only when the person taps Apply.
 */
export function proteinSuggestions(input: {
  gapG: number;
  diet: DietType | null | undefined;
  foods: Map<string, Food>;
  eatenIds: Set<string>;
  katoriMl?: number | null;
}): ProteinSuggestion[] {
  if (input.gapG < PROTEIN_GAP_MIN_G) return [];
  const options: (ProteinSuggestion & { rank: number })[] = [];
  for (const p of PROTEIN_FOODS) {
    const food = input.foods.get(p.id);
    if (!food || !fitsDiet(food, input.diet)) continue;
    const g = unitGrams(food, p.unit, 'medium', input.katoriMl);
    if (!g) continue;
    const nutrients = roundNutrients(portionNutrients(food, g * p.amount));
    if (nutrients.proteinG < 5) continue;
    // Closer to the gap is better; foods they already eat come first.
    const rank =
      Math.abs(Math.min(nutrients.proteinG, input.gapG) - input.gapG) -
      (input.eatenIds.has(p.id) ? 15 : 0) +
      nutrients.kcal / 100;
    options.push({ food, amount: p.amount, unit: p.unit, nutrients, rank });
  }
  return options
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 2)
    .map(({ rank: _rank, ...s }) => s);
}
