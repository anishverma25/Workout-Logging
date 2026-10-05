import { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import { ensureSystemExercises } from './training';
import { addExercisesToWorkout, startEmptyWorkout, updateSet } from './workouts';
import { combineWorkoutView, loadWorkoutCore, shareWorkoutCore } from './workoutView';

let db: WorkoutDatabase;
beforeEach(async () => {
  db = new WorkoutDatabase(`view-${Math.random()}`);
  await db.open();
  await ensureSystemExercises(db);
});
afterEach(() => db.delete());

describe('workout view sharing', () => {
  it('keeps unchanged exercises as the same objects, so only the edited card re-renders', async () => {
    const w = await startEmptyWorkout(db);
    const [a, b] = await addExercisesToWorkout(db, w.id, [
      exerciseIdFor('barbell-bench-press'),
      exerciseIdFor('pull-up'),
    ]);
    const first = await loadWorkoutCore(db, w.id);
    const setA = (await db.sets.where('workoutExerciseId').equals(a!.id).sortBy('order'))[0]!;
    await updateSet(db, setA.id, { weightKg: 80, reps: 5 });
    const second = shareWorkoutCore(first, await loadWorkoutCore(db, w.id))!;

    const byId = (core: typeof second, id: string) =>
      core.exercises.find((e) => e.workoutExercise.id === id)!;
    expect(byId(second, b!.id)).toBe(byId(first!, b!.id));
    expect(byId(second, a!.id)).not.toBe(byId(first!, a!.id));
    expect(byId(second, a!.id).sets[0]!.weightKg).toBe(80);

    // Merging in history keeps that identity too, until the history itself changes.
    const history = new Map([[exerciseIdFor('pull-up'), null]]);
    const v1 = combineWorkoutView(second, history);
    const v2 = combineWorkoutView(second, history);
    expect(v2.exercises[1]).toBe(v1.exercises[1]);
    // Unknown history stays undefined (loading), never null ("first time").
    expect(v1.exercises[0]!.previous).toBeUndefined();
    expect(v1.exercises[1]!.previous).toBeNull();
  });
});
