import type { CustomExerciseInput } from '@/domain/models/schemas';
import { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import {
  createCustomExercise,
  deleteCustomExercise,
  ExerciseError,
  exerciseDependents,
  updateCustomExercise,
} from './exercises';
import { addExercisesToDay, createRoutineFromTemplate } from './routines';
import { ensureSystemExercises } from './training';
import {
  addExercisesToWorkout,
  completeSet,
  finishWorkout,
  startEmptyWorkout,
  updateSet,
} from './workouts';

let db: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`exercises-${++n}`);
  await db.open();
  await ensureSystemExercises(db);
});
afterEach(async () => {
  await db.delete();
});

const input = (over: Partial<CustomExerciseInput> = {}): CustomExerciseInput => ({
  name: 'Landmine press',
  primaryMuscle: 'shoulders',
  secondaryMuscles: ['chest', 'triceps', 'shoulders'],
  equipment: 'barbell',
  category: 'compound',
  trackingType: 'weight_reps',
  loadMode: 'total',
  instructions: '',
  ...over,
});

describe('custom exercises', () => {
  it('creates a user exercise and drops the primary muscle from secondaries', async () => {
    const e = await createCustomExercise(db, input());
    expect(e).toMatchObject({
      isCustom: true,
      origin: 'user',
      deletedAt: null,
      instructions: null,
      secondaryMuscles: ['chest', 'triceps'],
    });
  });

  it('rejects short names and duplicates of library or custom names', async () => {
    await expect(createCustomExercise(db, input({ name: 'a' }))).rejects.toThrow();
    await expect(createCustomExercise(db, input({ name: 'back squat' }))).rejects.toThrow(
      'already in the library',
    );
    await createCustomExercise(db, input());
    await expect(createCustomExercise(db, input({ name: 'LANDMINE PRESS' }))).rejects.toThrow(
      'already have',
    );
  });

  it('edits freely until sets are logged, then locks how it is tracked', async () => {
    const e = await createCustomExercise(db, input());
    await updateCustomExercise(
      db,
      e.id,
      input({ name: 'Half-kneeling landmine press', loadMode: 'per_hand' }),
    );
    expect((await db.exercises.get(e.id))?.loadMode).toBe('per_hand');

    const w = await startEmptyWorkout(db);
    const [we] = await addExercisesToWorkout(db, w.id, [e.id]);
    const set = (await db.sets.where('workoutExerciseId').equals(we!.id).toArray())[0]!;
    await updateSet(db, set.id, { weightKg: 20, reps: 10 });
    await completeSet(db, set.id);
    expect((await exerciseDependents(db, e.id)).loggedSets).toBeGreaterThan(0);

    await expect(
      updateCustomExercise(
        db,
        e.id,
        input({ name: 'Half-kneeling landmine press', loadMode: 'total' }),
      ),
    ).rejects.toBeInstanceOf(ExerciseError);
    // Other fields stay editable.
    await updateCustomExercise(
      db,
      e.id,
      input({ name: 'Kneeling landmine press', loadMode: 'per_hand', instructions: 'Brace.' }),
    );
    expect((await db.exercises.get(e.id))?.name).toBe('Kneeling landmine press');
  });

  it('never edits or deletes built-in exercises', async () => {
    const id = exerciseIdFor('back-squat');
    await expect(updateCustomExercise(db, id, input({ name: 'Squat!' }))).rejects.toThrow(
      'Built-in',
    );
    await expect(deleteCustomExercise(db, id)).rejects.toThrow('Built-in');
  });

  it('deleting removes it from routines but leaves logged history and its name intact', async () => {
    const e = await createCustomExercise(db, input());
    const r = await createRoutineFromTemplate(db, 'custom');
    const day = (await db.routineDays.where('routineId').equals(r.id).toArray())[0]!;
    await addExercisesToDay(db, day.id, [e.id, exerciseIdFor('dips')]);

    const w = await startEmptyWorkout(db);
    const [we] = await addExercisesToWorkout(db, w.id, [e.id]);
    const set = (await db.sets.where('workoutExerciseId').equals(we!.id).toArray())[0]!;
    await updateSet(db, set.id, { weightKg: 25, reps: 8 });
    await completeSet(db, set.id);
    await finishWorkout(db, w.id);

    await deleteCustomExercise(db, e.id);
    expect((await db.exercises.get(e.id))?.deletedAt).not.toBeNull();
    const slots = (await db.routineExercises.where('routineDayId').equals(day.id).toArray()).filter(
      (s) => s.deletedAt === null,
    );
    expect(slots.map((s) => s.exerciseId)).toEqual([exerciseIdFor('dips')]);
    const logged = await db.workoutExercises.get(we!.id);
    expect(logged).toMatchObject({ exerciseName: 'Landmine press', deletedAt: null });
    expect((await db.sets.get(set.id))?.deletedAt).toBeNull();
  });
});
