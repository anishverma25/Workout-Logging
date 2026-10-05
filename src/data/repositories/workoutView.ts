import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/domain/models/schemas';
import { previousPerformance, type PreviousPerformance } from '@/domain/workout/previous';
import type { WorkoutDatabase } from '../db';
import { getActiveWorkout } from './workouts';

export interface WorkoutExerciseView {
  workoutExercise: WorkoutExercise;
  exercise: Exercise | undefined;
  sets: WorkoutSet[];
  previous: PreviousPerformance | null;
}

export interface WorkoutView {
  workout: Workout;
  exercises: WorkoutExerciseView[];
}

const alive = <T extends { deletedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

/**
 * One workout with its exercises, sets and, for each exercise, what was done last time.
 * Reads by index (only the exercises in this workout), so it stays fast as history grows.
 */
export async function loadWorkoutView(
  db: WorkoutDatabase,
  workoutId: string,
): Promise<WorkoutView | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout || workout.deletedAt !== null) return null;
  const workoutExercises = alive(
    await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
  ).sort((a, b) => a.order - b.order);
  const sets = alive(await db.sets.where('workoutId').equals(workoutId).toArray());
  const exerciseIds = [...new Set(workoutExercises.map((we) => we.exerciseId))];
  const [exercises, historyExercises, historySets, completed] = await Promise.all([
    db.exercises.bulkGet(exerciseIds),
    db.workoutExercises.where('exerciseId').anyOf(exerciseIds).toArray(),
    db.sets.where('exerciseId').anyOf(exerciseIds).toArray(),
    db.workouts.where('status').equals('completed').toArray(),
  ]);
  const exerciseById = new Map(exercises.filter((e): e is Exercise => !!e).map((e) => [e.id, e]));
  const lookup = { workouts: completed, workoutExercises: historyExercises, sets: historySets };
  return {
    workout,
    exercises: workoutExercises.map((we) => ({
      workoutExercise: we,
      exercise: exerciseById.get(we.exerciseId),
      sets: sets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.order - b.order),
      previous: previousPerformance(lookup, we.exerciseId, workout.startedAt, workout.id),
    })),
  };
}

export async function loadActiveWorkoutView(db: WorkoutDatabase): Promise<WorkoutView | null> {
  const active = await getActiveWorkout(db);
  return active ? loadWorkoutView(db, active.id) : null;
}
