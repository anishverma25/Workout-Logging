import type {
  BodyMeasurement,
  BodyWeightEntry,
  Exercise,
  Profile,
  Routine,
  RoutineDay,
  RoutineExercise,
  TrainingGoal,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../models/schemas';

/** Everything the analytics engine reads. Loaded once from the local database. */
export interface TrainingData {
  profile: Profile | null;
  exercises: Exercise[];
  routines: Routine[];
  routineDays: RoutineDay[];
  routineExercises: RoutineExercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: WorkoutSet[];
  bodyWeights: BodyWeightEntry[];
  measurements: BodyMeasurement[];
  goals: TrainingGoal[];
}

export interface SessionExercise {
  workoutExercise: WorkoutExercise;
  exercise: Exercise | undefined;
  sets: WorkoutSet[];
}

export interface Session {
  workout: Workout;
  date: Date;
  exercises: SessionExercise[];
}

export const isAlive = <T extends { deletedAt: string | null }>(r: T) => r.deletedAt === null;

export function isCompletedSet(set: WorkoutSet): boolean {
  return set.completedAt !== null;
}

/** Warm-ups are excluded from working-set counts, volume load, e1RM and PRs. */
export function isWorkingSet(set: WorkoutSet): boolean {
  return isCompletedSet(set) && set.setType !== 'warmup';
}

/** Sets eligible for load-based metrics (volume load, e1RM, heaviest load). */
export function isLoadEligible(set: WorkoutSet, exercise: Exercise | undefined): boolean {
  return (
    !!exercise &&
    exercise.trackingType === 'weight_reps' &&
    isWorkingSet(set) &&
    (set.weightKg ?? 0) > 0 &&
    (set.reps ?? 0) > 0
  );
}

/** Completed workouts as chronological sessions with their exercises and sets. */
export function buildSessions(data: TrainingData): Session[] {
  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]));
  const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();
  for (const set of data.sets) {
    if (!isAlive(set)) continue;
    const list = setsByWorkoutExercise.get(set.workoutExerciseId) ?? [];
    list.push(set);
    setsByWorkoutExercise.set(set.workoutExerciseId, list);
  }
  const exercisesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const we of data.workoutExercises) {
    if (!isAlive(we)) continue;
    const list = exercisesByWorkout.get(we.workoutId) ?? [];
    list.push(we);
    exercisesByWorkout.set(we.workoutId, list);
  }

  return data.workouts
    .filter((w) => isAlive(w) && w.status === 'completed')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((workout) => ({
      workout,
      date: new Date(workout.startedAt),
      exercises: (exercisesByWorkout.get(workout.id) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((workoutExercise) => ({
          workoutExercise,
          exercise: exerciseById.get(workoutExercise.exerciseId),
          sets: (setsByWorkoutExercise.get(workoutExercise.id) ?? []).sort(
            (a, b) => a.order - b.order,
          ),
        })),
    }));
}

export function sessionsBetween(sessions: Session[], start: Date, end: Date): Session[] {
  return sessions.filter((s) => s.date >= start && s.date < end);
}

export function sessionDurationMinutes(session: Session): number | null {
  const { startedAt, endedAt, pausedMs } = session.workout;
  if (!endedAt) return null;
  // Paused time is not training time.
  return Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(startedAt) - (pausedMs ?? 0)) / 60_000),
  );
}

export function workingSetCount(session: Session): number {
  return session.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);
}
