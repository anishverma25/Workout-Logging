import type { Exercise, WorkoutSet } from '../models/schemas';
import { performanceByExercise, performanceFor } from './performance';
import type { PrType } from './prs';
import type { Session } from './sessions';

/**
 * Live medals: while a workout is running, does the set just ticked off beat everything this
 * exercise has done before? The same rules as detectPersonalRecords (the medals saved with the
 * workout), applied to the sets so far. A first-ever session sets the baseline and wins nothing.
 */

export interface Bests {
  load: number | null;
  e1rm: number | null;
  setVolume: number | null;
  sessionVolume: number | null;
  reps: number | null;
  sessionReps: number | null;
  duration: number | null;
  distance: number | null;
}

const EPSILON = 0.01;

const empty = (): Bests => ({
  load: null,
  e1rm: null,
  setVolume: null,
  sessionVolume: null,
  reps: null,
  sessionReps: null,
  duration: null,
  distance: null,
});

const max = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.max(a, b);

/** All-time bests per exercise, from every session except the one in progress. */
export function bestsBefore(sessions: Session[], excludeWorkoutId: string): Map<string, Bests> {
  const out = new Map<string, Bests>();
  const done = sessions.filter((s) => s.workout.id !== excludeWorkoutId);
  for (const [exerciseId, history] of performanceByExercise(done)) {
    const b = empty();
    for (const p of history) {
      b.load = max(b.load, p.heaviestLoad);
      b.e1rm = max(b.e1rm, p.bestE1rm);
      b.setVolume = max(b.setVolume, p.bestSetVolume);
      b.sessionVolume = max(b.sessionVolume, p.sessionVolume);
      b.reps = max(b.reps, p.mostReps);
      b.sessionReps = max(b.sessionReps, p.sessionReps);
      b.duration = max(b.duration, p.longestDuration);
      b.distance = max(b.distance, p.longestDistance);
    }
    out.set(exerciseId, b);
  }
  return out;
}

export interface LiveMedal {
  type: PrType;
  value: number;
}

/**
 * The medals the newest set wins: each measure it beats, counting both the history before
 * this workout and this exercise's earlier sets today (so one record is announced once).
 */
export function medalsForSet(
  set: WorkoutSet,
  exercise: Exercise | undefined,
  /** This exercise's sets in the workout, the new one included, in any order. */
  sets: WorkoutSet[],
  before: Bests | undefined,
): LiveMedal[] {
  if (!before || !exercise) return [];
  const others = sets.filter((s) => s.id !== set.id && s.completedAt !== null);
  const earlier = performanceFor(exercise, exercise.id, '', new Date(0), others);
  const now = performanceFor(exercise, exercise.id, '', new Date(0), [...others, set]);
  const out: LiveMedal[] = [];
  const check = (
    type: PrType,
    history: number | null,
    soFar: number | null,
    withSet: number | null,
    strict = EPSILON,
  ) => {
    if (history === null || withSet === null) return;
    const bar = Math.max(history, soFar ?? -Infinity);
    if (withSet > bar + strict) out.push({ type, value: withSet });
  };
  check('load', before.load, earlier.heaviestLoad, now.heaviestLoad);
  check('e1rm', before.e1rm, earlier.bestE1rm, now.bestE1rm);
  check('set_volume', before.setVolume, earlier.bestSetVolume, now.bestSetVolume);
  // Session totals win once: on the set that takes the total past the old best.
  const crossed = (type: PrType, history: number | null, was: number | null, is: number | null) => {
    if (history === null || is === null) return;
    if ((was ?? 0) <= history + EPSILON && is > history + EPSILON) out.push({ type, value: is });
  };
  crossed('session_volume', before.sessionVolume, earlier.sessionVolume, now.sessionVolume);
  check('reps', before.reps, earlier.mostReps, now.mostReps, 0);
  crossed('session_reps', before.sessionReps, earlier.sessionReps, now.sessionReps);
  check('duration', before.duration, earlier.longestDuration, now.longestDuration, 0);
  check('distance', before.distance, earlier.longestDistance, now.longestDistance);
  return out;
}
