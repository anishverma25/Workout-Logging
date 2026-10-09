import type { Exercise, WorkoutSet } from '../models/schemas';
import { estimateOneRepMax, E1RM_PREFERRED_MAX_REPS, supportsE1rm } from './e1rm';
import { isLoadEligible, isWorkingSet, type Session } from './sessions';

/** Best values for one exercise within one session. */
export interface ExercisePerformance {
  workoutId: string;
  date: Date;
  exerciseId: string;
  /** Best estimate from any set up to 10 reps: used for records. */
  bestE1rm: number | null;
  bestE1rmSet: WorkoutSet | null;
  /** For progress charts: the best 1 to 6 rep set when there is one, else bestE1rm. */
  chartE1rm: number | null;
  heaviestLoad: number | null;
  heaviestLoadSet: WorkoutSet | null;
  mostReps: number | null;
  mostRepsSet: WorkoutSet | null;
  /** Timed exercises: longest completed working set, seconds. */
  longestDuration: number | null;
  longestDurationSet: WorkoutSet | null;
  /** Distance exercises: longest completed working set, metres. */
  longestDistance: number | null;
  longestDistanceSet: WorkoutSet | null;
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
    chartE1rm: null,
    heaviestLoad: null,
    heaviestLoadSet: null,
    mostReps: null,
    mostRepsSet: null,
    longestDuration: null,
    longestDurationSet: null,
    longestDistance: null,
    longestDistanceSet: null,
  };
  const tracking = exercise?.trackingType;
  let chartLow: number | null = null;
  for (const set of sets) {
    if (isLoadEligible(set, exercise)) {
      const e1rm = supportsE1rm(exercise)
        ? estimateOneRepMax(set.weightKg, set.reps, set.rir)
        : null;
      if (e1rm !== null && (perf.bestE1rm === null || e1rm > perf.bestE1rm)) {
        perf.bestE1rm = e1rm;
        perf.bestE1rmSet = set;
      }
      // Charts prefer the best set of 1 to 6 reps when there is one: low-rep sets estimate a
      // max most reliably (Reynolds et al. 2006). Otherwise the best set up to 10 reps.
      if (e1rm !== null) {
        const low = (set.reps ?? 0) <= E1RM_PREFERRED_MAX_REPS;
        if (low && (chartLow === null || e1rm > chartLow)) chartLow = e1rm;
      }
      const w = set.weightKg ?? 0;
      if (perf.heaviestLoad === null || w > perf.heaviestLoad) {
        perf.heaviestLoad = w;
        perf.heaviestLoadSet = set;
      }
    }
    // Weighted bodyweight moves: the heaviest added load is a real, comparable record.
    // It is not used for e1RM or volume, because body weight is not part of the logged load.
    if (
      tracking === 'weighted_bodyweight' &&
      isWorkingSet(set) &&
      (set.weightKg ?? 0) > 0 &&
      (set.reps ?? 0) > 0
    ) {
      const w = set.weightKg ?? 0;
      if (perf.heaviestLoad === null || w > perf.heaviestLoad) {
        perf.heaviestLoad = w;
        perf.heaviestLoadSet = set;
      }
    }
    if (
      (tracking === 'duration' || tracking === 'cardio') &&
      isWorkingSet(set) &&
      (set.durationSec ?? 0) > 0
    ) {
      const d = set.durationSec ?? 0;
      if (perf.longestDuration === null || d > perf.longestDuration) {
        perf.longestDuration = d;
        perf.longestDurationSet = set;
      }
    }
    if (
      (tracking === 'distance' || tracking === 'cardio') &&
      isWorkingSet(set) &&
      (set.distanceM ?? 0) > 0
    ) {
      const d = set.distanceM ?? 0;
      if (perf.longestDistance === null || d > perf.longestDistance) {
        perf.longestDistance = d;
        perf.longestDistanceSet = set;
      }
    }
    if (tracking === 'bodyweight_reps' && isWorkingSet(set) && (set.reps ?? 0) > 0) {
      const r = set.reps ?? 0;
      if (perf.mostReps === null || r > perf.mostReps) {
        perf.mostReps = r;
        perf.mostRepsSet = set;
      }
    }
  }
  perf.chartE1rm = chartLow ?? perf.bestE1rm;
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
