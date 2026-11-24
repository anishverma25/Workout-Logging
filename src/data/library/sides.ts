import type { Exercise, TrackingType, WorkoutSet } from '@/domain/models/schemas';
import { EACH_SIDE_EXERCISE_IDS, EACH_SIDE_SINCE } from './exercises';

/** Tracking types counted in reps, the only ones that can be logged for each side. */
const REP_TRACKING: ReadonlySet<TrackingType> = new Set([
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'assisted_bodyweight',
]);

/** Whether this exercise could be logged with the left and right side apart. */
export function canLogBySide(exercise: Pick<Exercise, 'trackingType'> | undefined): boolean {
  return !!exercise && REP_TRACKING.has(exercise.trackingType);
}

/**
 * Whether reps are logged for each side: the person's choice for this exercise in this workout
 * or routine when they made one, else on for the library's one-arm and one-leg exercises. An
 * exercise that became per side later stays both sides together in workouts made before that
 * (`createdAt` of the workout exercise), so old logs keep their meaning.
 */
export function logsBySide(
  choice: boolean | null | undefined,
  exercise: Pick<Exercise, 'id' | 'trackingType'> | undefined,
  createdAt?: string,
  /** Sets of this exercise in this workout, to see how they were logged. */
  sets?: readonly Pick<WorkoutSet, 'completedAt' | 'deletedAt' | 'repsLeft' | 'repsRight'>[],
): boolean {
  if (!canLogBySide(exercise)) return false;
  if (choice !== null && choice !== undefined) return choice;
  if (!EACH_SIDE_EXERCISE_IDS.has(exercise!.id)) return false;
  const since = EACH_SIDE_SINCE.get(exercise!.id);
  if (!since) return true;
  if (createdAt && createdAt < since) return false;
  // Logged with both sides together already (by an older app version): keep it that way.
  return !(sets ?? []).some(
    (s) =>
      s.completedAt !== null &&
      s.deletedAt === null &&
      (s.repsLeft ?? null) === null &&
      (s.repsRight ?? null) === null,
  );
}
