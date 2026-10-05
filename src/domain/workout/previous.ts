import type { SetType, Workout, WorkoutExercise, WorkoutSet } from '../models/schemas';

/** What was logged for one exercise in the most recent earlier workout that included it. */
export interface PreviousPerformance {
  workout: Workout;
  workoutExercise: WorkoutExercise;
  /** Completed sets in logged order. */
  sets: WorkoutSet[];
}

export interface WorkoutLookup {
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: WorkoutSet[];
}

/**
 * The last completed workout before `before` (exclusive) that has completed sets for `exerciseId`.
 * Pass the current workout's start time so a workout never shows itself as "last time".
 */
export function previousPerformance(
  data: WorkoutLookup,
  exerciseId: string,
  before: string,
  excludeWorkoutId?: string,
): PreviousPerformance | null {
  const candidates = data.workouts
    .filter(
      (w) =>
        w.deletedAt === null &&
        w.status === 'completed' &&
        w.id !== excludeWorkoutId &&
        w.startedAt < before,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (candidates.length === 0) return null;

  const exercisesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const we of data.workoutExercises) {
    if (we.deletedAt !== null || we.exerciseId !== exerciseId) continue;
    const list = exercisesByWorkout.get(we.workoutId) ?? [];
    list.push(we);
    exercisesByWorkout.set(we.workoutId, list);
  }
  const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();
  for (const s of data.sets) {
    if (s.deletedAt !== null || s.completedAt === null || s.exerciseId !== exerciseId) continue;
    const list = setsByWorkoutExercise.get(s.workoutExerciseId) ?? [];
    list.push(s);
    setsByWorkoutExercise.set(s.workoutExerciseId, list);
  }

  for (const workout of candidates) {
    for (const we of exercisesByWorkout.get(workout.id) ?? []) {
      const sets = (setsByWorkoutExercise.get(we.id) ?? []).sort((a, b) => a.order - b.order);
      if (sets.length > 0) return { workout, workoutExercise: we, sets };
    }
  }
  return null;
}

/**
 * The previous set that lines up with a set in today's list: the same position among sets
 * of the same type. The 2nd working set today is compared with the 2nd working set last time.
 * Falls back to the last set of that type, so an extra set still gets a sensible suggestion.
 */
export function matchingPreviousSet(
  previous: WorkoutSet[],
  today: Pick<WorkoutSet, 'id' | 'setType'>[],
  setId: string,
): WorkoutSet | null {
  const target = today.find((s) => s.id === setId);
  if (!target) return null;
  const index = today.filter((s) => s.setType === target.setType).findIndex((s) => s.id === setId);
  const sameType = previous.filter((s) => s.setType === target.setType);
  // A back-off or drop set with no matching history gets no guess: none beats a wrong one.
  return sameType[index] ?? sameType[sameType.length - 1] ?? null;
}

/** Values a set would be completed with when the user taps done without typing. */
export interface SetSuggestion {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

export function suggestionFrom(set: WorkoutSet | null): SetSuggestion | null {
  if (!set) return null;
  return {
    weightKg: set.weightKg,
    reps: set.reps,
    durationSec: set.durationSec,
    distanceM: set.distanceM,
  };
}

/**
 * What tapping done on an empty set would log. Last time's matching set comes first. With no
 * history, the set just above it today (same type) is used, since most people repeat a weight.
 */
export function suggestFor(
  previous: WorkoutSet[],
  today: WorkoutSet[],
  setId: string,
): SetSuggestion | null {
  const fromHistory = suggestionFrom(matchingPreviousSet(previous, today, setId));
  if (fromHistory) return fromHistory;
  const target = today.find((s) => s.id === setId);
  if (!target) return null;
  const above = today
    .filter((s) => s.order < target.order && s.setType === target.setType && s.completedAt !== null)
    .at(-1);
  return suggestionFrom(above ?? null);
}

/** Set types in the order they normally appear. */
export const SET_TYPE_ORDER: SetType[] = ['warmup', 'working', 'backoff', 'drop'];
