import type { Exercise, WorkoutSet } from '../models/schemas';
import { estimateOneRepMax } from './e1rm';
import { isLoadEligible, isWorkingSet, type Session } from './sessions';

/** Best values for one exercise within one session. */
export interface ExercisePerformance {
  workoutId: string;
  date: Date;
  exerciseId: string;
  bestE1rm: number | null;
  bestE1rmSet: WorkoutSet | null;
  heaviestLoad: number | null;
  heaviestLoadSet: WorkoutSet | null;
  mostReps: number | null;
  mostRepsSet: WorkoutSet | null;
}

export function performanceFor(
  exercise: Exercise | undefined,
  exerciseId: string,
  workoutId: string,
  date: Date,
  sets: WorkoutSet[],
): ExercisePerformance {
  const perf: ExercisePerformance = {
    workoutId,
    date,
    exerciseId,
    bestE1rm: null,
    bestE1rmSet: null,
    heaviestLoad: null,
    heaviestLoadSet: null,
    mostReps: null,
    mostRepsSet: null,
  };
  for (const set of sets) {
    if (isLoadEligible(set, exercise)) {
      const e1rm = estimateOneRepMax(set.weightKg, set.reps);
      if (e1rm !== null && (perf.bestE1rm === null || e1rm > perf.bestE1rm)) {
        perf.bestE1rm = e1rm;
        perf.bestE1rmSet = set;
      }
      const w = set.weightKg ?? 0;
      if (perf.heaviestLoad === null || w > perf.heaviestLoad) {
        perf.heaviestLoad = w;
        perf.heaviestLoadSet = set;
      }
    }
    if (exercise?.trackingType === 'bodyweight_reps' && isWorkingSet(set) && (set.reps ?? 0) > 0) {
      const r = set.reps ?? 0;
      if (perf.mostReps === null || r > perf.mostReps) {
        perf.mostReps = r;
        perf.mostRepsSet = set;
      }
    }
  }
  return perf;
}

/** Chronological per-session performance for every exercise. */
export function performanceByExercise(sessions: Session[]): Map<string, ExercisePerformance[]> {
  const map = new Map<string, ExercisePerformance[]>();
  for (const session of sessions) {
    for (const { workoutExercise, exercise, sets } of session.exercises) {
      const perf = performanceFor(
        exercise,
        workoutExercise.exerciseId,
        session.workout.id,
        session.date,
        sets,
      );
      const list = map.get(workoutExercise.exerciseId) ?? [];
      list.push(perf);
      map.set(workoutExercise.exerciseId, list);
    }
  }
  return map;
}
