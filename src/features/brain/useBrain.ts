import { useMemo } from 'react';
import { reportWindow } from '@/app/weeklyReport';
import { db } from '@/data/db';
import { useLiveData, usePreferences, useTrainingData } from '@/data/hooks';
import { SYSTEM_EXERCISE_KEYS, exerciseIdFor } from '@/data/library/exercises';
import {
  decisionsFrom,
  eventsFrom,
  lastDeloadFrom,
  ownsProtein,
  painsFrom,
  planItems,
  routineSlots,
  temporariesFrom,
} from '@/data/repositories/plan';
import { activeRoutine, daysForRoutine } from '@/domain/analytics/schedule';
import { buildSessions, isAlive } from '@/domain/analytics/sessions';
import { detectStalls } from '@/domain/analytics/stalls';
import { decideWeek, type DecideInput, type Decision } from '@/domain/brain/engine';
import { buildWeekFacts, foodDays, recoverySamples } from '@/domain/brain/facts';
import { responseModel, type ResponseModel } from '@/domain/brain/response';
import { longestSession, plannedMuscleSets } from '@/domain/brain/rewrite';
import type { PlanItem } from '@/domain/models/schemas';
import { addDays, toDateKey } from '@/lib/dates';
import { useFoodContextFrom } from '../food/useFoodContext';

/** How far back the brain reads: half a year is plenty to learn from and quick to compute. */
export const BRAIN_WEEKS = 26;

const KEY_BY_ID = new Map(SYSTEM_EXERCISE_KEYS.map((key) => [exerciseIdFor(key), key]));

export const usePlanItems = () => useLiveData<PlanItem[]>(() => planItems(db));

/**
 * The brain for the person who is signed in: their weeks of facts, what the model has learned,
 * and the decision for the week after the one whose report is open. Calculated on the phone
 * from their own logs; nothing here is saved until they say yes.
 */
export function useBrain(now: Date) {
  const training = useTrainingData();
  const food = useFoodContextFrom(now, training);
  const items = usePlanItems();
  const prefs = usePreferences();
  const data = training.data;
  const ready = food.status === 'success' && items.status === 'success' && !!data;
  // Recomputed when the hour changes, not every minute.
  const hour = Math.floor(now.getTime() / 3_600_000);

  const result = useMemo(() => {
    if (!ready || !data || !items.data) return null;
    const at = new Date(hour * 3_600_000);
    const win = reportWindow(at, prefs.weekStartsOn);
    const nextWeek = addDays(win.open, 7);
    const nextWeekStart = toDateKey(nextWeek);
    const sessions = buildSessions(data);
    const logs = food.logs.filter(isAlive);
    const weights = data.bodyWeights.filter(isAlive);
    const firstDates = [
      sessions[0]?.date,
      logs.length ? new Date(`${[...logs].sort((a, b) => a.date.localeCompare(b.date))[0]!.date}T12:00:00`) : undefined,
      weights.length
        ? new Date([...weights].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))[0]!.measuredAt)
        : undefined,
    ].filter((d): d is Date => !!d);
    const earliest = firstDates.length
      ? new Date(Math.min(...firstDates.map((d) => d.getTime())))
      : win.open;
    const floor = addDays(win.open, -7 * (BRAIN_WEEKS - 1));
    const from = earliest > floor ? earliest : floor;
    const until = addDays(win.open, 6);
    const inRange = sessions.filter((s) => s.date >= floor && s.date < nextWeek);
    const weeks = buildWeekFacts({
      sessions: inRange,
      food: foodDays(logs),
      weights: weights.map((w) => ({ measuredAt: w.measuredAt, weightKg: w.weightKg })),
      from: from > until ? until : from,
      to: until,
      weekStartsOn: prefs.weekStartsOn,
    });
    const energy = food.snapshot?.energy ?? null;
    const model = responseModel({
      weeks,
      recovery: recoverySamples(inRange),
      researchMaintenance: energy?.tdee ?? null,
    });

    const profile = data.profile;
    const routine = activeRoutine(data.routines);
    const days = daysForRoutine(routine, data.routineDays);
    const view = routineSlots(data.routineExercises, data.exercises, days);
    const decisions = decisionsFrom(items.data);
    const names = new Map(data.exercises.map((e) => [e.id, e.name]));
    const bodyGoal = data.goals
      .filter((g) => isAlive(g) && g.kind === 'body_weight' && !g.achievedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const input: DecideInput | null = profile
      ? {
          nextWeekStart,
          weeks,
          model,
          person: {
            goal: profile.goal,
            experience: profile.experience,
            weightKg: food.snapshot?.weightKg ?? null,
            bmrKcal: energy?.bmr ?? null,
            targetKg: bodyGoal?.targetValue ?? null,
            ownProtein: ownsProtein(profile, decisions),
          },
          plan: {
            kcal: food.targets.kcal ?? null,
            proteinG: food.targets.proteinG ?? null,
            muscleSets: plannedMuscleSets(view.slots, view.days),
            exerciseIds: [...new Set(view.slots.map((s) => s.exerciseId))],
            sessionMinutes: longestSession(view.slots),
          },
          events: eventsFrom(items.data, toDateKey(at)),
          pains: painsFrom(items.data),
          stalls: detectStalls(sessions, at, profile.experience, data.exercises).map((s) => ({
            exerciseId: s.exerciseId,
            cause: s.cause,
            variationId: s.facts.variationId,
          })),
          temporaries: temporariesFrom(items.data),
          lastDeload: lastDeloadFrom(items.data),
          exercise: {
            name: (id) => names.get(id) ?? 'Exercise',
            keyOf: (id) => KEY_BY_ID.get(id) ?? null,
            idOf: (key) => exerciseIdFor(key),
          },
        }
      : null;
    const decision: Decision | null = input ? decideWeek(input) : null;
    return {
      nextWeekStart,
      /** The week has started: it is this week's plan now. */
      started: at >= nextWeek,
      weeks,
      model,
      input,
      decision,
      record: decisions.find((d) => d.weekStart === nextWeekStart) ?? null,
      events: eventsFrom(items.data, toDateKey(at)),
      hasRoutine: !!routine,
    };
  }, [ready, data, items.data, hour, prefs.weekStartsOn, food.logs, food.snapshot, food.targets.kcal, food.targets.proteinG]);

  return {
    status:
      food.status === 'error' || items.status === 'error'
        ? ('error' as const)
        : ready
          ? ('success' as const)
          : ('loading' as const),
    ...(result ?? {
      nextWeekStart: null,
      started: false,
      weeks: [],
      model: null as ResponseModel | null,
      input: null,
      decision: null,
      record: null,
      events: [],
      hasRoutine: false,
    }),
  };
}

export type Brain = ReturnType<typeof useBrain>;
