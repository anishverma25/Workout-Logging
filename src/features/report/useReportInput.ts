import { useMemo } from 'react';
import { useTrainingData } from '@/data/hooks';
import { activeRoutine, daysForRoutine } from '@/domain/analytics/schedule';
import { buildSessions, isAlive } from '@/domain/analytics/sessions';
import { weeklyReport, type Action, type WeeklyInput, type WeeklyReport } from '@/domain/analytics/weekly';
import { targetMode } from '@/domain/nutrition/targets';
import { addDays, startOfDay } from '@/lib/dates';
import { useFoodContextFrom } from '../food/useFoodContext';

/**
 * Planned sessions in the week from the active routine's weekdays, from the day the routine was
 * made (a new routine has no missed days). Null without a routine or weekdays.
 */
export function plannedInWeek(
  routine: { createdAt: string } | null,
  days: { weekdays: number[] }[],
  weekStart: Date,
): number | null {
  if (!routine || !days.some((d) => d.weekdays.length)) return null;
  const made = startOfDay(new Date(routine.createdAt));
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    if (day >= made && days.some((d) => d.weekdays.includes(day.getDay()))) n++;
  }
  return n;
}

/**
 * The person's report for a week, calculated on the phone from their own logs. Null while the
 * data loads.
 */
export function useWeeklyReport(weekStart: Date | null, now: Date, previousActions: Action[] | null) {
  const training = useTrainingData();
  const food = useFoodContextFrom(now, training);
  const data = training.data;
  const ready = food.status === 'success' && !!data;
  // The report reads the clock only to date itself; recomputing every minute is not needed.
  const minute = Math.floor(now.getTime() / 60_000);

  const report = useMemo<WeeklyReport | null>(() => {
    if (!ready || !data || !weekStart) return null;
    const routine = activeRoutine(data.routines);
    const input: WeeklyInput = {
      weekStart,
      now: new Date(minute * 60_000),
      sessions: buildSessions(data),
      exercises: data.exercises,
      logs: food.logs.filter(isAlive),
      targets: { kcal: food.targets.kcal ?? null, proteinG: food.targets.proteinG ?? null },
      ownTargets: targetMode(data.profile) === 'own',
      goal: data.profile?.goal ?? null,
      weights: data.bodyWeights.filter(isAlive).map((w) => ({ measuredAt: w.measuredAt, weightKg: w.weightKg })),
      measurements: data.measurements.filter(isAlive),
      goals: data.goals.filter(isAlive),
      planned: plannedInWeek(routine, daysForRoutine(routine, data.routineDays), weekStart),
      previousActions,
    };
    return weeklyReport(input);
  }, [ready, data, weekStart, minute, food.logs, food.targets.kcal, food.targets.proteinG, previousActions]);

  return {
    status: food.status === 'error' ? ('error' as const) : ready ? ('success' as const) : ('loading' as const),
    report,
    sessions: data ? buildSessions(data).length : 0,
    foodDays: new Set(food.logs.filter(isAlive).map((l) => l.date)).size,
  };
}
