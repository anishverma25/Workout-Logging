import type { Exercise, WorkoutSet } from '../models/schemas';
import { isLoadEligible, type Session } from './sessions';

/**
 * Volume load = sum of (load x reps) over completed, non-warm-up sets of
 * load-tracked exercises. For per-hand exercises (dumbbells logged per hand)
 * both sides are counted. Volume load is a tracking metric, not a measure of muscle growth.
 */
export function setVolumeLoad(set: WorkoutSet, exercise: Exercise | undefined): number {
  if (!isLoadEligible(set, exercise)) return 0;
  // Logged per side: each side moved the load for its own reps.
  if (isSideSet(set)) return (set.weightKg ?? 0) * repsDone(set);
  const sides = exercise?.loadMode === 'per_hand' ? 2 : 1;
  return (set.weightKg ?? 0) * (set.reps ?? 0) * sides;
}

/** A set with reps logged for the left and right side apart. */
export function isSideSet(set: Pick<WorkoutSet, 'repsLeft' | 'repsRight'>): boolean {
  return (set.repsLeft ?? null) !== null || (set.repsRight ?? null) !== null;
}

/** Every rep done in a set: both sides added up for a set logged per side. */
export function repsDone(set: Pick<WorkoutSet, 'reps' | 'repsLeft' | 'repsRight'>): number {
  if (isSideSet(set)) return (set.repsLeft ?? 0) + (set.repsRight ?? 0);
  return set.reps ?? 0;
}

/**
 * The reps a per-side set counts as for strength (e1RM, records, suggestions): the weaker side,
 * or the only side logged.
 */
export function sideReps(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

export function sessionVolumeLoad(session: Session): number {
  let total = 0;
  for (const { exercise, sets } of session.exercises) {
    for (const set of sets) total += setVolumeLoad(set, exercise);
  }
  return total;
}

export function totalVolumeLoad(sessions: Session[]): number {
  return sessions.reduce((sum, s) => sum + sessionVolumeLoad(s), 0);
}
