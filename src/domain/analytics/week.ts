import { addDays, startOfWeek, type WeekStartsOn } from '@/lib/dates';
import type { Profile, RoutineDay, RoutineExercise } from '../models/schemas';
import {
  isAlive,
  sessionDurationMinutes,
  sessionsBetween,
  workingSetCount,
  type Session,
} from './sessions';

export interface RingValue {
  value: number;
  /** Null when there is nothing to measure against: the ring is then not shown. */
  target: number | null;
  /** Where the target comes from, for the explanation under the rings. */
  source: 'profile' | 'routine' | null;
}

export interface WeekRings {
  weekStart: Date;
  sessions: RingValue;
  sets: RingValue;
  minutes: RingValue;
}

/** Working sets the routine plans in one week: each day's target sets times its weekdays. */
export function plannedWeeklySets(days: RoutineDay[], slots: RoutineExercise[]): number | null {
  if (days.length === 0) return null;
  let total = 0;
  for (const day of days) {
    const perSession = slots
      .filter((s) => isAlive(s) && s.routineDayId === day.id)
      .reduce((n, s) => n + s.targetSets, 0);
    total += perSession * day.weekdays.length;
  }
  return total > 0 ? total : null;
}

/**
 * This calendar week against targets the person set: sessions against the days they said they
 * train (or the routine's planned days), working sets against the routine's planned sets,
 * minutes against days × session length. No target, no ring: nothing is invented.
 */
export function weekRings(
  sessions: Session[],
  profile: Profile | null,
  days: RoutineDay[],
  slots: RoutineExercise[],
  now: Date,
  weekStartsOn: WeekStartsOn,
): WeekRings {
  const weekStart = startOfWeek(now, weekStartsOn);
  const week = sessionsBetween(sessions, weekStart, addDays(weekStart, 7));
  const plannedDays = days.reduce((n, d) => n + d.weekdays.length, 0) || null;
  const profileDays = profile?.trainingDays ?? null;
  const sessionTarget = profileDays ?? plannedDays;
  const minutesTarget =
    profileDays && profile?.sessionMinutes ? profileDays * profile.sessionMinutes : null;
  const setsTarget = plannedWeeklySets(days, slots);
  return {
    weekStart,
    sessions: {
      value: week.length,
      target: sessionTarget,
      source: profileDays ? 'profile' : plannedDays ? 'routine' : null,
    },
    sets: {
      value: week.reduce((n, s) => n + workingSetCount(s), 0),
      target: setsTarget,
      source: setsTarget ? 'routine' : null,
    },
    minutes: {
      value: Math.round(week.reduce((n, s) => n + (sessionDurationMinutes(s) ?? 0), 0)),
      target: minutesTarget,
      source: minutesTarget ? 'profile' : null,
    },
  };
}

/**
 * Weeks in a row that met the weekly session target (or had at least one session when there
 * is no target), counting back from last week. The current week joins the streak once it
 * meets the target, so a streak never breaks mid-week.
 */
export function weeklyStreak(
  sessions: Session[],
  target: number | null,
  now: Date,
  weekStartsOn: WeekStartsOn,
): { weeks: number; currentWeekMet: boolean } {
  const need = Math.max(1, target ?? 1);
  const current = startOfWeek(now, weekStartsOn);
  const countIn = (start: Date) => sessionsBetween(sessions, start, addDays(start, 7)).length;
  const currentWeekMet = countIn(current) >= need;
  let weeks = 0;
  const first = sessions[0]?.date;
  for (
    let start = addDays(current, -7);
    first && addDays(start, 7) > first;
    start = addDays(start, -7)
  ) {
    if (countIn(start) >= need) weeks++;
    else break;
  }
  return { weeks: weeks + (currentWeekMet ? 1 : 0), currentWeekMet };
}

/**
 * The day after the last one done in this routine, in routine order: what comes next in the
 * cycle, whatever the weekday. Null before the first session of the routine.
 */
export function cycleNext(sessions: Session[], days: RoutineDay[]): RoutineDay | null {
  if (days.length === 0) return null;
  const ids = new Set(days.map((d) => d.id));
  const last = [...sessions]
    .reverse()
    .find((s) => s.workout.routineDayId && ids.has(s.workout.routineDayId));
  if (!last) return null;
  const index = days.findIndex((d) => d.id === last.workout.routineDayId);
  return days[(index + 1) % days.length] ?? null;
}

/**
 * Average training days a week over the last 4 weeks, from logged workouts. Null until the
 * history covers all 4 weeks, so a new user's first week is not read as their routine.
 */
export function loggedDaysPerWeek(sessions: Session[], now: Date): number | null {
  const first = sessions[0];
  const start = addDays(now, -28);
  if (!first || first.date > start) return null;
  const days = new Set(
    sessions.filter((s) => s.date > start && s.date <= now).map((s) => s.date.toDateString()),
  );
  return days.size / 4;
}
