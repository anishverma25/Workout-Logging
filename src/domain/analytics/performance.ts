import { repsDone, setVolumeLoad } from './volume';
import type { Exercise, WorkoutSet } from '../models/schemas';
import { estimateOneRepMax, supportsE1rm } from './e1rm';
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
  /** Weight and reps: the set with the most load × reps (both sides for per-hand moves). */
  bestSetVolume: number | null;
  bestSetVolumeSet: WorkoutSet | null;
  /** Weight and reps: load × reps over every working set of the session. */
  sessionVolume: number | null;
  /** Bodyweight and assisted moves: reps over every working set of the session. */
  sessionReps: number | null;
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
    bestSetVolume: null,
    bestSetVolumeSet: null,
    sessionVolume: null,
    sessionReps: null,
  };
  const tracking = exercise?.trackingType;
  for (const set of sets) {
    if (isLoadEligible(set, exercise)) {
      // Drop sets count for volume, never for load or e1RM records (batch 20, O7): the same rule
      // as stalls, the Brain and the leaderboards.
      const drop = set.setType === 'drop';
      const e1rm =
        !drop && supportsE1rm(exercise) ? estimateOneRepMax(set.weightKg, set.reps, set.rir) : null;
      if (e1rm !== null && (perf.bestE1rm === null || e1rm > perf.bestE1rm)) {
        perf.bestE1rm = e1rm;
        perf.bestE1rmSet = set;
      }
      const w = set.weightKg ?? 0;
      if (!drop && (perf.heaviestLoad === null || w > perf.heaviestLoad)) {
        perf.heaviestLoad = w;
        perf.heaviestLoadSet = set;
      }
      const v = setVolumeLoad(set, exercise);
      perf.sessionVolume = (perf.sessionVolume ?? 0) + v;
      if (perf.bestSetVolume === null || v > perf.bestSetVolume) {
        perf.bestSetVolume = v;
        perf.bestSetVolumeSet = set;
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
    if (
      (tracking === 'bodyweight_reps' || tracking === 'assisted_bodyweight') &&
      isWorkingSet(set) &&
      (set.reps ?? 0) > 0
    ) {
      const r = set.reps ?? 0;
      // A session's reps are every rep done (both sides of a one-leg set); the best set is
      // what both sides managed.
      perf.sessionReps = (perf.sessionReps ?? 0) + repsDone(set);
      if (perf.mostReps === null || r > perf.mostReps) {
        perf.mostReps = r;
        perf.mostRepsSet = set;
      }
    }
  }
  // One rule for the whole chart (G3): the best set of 1 to 10 reps, so a change of rep range
  // alone never moves the line.
  perf.chartE1rm = perf.bestE1rm;
  return perf;
}

/** Chronological per-session performance for every exercise. */
export function performanceByExercise(sessions: Session[]): Map<string, ExercisePerformance[]> {
  const map = new Map<string, ExercisePerformance[]>();
  for (const session of sessions) {
    // The same exercise twice in one workout is one session of it (G2): its sets are read
    // together, so a trend never compares a workout with itself.
    const byExercise = new Map<
      string,
      {
        exercise: (typeof session.exercises)[number]['exercise'];
        sets: (typeof session.exercises)[number]['sets'];
      }
    >();
    for (const { workoutExercise, exercise, sets } of session.exercises) {
      const entry = byExercise.get(workoutExercise.exerciseId);
      if (entry) entry.sets = [...entry.sets, ...sets];
      else byExercise.set(workoutExercise.exerciseId, { exercise, sets });
    }
    for (const [exerciseId, { exercise, sets }] of byExercise) {
      const perf = performanceFor(exercise, exerciseId, session.workout.id, session.date, sets);
      const list = map.get(exerciseId) ?? [];
      list.push(perf);
      map.set(exerciseId, list);
    }
  }
  return map;
}
