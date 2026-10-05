import { addDays, startOfDay, startOfWeek, type WeekStartsOn } from '@/lib/dates';
import type { Exercise, MuscleGroup } from '../models/schemas';
import { performanceFor } from './performance';
import { detectPersonalRecords, type PersonalRecord } from './prs';
import {
  buildSessions,
  isWorkingSet,
  sessionDurationMinutes,
  workingSetCount,
  type Session,
  type TrainingData,
} from './sessions';
import { sessionVolumeLoad } from './volume';

export type HistoryRange = '7d' | '30d' | '90d' | 'all';

export const RANGE_DAYS: Record<Exclude<HistoryRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export interface HistoryFilters {
  range: HistoryRange;
  /** Workout name, for example "Push". Names are what people recognise, not routine ids. */
  workoutName: string | null;
  exerciseId: string | null;
  muscle: MuscleGroup | null;
}

export const NO_HISTORY_FILTERS: HistoryFilters = {
  range: 'all',
  workoutName: null,
  exerciseId: null,
  muscle: null,
};

export type Highlight =
  | { kind: 'pr'; record: PersonalRecord }
  | { kind: 'top_set'; exerciseName: string; weightKg: number; reps: number }
  | { kind: 'none' };

export interface HistoryEntry {
  session: Session;
  minutes: number | null;
  exerciseNames: string[];
  workingSets: number;
  volumeKg: number;
  prs: PersonalRecord[];
  /** Exercises with at least one record in this workout. */
  prExercises: number;
  highlight: Highlight;
}

/** The first record by importance, otherwise the heaviest top set of a compound lift. */
function highlightFor(
  session: Session,
  prs: PersonalRecord[],
  exercises: Map<string, Exercise>,
): Highlight {
  // The headline record: big free-weight compounds first, then actual load before estimates.
  const order = { load: 0, e1rm: 1, reps: 2, duration: 3, distance: 3 } as const;
  const liftRank = (id: string) => {
    const e = exercises.get(id);
    if (!e) return 9;
    const base = e.category === 'compound' ? 0 : 3;
    return base + (e.equipment === 'barbell' ? 0 : e.equipment === 'dumbbell' ? 1 : 2);
  };
  const pr = [...prs].sort(
    (a, b) =>
      liftRank(a.exerciseId) - liftRank(b.exerciseId) ||
      order[a.type] - order[b.type] ||
      b.value - a.value,
  )[0];
  if (pr) return { kind: 'pr', record: pr };
  // Machine loads are not comparable with barbell loads, so free-weight compounds win first.
  const rank = (e: Exercise) =>
    e.equipment === 'barbell' ? 0 : e.equipment === 'dumbbell' ? 1 : 2;
  let best: {
    exerciseName: string;
    weightKg: number;
    reps: number;
    score: number;
    rank: number;
  } | null = null;
  for (const ex of session.exercises) {
    const exercise = exercises.get(ex.workoutExercise.exerciseId);
    if (exercise?.category !== 'compound' || exercise.trackingType !== 'weight_reps') continue;
    const perf = performanceFor(exercise, exercise.id, session.workout.id, session.date, ex.sets);
    const set = perf.bestE1rmSet;
    if (!set || perf.bestE1rm === null) continue;
    const r = rank(exercise);
    if (!best || r < best.rank || (r === best.rank && perf.bestE1rm > best.score)) {
      best = {
        exerciseName: ex.workoutExercise.exerciseName,
        weightKg: set.weightKg!,
        reps: set.reps!,
        score: perf.bestE1rm,
        rank: r,
      };
    }
  }
  if (best) {
    return {
      kind: 'top_set',
      exerciseName: best.exerciseName,
      weightKg: best.weightKg,
      reps: best.reps,
    };
  }
  return { kind: 'none' };
}

/** Every finished workout, newest first, with what makes it worth a glance. */
export function historyEntries(data: TrainingData): HistoryEntry[] {
  const sessions = buildSessions(data);
  const records = detectPersonalRecords(sessions, data.exercises);
  const byWorkout = new Map<string, PersonalRecord[]>();
  for (const r of records) byWorkout.set(r.workoutId, [...(byWorkout.get(r.workoutId) ?? []), r]);
  const exercises = new Map(data.exercises.map((e) => [e.id, e]));

  return [...sessions].reverse().map((session) => {
    const prs = byWorkout.get(session.workout.id) ?? [];
    return {
      session,
      minutes: sessionDurationMinutes(session),
      exerciseNames: session.exercises
        .filter((e) => e.sets.some((s) => s.completedAt !== null))
        .map((e) => e.workoutExercise.exerciseName),
      workingSets: workingSetCount(session),
      volumeKg: sessionVolumeLoad(session),
      prs,
      prExercises: new Set(prs.map((p) => p.exerciseId)).size,
      highlight: highlightFor(session, prs, exercises),
    };
  });
}

export function filterHistory(
  entries: HistoryEntry[],
  filters: HistoryFilters,
  exercises: Exercise[],
  now: Date,
): HistoryEntry[] {
  const muscleOf = new Map(exercises.map((e) => [e.id, e]));
  const since =
    filters.range === 'all' ? null : addDays(startOfDay(now), -(RANGE_DAYS[filters.range] - 1));
  return entries.filter((e) => {
    if (since && e.session.date < since) return false;
    if (filters.workoutName && e.session.workout.name !== filters.workoutName) return false;
    const done = e.session.exercises.filter((x) => x.sets.some(isWorkingSet));
    if (
      filters.exerciseId &&
      !done.some((x) => x.workoutExercise.exerciseId === filters.exerciseId)
    ) {
      return false;
    }
    if (filters.muscle) {
      const hits = done.some((x) => {
        const ex = muscleOf.get(x.workoutExercise.exerciseId);
        return (
          ex &&
          (ex.primaryMuscle === filters.muscle || ex.secondaryMuscles.includes(filters.muscle!))
        );
      });
      if (!hits) return false;
    }
    return true;
  });
}

export interface HistoryFilterOptions {
  workoutNames: { name: string; count: number }[];
  exercises: { id: string; name: string; count: number }[];
}

/** Only options that exist in the user's history, most used first. */
export function historyFilterOptions(entries: HistoryEntry[]): HistoryFilterOptions {
  const names = new Map<string, number>();
  const exercises = new Map<string, { name: string; count: number }>();
  for (const e of entries) {
    names.set(e.session.workout.name, (names.get(e.session.workout.name) ?? 0) + 1);
    for (const x of e.session.exercises) {
      if (!x.sets.some(isWorkingSet)) continue;
      const id = x.workoutExercise.exerciseId;
      const cur = exercises.get(id) ?? { name: x.workoutExercise.exerciseName, count: 0 };
      cur.count++;
      exercises.set(id, cur);
    }
  }
  return {
    workoutNames: [...names.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    exercises: [...exercises.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

export interface HistoryWeek {
  weekStart: Date;
  entries: HistoryEntry[];
  workingSets: number;
  volumeKg: number;
}

/** Groups entries (newest first) into calendar weeks for the timeline. */
export function groupByWeek(entries: HistoryEntry[], weekStartsOn: WeekStartsOn): HistoryWeek[] {
  const weeks: HistoryWeek[] = [];
  for (const e of entries) {
    const weekStart = startOfWeek(e.session.date, weekStartsOn);
    let week = weeks[weeks.length - 1];
    if (!week || week.weekStart.getTime() !== weekStart.getTime()) {
      week = { weekStart, entries: [], workingSets: 0, volumeKg: 0 };
      weeks.push(week);
    }
    week.entries.push(e);
    week.workingSets += e.workingSets;
    week.volumeKg += e.volumeKg;
  }
  return weeks;
}
