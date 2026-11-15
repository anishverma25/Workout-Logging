import { useMemo } from 'react';
import {
  BookOpen,
  CalendarCheck,
  CalendarRange,
  Dumbbell,
  Gauge,
  Scale,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useAccount } from '@/app/account';
import { useFeature } from '@/app/entitlement';
import { CapsuleButton } from '@/components/kit';
import { useActiveWorkout, type QueryState } from '@/data/hooks';
import type { TodayPlan } from '@/domain/analytics/dashboard';
import { isAlive, type TrainingData } from '@/domain/analytics/sessions';
import { nowCard, usualHour, type NowKind } from '@/domain/brain/now';
import { GOAL_PROTEIN } from '@/domain/analytics/body';
import { LOGGED_DAY_KCAL } from '@/domain/brain/limits';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import type { MuscleGroup } from '@/domain/models/schemas';
import { firstDaysCard, type FirstDaysKind } from '@/domain/onboarding/firstDays';
import { dayTotals } from '@/domain/nutrition/analysis';
import { eatNext, habitsFrom } from '@/domain/nutrition/solver';
import { addDays, toDateKey } from '@/lib/dates';
import { useBrain } from '../brain/useBrain';
import { readMealPrefs } from '../food/mealPrefs';
import { mealForHour, useFoodContextFrom } from '../food/useFoodContext';

const ICON: Record<NowKind | FirstDaysKind, typeof Scale> = {
  review: CalendarCheck,
  wrapped: Sparkles,
  weigh: Scale,
  train: Dumbbell,
  protein: Utensils,
  meal: Utensils,
  first_workout: Dumbbell,
  pick_routine: CalendarRange,
  first_food: Utensils,
  first_weight: Scale,
  muscle_sets: BookOpen,
  learning: Gauge,
};

const DAY_MS = 86_400_000;

/**
 * The Now card (free): one card at the top of Home that changes through the day, picked from
 * the person's own habits. Everything else on Home stays in its place. Shown only when there
 * is something worth saying.
 */
export function NowCard({
  training,
  today,
  now,
  wrappedMonth = null,
}: {
  training: QueryState<TrainingData>;
  today: TodayPlan;
  now: Date;
  wrappedMonth?: string | null;
}) {
  const pro = useFeature('adaptive_plan');
  const macros = useFeature('macro_tracking');
  const brain = useBrain(now);
  const createdAt = useAccount().user?.createdAt ?? null;
  const food = useFoodContextFrom(now, training);
  const active = useActiveWorkout();
  const data = training.data;
  const hour = now.getHours();
  const day = toDateKey(now);

  const card = useMemo(() => {
    if (!data || food.status !== 'success') return null;
    const weights = data.bodyWeights.filter((w) => isAlive(w) && w.origin === 'user');
    const since = addDays(now, -14).toISOString();
    const recentWeights = weights.filter((w) => w.measuredAt >= since);
    const workouts = data.workouts
      .filter((w) => isAlive(w) && w.status === 'completed' && w.origin === 'user')
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .slice(-8);
    const logs = food.logs.filter((l) => !l.deletedAt);
    const weekAgo = toDateKey(addDays(now, -7));
    const foodDays7 = new Set(
      logs.filter((l) => l.date > weekAgo && l.date <= day).map((l) => l.date),
    ).size;
    const eaten = dayTotals(logs, day);
    const kcalLeft = food.targets.kcal ? food.targets.kcal - eaten.kcal : null;
    // Protein and what fits the rest of the day are Pro macro tracking.
    const proteinLeft =
      macros && food.targets.proteinG ? food.targets.proteinG - eaten.proteinG : null;
    const mealNow = mealForHour(hour);
    const prefs = readMealPrefs();
    const fits =
      macros && kcalLeft !== null && hour >= 19
        ? eatNext({
            remaining: { kcal: kcalLeft, proteinG: proteinLeft ?? 0 },
            meal: mealNow,
            diet: food.diet,
            foods: food.foodById,
            habits: habitsFrom(logs, day),
            setting: prefs.setting,
            budget: prefs.budget,
            katoriMl: food.katoriMl,
          }).map((p) => p.food.name)
        : [];
    const now_ = nowCard({
      hour,
      dayOfMonth: now.getDate(),
      reviewChanges: pro && !brain.record ? (brain.decision?.changes.length ?? 0) : 0,
      wrappedMonth,
      weighedToday: weights.some((w) => toDateKey(new Date(w.measuredAt)) === day),
      weighIns14: recentWeights.length,
      usualWeighHour: usualHour(recentWeights.map((w) => new Date(w.measuredAt))),
      plannedDay: today.kind === 'planned' ? today.day.name : null,
      usualGymHour: usualHour(workouts.map((w) => new Date(w.startedAt))),
      workoutOpen: !!active.data,
      foodDays7,
      kcalLeft,
      proteinLeft,
      mealNow,
      mealLogged: logs.some((l) => l.date === day && l.meal === mealNow),
      fits,
    });
    if (now_) return now_;

    // The first 14 days (batch 9): one next step, then something true back, then the meter.
    const ageDays = createdAt
      ? Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS)
      : Number.POSITIVE_INFINITY;
    const completed = data.workouts.filter(
      (w) => isAlive(w) && w.status === 'completed' && w.origin === 'user',
    ).length;
    const ownLogs = logs.filter((l) => l.origin === 'user');
    const foodDates = [...new Set(ownLogs.map((l) => l.date))];
    const fullDays = foodDates
      .map((d) => dayTotals(ownLogs, d))
      .filter((t) => t.kcal >= LOGGED_DAY_KCAL);
    const weightKg = food.snapshot?.weightKg ?? null;
    const proteinPerKg =
      // Three full days smooth out one odd day (PROTEIN_INSIGHT_DAYS).
      weightKg && fullDays.length >= 3
        ? fullDays.reduce((sum, t) => sum + t.proteinG, 0) / fullDays.length / weightKg
        : null;
    const goal = data.profile?.goal ?? null;
    const thisWeek = brain.weeks.at(-1);
    const stage = brain.model?.stage;
    const muscleSets = Object.fromEntries(
      Object.entries(thisWeek?.muscles ?? {}).map(([m, n]) => [
        MUSCLE_LABELS[m as MuscleGroup] ?? m,
        n,
      ]),
    );
    return firstDaysCard({
      ageDays,
      workouts: completed,
      foodDays: foodDates.length,
      weighIns: weights.length,
      plannedDay: today.kind === 'planned' ? today.day.name : null,
      hasRoutine: today.kind !== 'no_routine',
      muscleSets,
      proteinPerKg,
      proteinRange: goal ? GOAL_PROTEIN[goal] : undefined,
      macros,
      learning: stage?.learning ? { week: stage.week, of: stage.of } : null,
      weekFoodDays: thisWeek?.foodDays ?? 0,
      weekWeighIns: thisWeek?.weighIns ?? 0,
    });
    // `now` is read through the hour and the day, so the card does not recompute every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    food.status,
    food.logs,
    food.targets.kcal,
    food.targets.proteinG,
    hour,
    day,
    pro,
    macros,
    brain.record,
    brain.decision,
    brain.weeks,
    brain.model,
    food.snapshot,
    createdAt,
    today,
    active.data,
    wrappedMonth,
  ]);

  if (!card) return null;
  const Icon = ICON[card.kind];
  return (
    <section
      aria-labelledby="now-title"
      className="mb-6 flex items-center gap-3 rounded-card bg-surface py-3.5 pr-3 pl-4"
      data-now-card={card.kind}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-lime">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-footnote text-lime">Now</p>
        <h2 id="now-title" className="type-headline text-text-1">
          {card.title}
        </h2>
        <p className="type-subhead text-text-2">{card.detail}</p>
      </div>
      <CapsuleButton to={card.to} tone="lime" data-now-action>
        {card.action}
      </CapsuleButton>
    </section>
  );
}
