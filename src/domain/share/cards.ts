import { addDays, startOfDay, startOfWeek, type WeekStartsOn } from '@/lib/dates';
import { estimateOneRepMax, supportsE1rm } from '../analytics/e1rm';
import { detectPersonalRecords, type PersonalRecord } from '../analytics/prs';
import { median, restIntervals } from '../analytics/rest';
import {
  buildSessions,
  isWorkingSet,
  sessionDurationMinutes,
  type Session,
  type TrainingData,
} from '../analytics/sessions';
import { sessionVolumeLoad } from '../analytics/volume';

/**
 * What the story cards show, read from the person's own data. Pure: the drawing lives in
 * features/share. Every number is one the app already shows elsewhere.
 */

export interface CardPerson {
  /** First name, or null when the profile has none. */
  name: string | null;
}

export interface ReceiptLine {
  name: string;
  /** The best working set: heaviest, then most reps. Null for sets with no weight and reps. */
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

export interface WorkoutCard {
  workoutId: string;
  title: string;
  date: Date;
  /** This workout's number among all workouts so far (1 = the first). */
  number: number;
  minutes: number | null;
  workingSets: number;
  volumeKg: number;
  records: number;
  restSeconds: number | null;
  lines: ReceiptLine[];
}

export interface PrCard {
  exerciseName: string;
  date: Date;
  workoutTitle: string;
  kind: 'load' | 'e1rm' | 'reps';
  weightKg: number | null;
  reps: number | null;
  /** How much the record beat the last best by: kg for load and e1rm, reps for reps. */
  gain: number;
  e1rmKg: number | null;
  /**
   * Up to 5 records of this kind for the exercise, oldest first, the last being this one. With
   * fewer than 5, the first bar is where the lift started (`start`).
   */
  ladder: { date: Date; value: number; start?: boolean }[];
}

export interface StreakCard {
  /** Weeks in a row with at least one workout, up to the week of `now` (or the week before). */
  weeks: number;
  since: Date;
  workouts: number;
  records: number;
  hours: number;
  /** The last 12 weeks, 7 days each from the start of the week: trained or not, null = future. */
  grid: (boolean | null)[];
}

export interface Comparison {
  label: string;
  kg: number;
}

/** Rough everyday weights, light to heavy. Averages, rounded. */
export const COMPARISONS: Comparison[] = [
  { label: 'A washing machine', kg: 70 },
  { label: 'A motorbike', kg: 200 },
  { label: 'A grand piano', kg: 400 },
  { label: 'A small car', kg: 1000 },
  { label: 'A car', kg: 1500 },
  { label: 'A pickup truck', kg: 2500 },
  { label: 'An elephant', kg: 6000 },
  { label: 'A city bus', kg: 12000 },
  { label: 'A blue whale calf', kg: 25000 },
];

/** The heaviest thing lifted past, and the one before it, for the total-lifted card. */
export function compareVolume(kg: number): { beat: Comparison; smaller: Comparison | null } | null {
  let index = -1;
  COMPARISONS.forEach((c, i) => {
    if (kg >= c.kg) index = i;
  });
  if (index < 0) return null;
  return { beat: COMPARISONS[index]!, smaller: index > 0 ? COMPARISONS[index - 1]! : null };
}

function bestSet(session: Session['exercises'][number]): ReceiptLine {
  const done = session.sets.filter(isWorkingSet);
  // Heaviest weight, then most reps; for timed or distance work, the longest.
  const score = (s: (typeof done)[number]) =>
    (s.weightKg ?? 0) * 1e6 + (s.reps ?? 0) * 1e3 + (s.durationSec ?? 0) + (s.distanceM ?? 0) / 1e3;
  const best = done.reduce<(typeof done)[number] | undefined>(
    (b, s) => (!b || score(s) > score(b) ? s : b),
    undefined,
  );
  return {
    name: session.workoutExercise.exerciseName,
    weightKg: best?.weightKg ?? null,
    reps: best?.reps ?? null,
    durationSec: best?.durationSec ?? null,
    distanceM: best?.distanceM ?? null,
  };
}

export function workoutCard(data: TrainingData, workoutId: string): WorkoutCard | null {
  const sessions = buildSessions(data);
  const index = sessions.findIndex((s) => s.workout.id === workoutId);
  const session = sessions[index];
  if (!session) return null;
  const records = detectPersonalRecords(sessions, data.exercises).filter(
    (p) => p.workoutId === workoutId,
  );
  const all = session.exercises.flatMap((e) => e.sets);
  const setRests = [...restIntervals(all).values()]
    .filter((r) => r.kind === 'set')
    .map((r) => r.seconds);
  return {
    workoutId,
    title: session.workout.name,
    date: session.date,
    number: index + 1,
    minutes: sessionDurationMinutes(session),
    workingSets: all.filter(isWorkingSet).length,
    volumeKg: sessionVolumeLoad(session),
    records: new Set(records.map((r) => r.exerciseId)).size,
    restSeconds: setRests.length >= 2 ? median(setRests) : null,
    lines: session.exercises.filter((e) => e.sets.some(isWorkingSet)).map(bestSet),
  };
}

const PR_ORDER: PersonalRecord['type'][] = ['load', 'e1rm', 'reps'];

/** The record worth showing off from a workout: heaviest load first, then e1RM, then reps. */
export function prCard(data: TrainingData, workoutId: string, exerciseId?: string): PrCard | null {
  const sessions = buildSessions(data);
  const all = detectPersonalRecords(sessions, data.exercises);
  const here = all.filter(
    (p) => p.workoutId === workoutId && (!exerciseId || p.exerciseId === exerciseId),
  );
  let pick: PersonalRecord | undefined;
  for (const type of PR_ORDER) {
    const ofType = here.filter((p) => p.type === type);
    // The biggest jump of that kind, relative to where it was.
    pick = ofType.sort(
      (a, b) =>
        (b.value - b.previousBest) / Math.max(1, b.previousBest) -
        (a.value - a.previousBest) / Math.max(1, a.previousBest),
    )[0];
    if (pick) break;
  }
  if (!pick) return null;
  const exercise = data.exercises.find((e) => e.id === pick.exerciseId);
  const session = sessions.find((s) => s.workout.id === workoutId)!;
  const history = all
    .filter((p) => p.exerciseId === pick.exerciseId && p.type === pick.type && p.date <= pick.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const ladder: PrCard['ladder'] = history.slice(-5).map((p) => ({ date: p.date, value: p.value }));
  if (ladder.length < 5 && history[0])
    ladder.unshift({ date: history[0].date, value: history[0].previousBest, start: true });
  return {
    exerciseName: pick.exerciseName,
    date: pick.date,
    workoutTitle: session.workout.name,
    kind: pick.type as PrCard['kind'],
    weightKg: pick.weightKg,
    reps: pick.reps,
    gain: pick.value - pick.previousBest,
    e1rmKg:
      supportsE1rm(exercise) && pick.weightKg !== null && pick.reps !== null
        ? estimateOneRepMax(pick.weightKg, pick.reps, null)
        : null,
    ladder,
  };
}

/** Workouts with any record, newest first: the ones a PR card can be made from. */
export function workoutsWithRecords(data: TrainingData): Set<string> {
  const sessions = buildSessions(data);
  return new Set(
    detectPersonalRecords(sessions, data.exercises)
      .filter((p) => PR_ORDER.includes(p.type))
      .map((p) => p.workoutId),
  );
}

export function streakCard(
  data: TrainingData,
  now: Date,
  weekStartsOn: WeekStartsOn = 1,
): StreakCard | null {
  const sessions = buildSessions(data).filter((s) => s.date <= now);
  if (sessions.length === 0) return null;
  const weekOf = (d: Date) => startOfWeek(d, weekStartsOn).getTime();
  const trainedWeeks = new Set(sessions.map((s) => weekOf(s.date)));
  // This week counts once trained; an empty week so far does not break the streak yet.
  let cursor = startOfWeek(now, weekStartsOn);
  if (!trainedWeeks.has(cursor.getTime())) cursor = addDays(cursor, -7);
  let weeks = 0;
  let since = cursor;
  while (trainedWeeks.has(cursor.getTime())) {
    weeks++;
    since = cursor;
    cursor = addDays(cursor, -7);
  }
  if (weeks === 0) return null;
  const inStreak = sessions.filter((s) => s.date >= since);
  const records = detectPersonalRecords(buildSessions(data), data.exercises).filter(
    (p) => p.date >= since && p.date <= now,
  ).length;
  const minutes = inStreak.reduce((n, s) => n + (sessionDurationMinutes(s) ?? 0), 0);
  const days = new Set(sessions.map((s) => startOfDay(s.date).getTime()));
  const gridStart = addDays(startOfWeek(now, weekStartsOn), -77);
  const today = startOfDay(now).getTime();
  const grid = Array.from({ length: 84 }, (_, i) => {
    const day = addDays(gridStart, i);
    return day.getTime() > today ? null : days.has(day.getTime());
  });
  return {
    weeks,
    since,
    workouts: inStreak.length,
    records,
    hours: Math.round(minutes / 60),
    grid,
  };
}
