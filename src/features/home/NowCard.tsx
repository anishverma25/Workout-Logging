import { useMemo } from 'react';
import { CalendarCheck, Dumbbell, Scale, Sparkles, Utensils } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { CapsuleButton } from '@/components/kit';
import { useActiveWorkout, type QueryState } from '@/data/hooks';
import type { TodayPlan } from '@/domain/analytics/dashboard';
import { isAlive, type TrainingData } from '@/domain/analytics/sessions';
import { nowCard, usualHour, type NowKind } from '@/domain/brain/now';
import { dayTotals } from '@/domain/nutrition/analysis';
import { eatNext, habitsFrom } from '@/domain/nutrition/solver';
import { addDays, toDateKey } from '@/lib/dates';
import { useBrain } from '../brain/useBrain';
import { readMealPrefs } from '../food/mealPrefs';
import { mealForHour, useFoodContextFrom } from '../food/useFoodContext';

const ICON: Record<NowKind, typeof Scale> = {
  review: CalendarCheck,
  wrapped: Sparkles,
  weigh: Scale,
  train: Dumbbell,
  protein: Utensils,
  meal: Utensils,
};

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
  const brain = useBrain(now);
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
    const proteinLeft = food.targets.proteinG ? food.targets.proteinG - eaten.proteinG : null;
    const mealNow = mealForHour(hour);
    const prefs = readMealPrefs();
    const fits =
      kcalLeft !== null && hour >= 19
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
    return nowCard({
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
    brain.record,
    brain.decision,
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
