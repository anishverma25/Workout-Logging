import { formatClock } from '@/lib/format';
import { formatWeight, type WeightUnit } from '@/lib/units';
import type { Exercise } from '../models/schemas';
import { performanceByExercise } from './performance';
import type { Session } from './sessions';

export type PrType = 'e1rm' | 'load' | 'reps' | 'duration' | 'distance';

export interface PersonalRecord {
  id: string;
  type: PrType;
  exerciseId: string;
  exerciseName: string;
  workoutId: string;
  setId: string;
  date: Date;
  /** e1RM or load in kg, reps for bodyweight, seconds for timed, metres for distance. */
  value: number;
  previousBest: number;
  weightKg: number | null;
  reps: number | null;
}

export const PR_LABELS: Record<PrType, string> = {
  e1rm: 'Estimated 1RM',
  load: 'Heaviest load',
  reps: 'Most reps',
  duration: 'Longest time',
  distance: 'Longest distance',
};

/** Minimum improvement to count as a record, so rounding noise never creates PRs. */
const EPSILON = 0.01;

/**
 * Personal records are derived from completed sets, never stored as truth.
 * A record needs an earlier baseline: the first time an exercise is logged is not a PR.
 * Editing or deleting a past set therefore recomputes records automatically.
 */
export function detectPersonalRecords(
  sessions: Session[],
  exercises: Exercise[],
): PersonalRecord[] {
  const nameById = new Map(exercises.map((e) => [e.id, e.name]));
  const records: PersonalRecord[] = [];

  for (const [exerciseId, history] of performanceByExercise(sessions)) {
    let bestE1rm: number | null = null;
    let bestLoad: number | null = null;
    let bestReps: number | null = null;
    let bestDuration: number | null = null;
    let bestDistance: number | null = null;
    const name = nameById.get(exerciseId) ?? 'Exercise';

    for (const perf of history) {
      const push = (
        type: PrType,
        value: number,
        previous: number,
        setId: string,
        w: number | null,
        r: number | null,
      ) =>
        records.push({
          id: `${perf.workoutId}:${exerciseId}:${type}`,
          type,
          exerciseId,
          exerciseName: name,
          workoutId: perf.workoutId,
          setId,
          date: perf.date,
          value,
          previousBest: previous,
          weightKg: w,
          reps: r,
        });

      if (perf.bestE1rm !== null && perf.bestE1rmSet) {
        if (bestE1rm !== null && perf.bestE1rm > bestE1rm + EPSILON) {
          push(
            'e1rm',
            perf.bestE1rm,
            bestE1rm,
            perf.bestE1rmSet.id,
            perf.bestE1rmSet.weightKg,
            perf.bestE1rmSet.reps,
          );
        }
        bestE1rm = Math.max(bestE1rm ?? 0, perf.bestE1rm);
      }
      if (perf.heaviestLoad !== null && perf.heaviestLoadSet) {
        if (bestLoad !== null && perf.heaviestLoad > bestLoad + EPSILON) {
          push(
            'load',
            perf.heaviestLoad,
            bestLoad,
            perf.heaviestLoadSet.id,
            perf.heaviestLoadSet.weightKg,
            perf.heaviestLoadSet.reps,
          );
        }
        bestLoad = Math.max(bestLoad ?? 0, perf.heaviestLoad);
      }
      if (perf.mostReps !== null && perf.mostRepsSet) {
        if (bestReps !== null && perf.mostReps > bestReps) {
          push('reps', perf.mostReps, bestReps, perf.mostRepsSet.id, null, perf.mostReps);
        }
        bestReps = Math.max(bestReps ?? 0, perf.mostReps);
      }
      if (perf.longestDuration !== null && perf.longestDurationSet) {
        if (bestDuration !== null && perf.longestDuration > bestDuration) {
          push(
            'duration',
            perf.longestDuration,
            bestDuration,
            perf.longestDurationSet.id,
            null,
            null,
          );
        }
        bestDuration = Math.max(bestDuration ?? 0, perf.longestDuration);
      }
      if (perf.longestDistance !== null && perf.longestDistanceSet) {
        if (bestDistance !== null && perf.longestDistance > bestDistance + EPSILON) {
          push(
            'distance',
            perf.longestDistance,
            bestDistance,
            perf.longestDistanceSet.id,
            null,
            null,
          );
        }
        bestDistance = Math.max(bestDistance ?? 0, perf.longestDistance);
      }
    }
  }

  return records.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Most meaningful single record to feature from the newest session with records:
 * actual load before estimates before reps, then the heavier lift.
 */
export function featuredRecord(records: PersonalRecord[]): PersonalRecord | null {
  const newest = records[0];
  if (!newest) return null;
  const priority: Record<PrType, number> = { load: 0, e1rm: 1, reps: 2, duration: 3, distance: 3 };
  const sameSession = records.filter((r) => r.workoutId === newest.workoutId);
  return (
    [...sameSession].sort((a, b) => priority[a.type] - priority[b.type] || b.value - a.value)[0] ??
    null
  );
}

/** "85 kg", "12 reps", "1:30", "400 m". Loads are converted to the display unit. */
export function formatRecordValue(type: PrType, value: number, unit: WeightUnit): string {
  switch (type) {
    case 'reps':
      return `${value} reps`;
    case 'duration':
      return formatClock(value);
    case 'distance':
      return `${Math.round(value).toLocaleString()} m`;
    default:
      return formatWeight(value, unit);
  }
}
