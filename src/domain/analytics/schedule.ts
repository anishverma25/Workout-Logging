import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  startOfDay,
  startOfWeek,
  type WeekStartsOn,
} from '@/lib/dates';
import type { Routine, RoutineDay } from '../models/schemas';
import { isAlive, type Session } from './sessions';

export function activeRoutine(routines: Routine[]): Routine | null {
  return routines.find((r) => isAlive(r) && r.isActive) ?? null;
}

export function daysForRoutine(routine: Routine | null, days: RoutineDay[]): RoutineDay[] {
  if (!routine) return [];
  return days
    .filter((d) => isAlive(d) && d.routineId === routine.id)
    .sort((a, b) => a.order - b.order);
}

/** The routine day planned for a given date, if any. */
export function plannedDayOn(date: Date, days: RoutineDay[]): RoutineDay | null {
  return days.find((d) => d.weekdays.includes(date.getDay())) ?? null;
}

export function nextPlannedDay(
  from: Date,
  days: RoutineDay[],
): { day: RoutineDay; date: Date } | null {
  if (days.length === 0) return null;
  for (let i = 1; i <= 7; i++) {
    const date = addDays(startOfDay(from), i);
    const day = plannedDayOn(date, days);
    if (day) return { day, date };
  }
  return null;
}

export type DayState = 'completed' | 'missed' | 'planned' | 'rest' | 'extra';

export interface DayStatus {
  date: Date;
  isToday: boolean;
  state: DayState;
  plannedDay: RoutineDay | null;
  sessions: Session[];
}

/**
 * Status of each calendar day in [start, start + count).
 * completed: a workout was logged on a planned day. extra: logged on an unplanned day.
 * missed: planned, in the past, nothing logged. planned: today or later, not yet done.
 * Nothing is planned before `since` (when the routine was created), so a routine set up today
 * does not show the days before it as missed.
 */
export function dayStatuses(
  sessions: Session[],
  days: RoutineDay[],
  start: Date,
  count: number,
  now: Date,
  since: Date | null = null,
): DayStatus[] {
  const from = since ? startOfDay(since) : null;
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(startOfDay(start), i);
    const daySessions = sessions.filter((s) => isSameDay(s.date, date));
    const plannedDay = from && date < from ? null : plannedDayOn(date, days);
    const offset = differenceInCalendarDays(date, now);
    let state: DayState;
    if (daySessions.length > 0) state = plannedDay ? 'completed' : 'extra';
    else if (!plannedDay) state = 'rest';
    else state = offset < 0 ? 'missed' : 'planned';
    return { date, isToday: offset === 0, state, plannedDay, sessions: daySessions };
  });
}

export interface Adherence {
  planned: number;
  completed: number;
  /** Fraction in [0, 1], or null when nothing was planned (no meaningful denominator). */
  rate: number | null;
}

/**
 * Adherence = completed planned sessions / planned sessions, over days that have already happened.
 * Today counts only once it has a logged workout, so an evening session is not "missed" at noon.
 * A routine workout logged on a different day than planned still counts toward completion,
 * capped at the number planned. Days before `since` (the routine's creation) are not planned.
 */
export function adherence(
  sessions: Session[],
  days: RoutineDay[],
  routineId: string | null,
  start: Date,
  end: Date,
  now: Date,
  since: Date | null = null,
): Adherence {
  if (!routineId || days.length === 0) return { planned: 0, completed: 0, rate: null };
  const today = startOfDay(now);
  let planned = 0;
  const from = since ? startOfDay(since) : null;
  for (let d = startOfDay(from && from > start ? from : start); d < end; d = addDays(d, 1)) {
    if (!plannedDayOn(d, days)) continue;
    if (d < today) planned++;
    else if (
      isSameDay(d, today) &&
      sessions.some((s) => isSameDay(s.date, today) && s.workout.routineId === routineId)
    )
      planned++;
  }
  const done = sessions.filter(
    (s) => s.date >= start && s.date < end && s.workout.routineId === routineId,
  ).length;
  const completed = Math.min(done, planned);
  return { planned, completed, rate: planned > 0 ? completed / planned : null };
}

export interface WeekCount {
  weekStart: Date;
  sessions: number;
}

/** Sessions per calendar week for the last `weeks` weeks, oldest first, current week last. */
export function weeklySessionCounts(
  sessions: Session[],
  weeks: number,
  now: Date,
  weekStartsOn: WeekStartsOn,
): WeekCount[] {
  const current = startOfWeek(now, weekStartsOn);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(current, -7 * (weeks - 1 - i));
    const weekEnd = addDays(weekStart, 7);
    return {
      weekStart,
      sessions: sessions.filter((s) => s.date >= weekStart && s.date < weekEnd).length,
    };
  });
}
