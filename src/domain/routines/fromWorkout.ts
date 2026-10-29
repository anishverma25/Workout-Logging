import type { Exercise, TargetSnapshot, WorkoutSet } from '../models/schemas';

/** Targets for one exercise of a routine, as the routine editor stores them. */
export interface SlotTargets {
  targetSets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
  restSeconds: number;
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/**
 * Routine targets from what was actually done in a workout (an empty workout someone wants to
 * repeat): as many sets as were done (warm-ups left out), the rep range they did, the effort
 * and rest it was planned with when there was a plan. Exercises not counted in reps (time,
 * distance, cardio) keep `fallback`, the editor's usual starting targets.
 */
export function targetsFromWorkout(
  sets: WorkoutSet[],
  exercise: Pick<Exercise, 'trackingType'> | undefined,
  planned: TargetSnapshot | null,
  fallback: SlotTargets,
): SlotTargets {
  const done = sets.filter((s) => s.completedAt !== null && s.deletedAt === null);
  const working = done.filter((s) => s.setType !== 'warmup');
  const counted = working.length > 0 ? working : done;
  const targetSets = clampInt(counted.length || planned?.sets || fallback.targetSets, 1, 20);
  const byReps =
    !exercise ||
    exercise.trackingType === 'weight_reps' ||
    exercise.trackingType === 'bodyweight_reps' ||
    exercise.trackingType === 'weighted_bodyweight' ||
    exercise.trackingType === 'assisted_bodyweight';
  const reps = counted.map((s) => s.reps).filter((r): r is number => r !== null && r > 0);
  let repMin = planned?.repMin ?? fallback.repMin;
  let repMax = planned?.repMax ?? fallback.repMax;
  if (byReps && reps.length > 0) {
    repMin = clampInt(Math.min(...reps), 1, 100);
    repMax = clampInt(Math.max(...reps), 1, 100);
  }
  if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
  return {
    targetSets,
    repMin,
    repMax,
    targetRir: planned ? planned.rir : fallback.targetRir,
    restSeconds: clampInt(planned?.rest ?? fallback.restSeconds, 0, 900),
  };
}
