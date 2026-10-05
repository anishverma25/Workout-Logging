import type { Exercise, TargetSnapshot, TrackingType, WorkoutSet } from '../models/schemas';
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
    const check = checkProgression(target, ex.sets, exercise.trackingType);
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
): { working: WorkoutSet[]; effort: ProgressionSuggestion['effort'] } | null {
  if (tracking !== 'weight_reps' && tracking !== 'weighted_bodyweight') return null;
  const working = sets
    .filter((s) => s.completedAt !== null && s.setType === 'working')
    .slice(0, target.sets);
  if (working.length < target.sets) return null;
  if (working.some((s) => s.reps === null || s.reps < target.repMax || s.weightKg === null)) {
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
