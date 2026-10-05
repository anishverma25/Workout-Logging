import type { Exercise, MuscleGroup, TrackingType } from '../models/schemas';
import { estimateOneRepMax } from './e1rm';
import { performanceByExercise } from './performance';
import { detectPersonalRecords, type PersonalRecord } from './prs';
import { isWorkingSet, type Session } from './sessions';

export interface BestSet {
  value: number;
  weightKg: number | null;
  reps: number | null;
  date: Date;
  workoutId: string;
}

export interface RepsAtLoad {
  weightKg: number;
  reps: number;
  date: Date;
  workoutId: string;
}

export interface ExerciseRecords {
  exerciseId: string;
  name: string;
  primaryMuscle: MuscleGroup;
  trackingType: TrackingType;
  sessions: number;
  lastDate: Date;
  /** Heaviest load actually lifted (added load for weighted bodyweight moves). */
  heaviest: BestSet | null;
  /** Best estimated 1RM. An estimate from a set, never a lift that happened. */
  bestE1rm: BestSet | null;
  mostReps: BestSet | null;
  longestDuration: BestSet | null;
  longestDistance: BestSet | null;
  /** Best reps achieved at each load, heaviest first. Load-tracked exercises only. */
  repsAtLoad: RepsAtLoad[];
  /** Record events for this exercise, newest first. */
  history: PersonalRecord[];
}

/** Loads are compared at 0.01 kg so lb-entered weights group with themselves. */
const loadKey = (kg: number) => Math.round(kg * 100);

/**
 * Current bests for every exercise that has completed working sets, derived from the sets
 * themselves. Ties keep the earliest date: a record is when it was first achieved.
 */
export function exerciseRecords(sessions: Session[], exercises: Exercise[]): ExerciseRecords[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const events = detectPersonalRecords(sessions, exercises);
  const result: ExerciseRecords[] = [];

  for (const [exerciseId, perfs] of performanceByExercise(sessions)) {
    const exercise = byId.get(exerciseId);
    if (!hasWorkingSets(sessions, exerciseId)) continue;

    const best = (
      pick: (p: (typeof perfs)[number]) => {
        v: number | null;
        set: { weightKg: number | null; reps: number | null } | null;
      },
    ): BestSet | null => {
      let out: BestSet | null = null;
      for (const p of perfs) {
        const { v, set } = pick(p);
        if (v === null || !set) continue;
        if (!out || v > out.value + 1e-9) {
          out = {
            value: v,
            weightKg: set.weightKg,
            reps: set.reps,
            date: p.date,
            workoutId: p.workoutId,
          };
        }
      }
      return out;
    };

    const repsAtLoad = new Map<number, RepsAtLoad>();
    if (
      exercise?.trackingType === 'weight_reps' ||
      exercise?.trackingType === 'weighted_bodyweight'
    ) {
      for (const session of sessions) {
        for (const ex of session.exercises) {
          if (ex.workoutExercise.exerciseId !== exerciseId) continue;
          for (const set of ex.sets) {
            if (!isWorkingSet(set) || !set.weightKg || !set.reps) continue;
            const key = loadKey(set.weightKg);
            const current = repsAtLoad.get(key);
            if (!current || set.reps > current.reps) {
              repsAtLoad.set(key, {
                weightKg: set.weightKg,
                reps: set.reps,
                date: session.date,
                workoutId: session.workout.id,
              });
            }
          }
        }
      }
    }

    result.push({
      exerciseId,
      name: exercise?.name ?? lastLoggedName(sessions, exerciseId),
      primaryMuscle: exercise?.primaryMuscle ?? 'chest',
      trackingType: exercise?.trackingType ?? 'weight_reps',
      sessions: perfs.length,
      lastDate: perfs[perfs.length - 1]!.date,
      heaviest: best((p) => ({ v: p.heaviestLoad, set: p.heaviestLoadSet })),
      bestE1rm: best((p) => ({ v: p.bestE1rm, set: p.bestE1rmSet })),
      mostReps: best((p) => ({ v: p.mostReps, set: p.mostRepsSet })),
      longestDuration: best((p) => ({ v: p.longestDuration, set: p.longestDurationSet })),
      longestDistance: best((p) => ({ v: p.longestDistance, set: p.longestDistanceSet })),
      repsAtLoad: [...repsAtLoad.values()].sort((a, b) => b.weightKg - a.weightKg),
      history: events.filter((e) => e.exerciseId === exerciseId),
    });
  }
  return result.sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());
}

/** The name an exercise was last logged under: still right after a custom exercise is deleted. */
function lastLoggedName(sessions: Session[], exerciseId: string): string {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const ex = sessions[i]!.exercises.find((e) => e.workoutExercise.exerciseId === exerciseId);
    if (ex) return ex.workoutExercise.exerciseName;
  }
  return 'Exercise';
}

function hasWorkingSets(sessions: Session[], exerciseId: string): boolean {
  return sessions.some((s) =>
    s.exercises.some(
      (e) => e.workoutExercise.exerciseId === exerciseId && e.sets.some(isWorkingSet),
    ),
  );
}

/** e1RM a given set implies, for showing "estimated from 80 kg × 8". */
export const impliedE1rm = (weightKg: number, reps: number) => estimateOneRepMax(weightKg, reps);
