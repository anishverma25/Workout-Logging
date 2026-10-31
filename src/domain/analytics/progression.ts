import type {
  Exercise,
  Experience,
  TargetSnapshot,
  TrackingType,
  WorkoutSet,
} from '../models/schemas';
import type { Session } from './sessions';

export interface ProgressionSuggestion {
  /** exerciseId:workoutId, so a dismissal applies to this session's result only. */
  id: string;
  exerciseId: string;
  exerciseName: string;
  workoutId: string;
  date: Date;
  target: TargetSnapshot;
  /** The working sets the suggestion is based on, in order. */
  sets: { weightKg: number; reps: number; rir: number | null }[];
  /**
   * met: effort was logged and stayed at or above the target RIR (within half a rep).
   * unknown: no RIR was logged, so effort cannot be checked from the record.
   */
  effort: 'met' | 'unknown';
}

/** Half a rep of slack, because RIR is a self-estimate. */
const RIR_TOLERANCE = 0.5;

/**
 * Transparent double-progression check, based only on the most recent session of each exercise
 * that had a routine target:
 * 1. at least the target number of working sets were completed,
 * 2. every one of those sets reached the top of the rep range,
 * 3. effort stayed at the target: logged RIR not below target RIR (minus 0.5).
 *    Sets reaching the top of the range by grinding past the target do not qualify.
 * Only load-tracked exercises qualify, because the suggestion is about load.
 * It never changes the routine; the person decides.
 */
export function progressionSuggestions(
  sessions: Session[],
  exercises: Exercise[],
  style: ProgressionStyle = 'double',
): ProgressionSuggestion[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const latest = new Map<string, { session: Session; index: number }>();
  sessions.forEach((session) => {
    session.exercises.forEach((ex, index) => {
      if (ex.sets.some((s) => s.completedAt !== null && s.setType === 'working')) {
        latest.set(ex.workoutExercise.exerciseId, { session, index });
      }
    });
  });

  const out: ProgressionSuggestion[] = [];
  for (const [exerciseId, { session, index }] of latest) {
    const ex = session.exercises[index]!;
    const target = ex.workoutExercise.target;
    const exercise = byId.get(exerciseId);
    if (!target || !exercise) continue;
    const check = checkProgression(target, ex.sets, exercise.trackingType, style);
    if (!check) continue;
    const { working, effort } = check;

    out.push({
      id: `${exerciseId}:${session.workout.id}`,
      exerciseId,
      exerciseName: ex.workoutExercise.exerciseName,
      workoutId: session.workout.id,
      date: session.date,
      target,
      sets: working.map((s) => ({ weightKg: s.weightKg!, reps: s.reps!, rir: s.rir })),
      effort,
    });
  }
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * The rule itself, for one exercise's sets in one session. Returns null when the sets do not
 * qualify. Shared by the Progress page and the workout logger, so both always agree.
 */
export function checkProgression(
  target: TargetSnapshot,
  sets: WorkoutSet[],
  tracking: TrackingType,
  /** linear: add load once every set reaches the bottom of the range (beginners). */
  style: ProgressionStyle = 'double',
): { working: WorkoutSet[]; effort: ProgressionSuggestion['effort'] } | null {
  if (tracking !== 'weight_reps' && tracking !== 'weighted_bodyweight') return null;
  const working = sets
    .filter((s) => s.completedAt !== null && s.setType === 'working')
    .slice(0, target.sets);
  if (working.length < target.sets) return null;
  const needed = style === 'linear' ? target.repMin : target.repMax;
  if (working.some((s) => s.reps === null || s.reps < needed || s.weightKg === null)) {
    return null;
  }
  if (tracking === 'weight_reps' && working.some((s) => (s.weightKg ?? 0) <= 0)) return null;
  let effort: ProgressionSuggestion['effort'] = 'met';
  if (target.rir !== null) {
    const logged = working.filter((s) => s.rir !== null);
    if (logged.some((s) => s.rir! < target.rir! - RIR_TOLERANCE)) return null;
    if (logged.length === 0) effort = 'unknown';
  }
  return { working, effort };
}

/**
 * How load goes up, by experience. Beginners progress linearly: once every set reaches the
 * planned reps, add weight next session. Intermediate and advanced lifters use double
 * progression: first reach the top of the rep range in every set, then add weight and start
 * again from the bottom of the range.
 */
export type ProgressionStyle = 'linear' | 'double';

export const progressionStyle = (experience: Experience | null | undefined): ProgressionStyle =>
  experience === 'beginner' ? 'linear' : 'double';

const LOWER_BODY = new Set(['quads', 'hamstrings', 'glutes']);

/**
 * The smallest sensible jump in load, in the display unit: 5 kg (10 lb) on lower-body barbell
 * lifts for beginners, otherwise 2.5 kg (5 lb), the usual smallest plate pair or dumbbell step.
 */
export function loadIncrement(
  exercise: Pick<Exercise, 'equipment' | 'primaryMuscle'> | undefined,
  experience: Experience | null | undefined,
  unit: 'kg' | 'lb',
): number {
  const big =
    experience === 'beginner' &&
    exercise?.equipment === 'barbell' &&
    LOWER_BODY.has(exercise.primaryMuscle);
  if (unit === 'lb') return big ? 10 : 5;
  return big ? 5 : 2.5;
}
