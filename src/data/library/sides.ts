import type { Exercise, TrackingType } from '@/domain/models/schemas';
import { EACH_SIDE_EXERCISE_IDS } from './exercises';

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
 * or routine when they made one, else on for the library's one-arm and one-leg exercises.
 */
export function logsBySide(
  choice: boolean | null | undefined,
  exercise: Pick<Exercise, 'id' | 'trackingType'> | undefined,
): boolean {
  if (!canLogBySide(exercise)) return false;
  if (choice !== null && choice !== undefined) return choice;
  return EACH_SIDE_EXERCISE_IDS.has(exercise!.id);
}
