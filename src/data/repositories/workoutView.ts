import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/domain/models/schemas';
import { previousPerformance, type PreviousPerformance } from '@/domain/workout/previous';
import type { WorkoutDatabase } from '../db';
import { getActiveWorkout } from './workouts';

export interface WorkoutExerciseView {
  workoutExercise: WorkoutExercise;
  exercise: Exercise | undefined;
  sets: WorkoutSet[];
  /** null: never done before. undefined: history is still loading. */
  previous: PreviousPerformance | null | undefined;
}

export interface WorkoutView {
  workout: Workout;
  exercises: WorkoutExerciseView[];
}

const alive = <T extends { deletedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

/** How many earlier sessions per exercise are read to find "last time". */
const RECENT_SESSIONS = 8;

/**
 * Just enough history to show "last time" for each exercise: its most recent completed
 * sessions before this workout, read through indexes. It never touches the sets being logged
 * now, so editing a set does not re-read the past, however long the history is.
 */
async function loadRecentHistory(
  db: WorkoutDatabase,
  exerciseIds: string[],
  before: string,
  excludeWorkoutId: string,
) {
  if (exerciseIds.length === 0) return { workouts: [], workoutExercises: [], sets: [] };
  const historyExercises = alive(
    await db.workoutExercises.where('exerciseId').anyOf(exerciseIds).toArray(),
  ).filter((we) => we.workoutId !== excludeWorkoutId);
  const workouts = (
    await db.workouts.bulkGet([...new Set(historyExercises.map((we) => we.workoutId))])
  ).filter(
    (w): w is Workout =>
      !!w && w.deletedAt === null && w.status === 'completed' && w.startedAt < before,
  );
  const startedAt = new Map(workouts.map((w) => [w.id, w.startedAt]));
  const recentIds: string[] = [];
  for (const exerciseId of exerciseIds) {
    historyExercises
      .filter((we) => we.exerciseId === exerciseId && startedAt.has(we.workoutId))
      .sort((a, b) => startedAt.get(b.workoutId)!.localeCompare(startedAt.get(a.workoutId)!))
      .slice(0, RECENT_SESSIONS)
      .forEach((we) => recentIds.push(we.id));
  }
  const sets = await db.sets.where('workoutExerciseId').anyOf(recentIds).toArray();
  return { workouts, workoutExercises: historyExercises, sets };
}

/** A workout as it is now, without history: cheap, so it can re-run on every change. */
export interface WorkoutCore {
  workout: Workout;
  exercises: Omit<WorkoutExerciseView, 'previous'>[];
}

export async function loadWorkoutCore(
  db: WorkoutDatabase,
  workoutId: string,
): Promise<WorkoutCore | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout || workout.deletedAt !== null) return null;
  const workoutExercises = alive(
    await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
  ).sort((a, b) => a.order - b.order);
  const sets = alive(await db.sets.where('workoutId').equals(workoutId).toArray());
  const exerciseIds = [...new Set(workoutExercises.map((we) => we.exerciseId))];
  const exercises = await db.exercises.bulkGet(exerciseIds);
  const exerciseById = new Map(exercises.filter((e): e is Exercise => !!e).map((e) => [e.id, e]));
  return {
    workout,
    exercises: workoutExercises.map((we) => ({
      workoutExercise: we,
      exercise: exerciseById.get(we.exerciseId),
      sets: sets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.order - b.order),
    })),
  };
}

/** "Last time" for each exercise, by exercise id. Does not read the workout being logged. */
export async function loadPreviousPerformance(
  db: WorkoutDatabase,
  exerciseIds: string[],
  before: string,
  excludeWorkoutId: string,
): Promise<Map<string, PreviousPerformance | null>> {
  const lookup = await loadRecentHistory(db, exerciseIds, before, excludeWorkoutId);
  return new Map(
    exerciseIds.map((id) => [id, previousPerformance(lookup, id, before, excludeWorkoutId)]),
  );
}

/** Combined views per core exercise object, so unchanged exercises stay the same object. */
const combined = new WeakMap<
  WorkoutCore['exercises'][number],
  { previous: PreviousPerformance | null | undefined; view: WorkoutExerciseView }
>();

export function combineWorkoutView(
  core: WorkoutCore,
  previous: Map<string, PreviousPerformance | null> | undefined,
): WorkoutView {
  return {
    workout: core.workout,
    exercises: core.exercises.map((e) => {
      // An exercise the history has not been loaded for yet stays undefined, so the screen
      // never claims "first time" for something that is only still loading.
      const prev = previous?.has(e.workoutExercise.exerciseId)
        ? previous.get(e.workoutExercise.exerciseId)
        : undefined;
      const cached = combined.get(e);
      if (cached && cached.previous === prev) return cached.view;
      const view = { ...e, previous: prev };
      combined.set(e, { previous: prev, view });
      return view;
    }),
  };
}

/** One workout with its exercises, sets and, for each exercise, what was done last time. */
export async function loadWorkoutView(
  db: WorkoutDatabase,
  workoutId: string,
): Promise<WorkoutView | null> {
  const core = await loadWorkoutCore(db, workoutId);
  if (!core) return null;
  const ids = [...new Set(core.exercises.map((e) => e.workoutExercise.exerciseId))];
  const previous = await loadPreviousPerformance(db, ids, core.workout.startedAt, workoutId);
  return combineWorkoutView(core, previous);
}

export async function loadActiveWorkoutView(db: WorkoutDatabase): Promise<WorkoutView | null> {
  const active = await getActiveWorkout(db);
  return active ? loadWorkoutView(db, active.id) : null;
}

/**
 * Reuses the objects of exercises that did not change since the last load, so a memoised
 * exercise card only re-renders when its own sets or details changed.
 */
export function shareWorkoutCore(prev: WorkoutCore | null | undefined, next: WorkoutCore | null) {
  if (!prev || !next || prev.workout.id !== next.workout.id) return next;
  const before = new Map(prev.exercises.map((e) => [e.workoutExercise.id, e]));
  return {
    workout: next.workout,
    exercises: next.exercises.map((e) => {
      const old = before.get(e.workoutExercise.id);
      const same =
        old &&
        old.workoutExercise.updatedAt === e.workoutExercise.updatedAt &&
        old.exercise?.updatedAt === e.exercise?.updatedAt &&
        old.sets.length === e.sets.length &&
        old.sets.every((s, i) => s.id === e.sets[i]!.id && s.updatedAt === e.sets[i]!.updatedAt);
      return same ? old : e;
    }),
  };
}
