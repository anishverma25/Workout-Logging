import { differenceInCalendarDays } from '@/lib/dates';
import { MUSCLE_GROUPS, STRENGTH_MUSCLES, type MuscleGroup } from '../models/schemas';
import { isWorkingSet, type Session } from './sessions';

/**
 * Fractional sets (Evidence Corner, metric 3): a working set counts fully for its primary
 * muscle and half for each secondary muscle, the method that best predicted growth and
 * strength in Pelland et al. 2026.
 */
export const PRIMARY_SET_WEIGHT = 1;
export const SECONDARY_SET_WEIGHT = 0.5;
/**
 * Only hard sets count: within about 4 reps of failure (Baz-Valle et al. 2021). A set with no
 * effort logged is counted, since most people do not log it and working sets are usually hard.
 */
export const HARD_SET_MAX_RIR = 4;

export function isHardSet(set: { rir: number | null; rpe: number | null }): boolean {
  const rir = set.rir ?? (set.rpe !== null ? 10 - set.rpe : null);
  return rir === null || rir <= HARD_SET_MAX_RIR;
}

export interface MuscleWorkload {
  muscle: MuscleGroup;
  /** Working sets where this was the primary muscle. */
  direct: number;
  /** Working sets where it was a secondary muscle (counted at full number here). */
  indirect: number;
  /** direct × 1 + indirect × 0.5 */
  weighted: number;
}

/**
 * Hard working sets per muscle group over the given sessions, from exercise metadata.
 * Warm-ups, unfinished sets and sets logged with more than 4 reps in reserve are excluded. Every exercise type counts, including bodyweight
 * and timed work, because a hard set is a hard set whatever the load.
 */
export function muscleWorkload(sessions: Session[]): MuscleWorkload[] {
  const totals = new Map<MuscleGroup, { direct: number; indirect: number }>(
    MUSCLE_GROUPS.map((m) => [m, { direct: 0, indirect: 0 }]),
  );
  for (const session of sessions) {
    for (const { exercise, sets } of session.exercises) {
      if (!exercise) continue;
      const n = sets.filter((set) => isWorkingSet(set) && isHardSet(set)).length;
      if (n === 0) continue;
      totals.get(exercise.primaryMuscle)!.direct += n;
      for (const m of exercise.secondaryMuscles) {
        if (m !== exercise.primaryMuscle) totals.get(m)!.indirect += n;
      }
    }
  }
  // Cardio is a kind of training, not a muscle: it never appears in set counts.
  return STRENGTH_MUSCLES.map((muscle) => {
    const t = totals.get(muscle)!;
    return {
      muscle,
      direct: t.direct,
      indirect: t.indirect,
      weighted: t.direct * PRIMARY_SET_WEIGHT + t.indirect * SECONDARY_SET_WEIGHT,
    };
  });
}

export interface MuscleRecency {
  muscle: MuscleGroup;
  /** Whole calendar days since a working set trained it directly, or null if never. */
  daysSince: number | null;
  lastDate: Date | null;
}

/**
 * When each muscle was last trained as a primary muscle. An objective record of time passed,
 * not a recovery estimate: how recovered someone is cannot be known from logs alone.
 */
export function muscleRecency(sessions: Session[], now: Date): MuscleRecency[] {
  const last = new Map<MuscleGroup, Date>();
  for (const session of sessions) {
    for (const { exercise, sets } of session.exercises) {
      if (!exercise || !sets.some(isWorkingSet)) continue;
      const prev = last.get(exercise.primaryMuscle);
      if (!prev || session.date > prev) last.set(exercise.primaryMuscle, session.date);
    }
  }
  return STRENGTH_MUSCLES.map((muscle) => {
    const date = last.get(muscle) ?? null;
    return {
      muscle,
      lastDate: date,
      daysSince: date ? differenceInCalendarDays(now, date) : null,
    };
  });
}
