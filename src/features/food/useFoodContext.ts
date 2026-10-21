import { useMemo } from 'react';
import { useFoodData, useTrainingData, type QueryState } from '@/data/hooks';
import { customToFood, FOODS } from '@/data/library/foods';
import { bodySnapshot } from '@/domain/analytics/body';
import { buildSessions, isAlive, type TrainingData } from '@/domain/analytics/sessions';
import { loggedDaysPerWeek } from '@/domain/analytics/week';
import type { Food } from '@/domain/nutrition/calc';
import { dailyTargets } from '@/domain/nutrition/targets';
import { dayTotals, nutritionSummary, realMaintenance } from '@/domain/nutrition/analysis';
import type { Meal } from '@/domain/nutrition/types';
import { ageFromBirthDate, toDateKey } from '@/lib/dates';

/** The meal that fits the time of day: breakfast to 11, lunch to 4, snacks to 7, then dinner. */
export function mealForHour(hour: number): Meal {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snacks';
  return 'dinner';
}

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
};

/**
 * Everything the food screens share: the library with the person's own foods, their logs,
 * their targets (their own, else calculated from their body and training), diet and katori.
 */
export function useFoodContext(now: Date) {
  return useFoodContextFrom(now, useTrainingData());
}

/** The same, for screens that already read the training data. */
export function useFoodContextFrom(now: Date, training: QueryState<TrainingData>) {
  const food = useFoodData();
  const data = training.data;
  const profile = data?.profile ?? null;

  // Recomputed once a day, not every minute.
  const day = toDateKey(now);
  const snapshot = useMemo(() => {
    if (!data) return null;
    const at = new Date(`${day}T12:00:00`);
    return bodySnapshot({
      profile,
      age: profile?.birthDate ? ageFromBirthDate(profile.birthDate, at) : null,
      bodyWeights: data.bodyWeights,
      measurements: data.measurements,
      loggedDaysPerWeek: loggedDaysPerWeek(buildSessions(data), at),
      now: at,
    });
  }, [data, profile, day]);

  const foods = useMemo<Food[]>(
    () => [...(food.data?.customFoods ?? []).map(customToFood), ...FOODS],
    [food.data?.customFoods],
  );
  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const trainingDates = useMemo(
    () =>
      new Set(
        (data?.workouts ?? [])
          .filter((w) => isAlive(w) && w.status === 'completed')
          .map((w) => toDateKey(new Date(w.startedAt))),
      ),
    [data?.workouts],
  );

  return {
    status:
      food.status === 'error' || training.status === 'error'
        ? ('error' as const)
        : food.status === 'success' && training.status === 'success'
          ? ('success' as const)
          : ('loading' as const),
    error: food.error ?? training.error,
    logs: food.data?.logs ?? [],
    customFoods: food.data?.customFoods ?? [],
    foods,
    foodById,
    profile,
    snapshot,
    targets: dailyTargets(profile, snapshot?.energy ?? null),
    diet: profile?.dietType ?? null,
    katoriMl: profile?.katoriMl ?? null,
    trainingDates,
    training: data,
  };
}

export type FoodContext = ReturnType<typeof useFoodContext>;

/** What OverloadGPT is told about food, or null when nothing has been logged. */
export function nutritionBrief(ctx: FoodContext, now: Date, days = 14) {
  if (ctx.status !== 'success' || ctx.logs.length === 0) return null;
  return {
    summary: nutritionSummary({
      logs: ctx.logs,
      days,
      now,
      proteinTargetG: ctx.targets.proteinG,
      trainingDates: ctx.trainingDates,
    }),
    today: dayTotals(ctx.logs, toDateKey(now)),
    maintenance: ctx.snapshot
      ? realMaintenance({ logs: ctx.logs, trend: ctx.snapshot.trend, now })
      : null,
    targets: ctx.targets,
    diet: ctx.diet,
  };
}
