import type { Exercise, WorkoutSet } from '../models/schemas';
import { isLoadEligible, type Session } from './sessions';

/**
 * Volume load = sum of (load x reps) over completed, non-warm-up sets of
 * load-tracked exercises. For per-hand exercises (dumbbells logged per hand)
 * both sides are counted. Volume load is a tracking metric, not a measure of muscle growth.
 */
export function setVolumeLoad(set: WorkoutSet, exercise: Exercise | undefined): number {
  if (!isLoadEligible(set, exercise)) return 0;
  const sides = exercise?.loadMode === 'per_hand' ? 2 : 1;
  return (set.weightKg ?? 0) * (set.reps ?? 0) * sides;
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
