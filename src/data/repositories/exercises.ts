import { CustomExerciseInput, type Exercise } from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, putRecords, softDelete } from './write';

export class ExerciseError extends Error {}

export interface ExerciseDependents {
  /** Routine slots (future templates) that use the exercise. */
  routineSlots: number;
  /** Logged sets. History keeps its own copy of the name, so these are never touched. */
  loggedSets: number;
}

export async function exerciseDependents(
  db: WorkoutDatabase,
  exerciseId: string,
): Promise<ExerciseDependents> {
  const [slots, sets] = await Promise.all([
    db.routineExercises.where('exerciseId').equals(exerciseId).toArray(),
    db.sets.where('exerciseId').equals(exerciseId).toArray(),
  ]);
  return {
    routineSlots: slots.filter((s) => s.deletedAt === null).length,
    loggedSets: sets.filter((s) => s.deletedAt === null).length,
  };
}

async function assertUniqueName(db: WorkoutDatabase, name: string, ignoreId?: string) {
  const wanted = name.trim().toLowerCase();
  const clash = await db.exercises
    .filter((e) => e.deletedAt === null && e.id !== ignoreId && e.name.toLowerCase() === wanted)
    .first();
  if (clash) {
    throw new ExerciseError(
      clash.isCustom
        ? `You already have an exercise called ${clash.name}.`
        : `${clash.name} is already in the library.`,
    );
  }
}

export async function createCustomExercise(
  db: WorkoutDatabase,
  input: CustomExerciseInput,
): Promise<Exercise> {
  const data = CustomExerciseInput.parse(input);
  await assertUniqueName(db, data.name);
  const exercise: Exercise = {
    ...newRecordMeta('user'),
    ...data,
    secondaryMuscles: data.secondaryMuscles.filter((m) => m !== data.primaryMuscle),
    instructions: data.instructions || null,
    isCustom: true,
  };
  await putRecords(db, 'exercises', [exercise]);
  return exercise;
}

/**
 * Edits a custom exercise. Built-in exercises are read-only.
 * How an exercise is tracked decides how its past sets are measured, so the tracking type and
 * load mode are locked once sets have been logged; otherwise old numbers would change meaning.
 */
export async function updateCustomExercise(
  db: WorkoutDatabase,
  id: string,
  input: CustomExerciseInput,
): Promise<Exercise> {
  const data = CustomExerciseInput.parse(input);
  const current = await db.exercises.get(id);
  if (!current || current.deletedAt !== null) throw new ExerciseError('Exercise not found.');
  if (!current.isCustom) throw new ExerciseError('Built-in exercises cannot be edited.');
  await assertUniqueName(db, data.name, id);
  if (data.trackingType !== current.trackingType || data.loadMode !== current.loadMode) {
    const { loggedSets } = await exerciseDependents(db, id);
    if (loggedSets > 0) {
      throw new ExerciseError(
        'This exercise already has logged sets, so how it is tracked can no longer change. Create a new exercise instead.',
      );
    }
  }
  const saved = await patchRecord<Exercise>(db, 'exercises', id, {
    ...data,
    secondaryMuscles: data.secondaryMuscles.filter((m) => m !== data.primaryMuscle),
    instructions: data.instructions || null,
  });
  return saved as Exercise;
}

/**
 * Deletes a custom exercise and removes it from routines (future plans).
 * Logged workouts keep their sets and the exercise name they were logged under.
 */
export async function deleteCustomExercise(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction('rw', [db.exercises, db.routineExercises, db.outbox], async () => {
    const current = await db.exercises.get(id);
    if (!current || current.deletedAt !== null) return;
    if (!current.isCustom) throw new ExerciseError('Built-in exercises cannot be deleted.');
    const slots = await db.routineExercises.where('exerciseId').equals(id).toArray();
    await softDelete(
      db,
      'routineExercises',
      slots.filter((s) => s.deletedAt === null).map((s) => s.id),
    );
    await softDelete(db, 'exercises', [id]);
  });
}
