import { previousPerformance, suggestFor } from '@/domain/workout/previous';
import { lbToKg } from '@/lib/units';
import { WorkoutDatabase } from '../db';
import { loadDemoData } from '../demo/service';
import { exerciseIdFor } from '../library/exercises';
import { createRoutineFromTemplate } from './routines';
import { loadTrainingData, ensureSystemExercises } from './training';
import {
  ActiveWorkoutExistsError,
  addExercisesToWorkout,
  addSet,
  cancelWorkout,
  completeSet,
  deleteSet,
  duplicateSet,
  elapsedMs,
  finishCheck,
  finishWorkout,
  getActiveWorkout,
  moveWorkoutExercise,
  pauseWorkout,
  removeWorkoutExercise,
  resumeWorkout,
  startEmptyWorkout,
  startWorkoutFromDay,
  uncompleteSet,
  updateSet,
  updateWorkoutDetails,
  WorkoutError,
} from './workouts';

let db: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`workouts-${++n}`);
  await db.open();
  await ensureSystemExercises(db);
});
afterEach(async () => {
  await db.delete();
});

const liveSets = async (workoutExerciseId: string) =>
  (await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray())
    .filter((s) => s.deletedAt === null)
    .sort((a, b) => a.order - b.order);
const liveExercises = async (workoutId: string) =>
  (await db.workoutExercises.where('workoutId').equals(workoutId).toArray())
    .filter((e) => e.deletedAt === null)
    .sort((a, b) => a.order - b.order);

const T0 = new Date(2026, 9, 5, 18, 0, 0);
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

async function pushDay() {
  const r = await createRoutineFromTemplate(db, 'ppl');
  const days = (await db.routineDays.where('routineId').equals(r.id).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  return { routine: r, day: days[0]! };
}

describe('starting', () => {
  it('starts from a routine day with exercises, targets and empty working sets', async () => {
    const { routine, day } = await pushDay();
    const w = await startWorkoutFromDay(db, day.id, T0);
    expect(w).toMatchObject({
      name: 'Push',
      status: 'in_progress',
      routineId: routine.id,
      routineDayId: day.id,
      startedAt: T0.toISOString(),
    });
    const wes = await liveExercises(w.id);
    expect(wes.map((e) => e.exerciseName)).toEqual([
      'Barbell bench press',
      'Incline dumbbell press',
      'Seated dumbbell shoulder press',
      'Cable lateral raise',
      'Triceps rope pushdown',
    ]);
    expect(wes[0]!.target).toEqual({ sets: 3, repMin: 5, repMax: 8, rir: 2, rest: 180 });
    const sets = await liveSets(wes[0]!.id);
    expect(sets).toHaveLength(3);
    expect(
      sets.every((s) => s.setType === 'working' && s.completedAt === null && s.weightKg === null),
    ).toBe(true);
  });

  it('allows only one workout in progress', async () => {
    const { day } = await pushDay();
    const w = await startEmptyWorkout(db, T0);
    await expect(startWorkoutFromDay(db, day.id)).rejects.toBeInstanceOf(ActiveWorkoutExistsError);
    await expect(startEmptyWorkout(db)).rejects.toMatchObject({ workoutId: w.id });
    expect((await getActiveWorkout(db))?.id).toBe(w.id);
  });

  it('names empty workouts by time of day', async () => {
    expect((await startEmptyWorkout(db, new Date(2026, 9, 5, 7, 0))).name).toBe('Morning workout');
  });
});

describe('editing a workout', () => {
  it('adds, reorders and removes exercises; sets default to last time’s count', async () => {
    await loadDemoData(db, T0);
    const w = await startEmptyWorkout(db, T0);
    const added = await addExercisesToWorkout(db, w.id, [
      exerciseIdFor('barbell-bench-press'),
      exerciseIdFor('pec-deck'),
    ]);
    // The demo athlete's last bench session had working, back-off and drop sets.
    const benchPrev = previousPerformance(
      await loadTrainingData(db),
      exerciseIdFor('barbell-bench-press'),
      w.startedAt,
    );
    const lastWorking = benchPrev!.sets.filter((s) => s.setType !== 'warmup').length;
    expect((await liveSets(added[0]!.id)).length).toBe(Math.min(lastWorking, 6));
    expect((await liveSets(added[1]!.id)).length).toBe(3); // never done before

    await moveWorkoutExercise(db, added[1]!.id, -1);
    expect((await liveExercises(w.id)).map((e) => e.exerciseName)).toEqual([
      'Pec deck',
      'Barbell bench press',
    ]);
    await removeWorkoutExercise(db, added[1]!.id);
    expect((await liveExercises(w.id)).map((e) => [e.exerciseName, e.order])).toEqual([
      ['Barbell bench press', 0],
    ]);
    expect(await liveSets(added[1]!.id)).toHaveLength(0);
  });

  it('adds, edits, duplicates and deletes sets, keeping order contiguous', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('back-squat')]);
    const [s1] = await liveSets(we!.id);
    await updateSet(db, s1!.id, {
      weightKg: 100,
      reps: 5,
      rir: 2,
      setType: 'working',
      notes: ' belt ',
    });
    const copy = await duplicateSet(db, s1!.id);
    expect(copy).toMatchObject({ weightKg: 100, reps: 5, rir: 2, completedAt: null, order: 1 });
    const warm = await addSet(db, we!.id, 'warmup');
    expect(warm.order).toBe(4);

    let sets = await liveSets(we!.id);
    expect(sets.map((s) => s.order)).toEqual([0, 1, 2, 3, 4]);
    expect(sets[0]!.notes).toBe('belt');

    await deleteSet(db, sets[1]!.id);
    sets = await liveSets(we!.id);
    expect(sets.map((s) => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('clamps impossible values instead of storing them', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('back-squat')]);
    const [s] = await liveSets(we!.id);
    await updateSet(db, s!.id, { weightKg: -5, reps: 7.6, rir: 14, rpe: 0 });
    expect(await db.sets.get(s!.id)).toMatchObject({ weightKg: 0, reps: 8, rir: 10, rpe: 1 });
  });

  it('stores lb input as kg at full precision and shows it back unchanged', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('back-squat')]);
    const [s] = await liveSets(we!.id);
    await updateSet(db, s!.id, { weightKg: lbToKg(225) });
    const stored = (await db.sets.get(s!.id))!.weightKg!;
    expect(stored).toBeCloseTo(102.0583, 4);
    expect(Math.round((stored / 0.45359237) * 10) / 10).toBe(225);
  });

  it('updates workout name and notes', async () => {
    const w = await startEmptyWorkout(db, T0);
    await updateWorkoutDetails(db, w.id, { name: ' Heavy day ', notes: '  felt strong ' });
    expect(await db.workouts.get(w.id)).toMatchObject({ name: 'Heavy day', notes: 'felt strong' });
    await expect(updateWorkoutDetails(db, w.id, { name: ' ' })).rejects.toBeInstanceOf(
      WorkoutError,
    );
  });
});

describe('completing sets', () => {
  it('fills empty fields from the suggestion and is idempotent', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('back-squat')]);
    const [s] = await liveSets(we!.id);
    const first = await completeSet(
      db,
      s!.id,
      { weightKg: 100, reps: 5, durationSec: null, distanceM: null },
      at(5),
    );
    expect(first).toMatchObject({ ok: true, alreadyCompleted: false });
    const again = await completeSet(
      db,
      s!.id,
      { weightKg: 120, reps: 1, durationSec: null, distanceM: null },
      at(6),
    );
    expect(again).toMatchObject({ ok: true, alreadyCompleted: true });
    expect(await db.sets.get(s!.id)).toMatchObject({
      weightKg: 100,
      reps: 5,
      completedAt: at(5).toISOString(),
    });
  });

  it('typed values win over the suggestion', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('back-squat')]);
    const [s] = await liveSets(we!.id);
    await updateSet(db, s!.id, { reps: 7 });
    await completeSet(db, s!.id, { weightKg: 100, reps: 5, durationSec: null, distanceM: null });
    expect(await db.sets.get(s!.id)).toMatchObject({ weightKg: 100, reps: 7 });
  });

  it('refuses to complete a set with missing values, per tracking type', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [squat, pullUp, plank] = await addExercisesToWorkout(db, w.id, [
      exerciseIdFor('back-squat'),
      exerciseIdFor('pull-up'),
      exerciseIdFor('plank'),
    ]);
    const [sq] = await liveSets(squat!.id);
    expect(await completeSet(db, sq!.id)).toEqual({ ok: false, reason: 'Enter the weight first.' });
    await updateSet(db, sq!.id, { weightKg: 60 });
    expect(await completeSet(db, sq!.id)).toEqual({ ok: false, reason: 'Enter the reps first.' });

    const [pu] = await liveSets(pullUp!.id);
    await updateSet(db, pu!.id, { reps: 8 });
    expect((await completeSet(db, pu!.id)).ok).toBe(true); // no weight needed

    const [pl] = await liveSets(plank!.id);
    expect(await completeSet(db, pl!.id)).toEqual({ ok: false, reason: 'Enter the time first.' });
    await updateSet(db, pl!.id, { durationSec: 45 });
    expect((await completeSet(db, pl!.id)).ok).toBe(true);
  });

  it('undoes a completed set', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('pull-up')]);
    const [s] = await liveSets(we!.id);
    await updateSet(db, s!.id, { reps: 10 });
    await completeSet(db, s!.id);
    await uncompleteSet(db, s!.id);
    expect(await db.sets.get(s!.id)).toMatchObject({ completedAt: null, reps: 10 });
  });
});

describe('pausing', () => {
  it('excludes paused time from training time and from the final duration', async () => {
    const w = await startEmptyWorkout(db, T0);
    await pauseWorkout(db, w.id, at(10));
    await pauseWorkout(db, w.id, at(12)); // second pause is ignored
    expect(elapsedMs((await db.workouts.get(w.id))!, at(15))).toBe(10 * 60_000);
    await resumeWorkout(db, w.id, at(20));
    expect(elapsedMs((await db.workouts.get(w.id))!, at(30))).toBe(20 * 60_000);

    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('pull-up')]);
    const [s] = await liveSets(we!.id);
    await updateSet(db, s!.id, { reps: 10 });
    await completeSet(db, s!.id);
    await pauseWorkout(db, w.id, at(40));
    const done = await finishWorkout(db, w.id, { now: at(45) }); // finished while paused
    expect(done.pausedMs).toBe(15 * 60_000);
    expect(done.pausedAt).toBeNull();
    expect(elapsedMs(done)).toBe(30 * 60_000);
  });
});

describe('finishing and cancelling', () => {
  async function workoutWithMixedSets() {
    const w = await startEmptyWorkout(db, T0);
    const [squat, curl] = await addExercisesToWorkout(db, w.id, [
      exerciseIdFor('back-squat'),
      exerciseIdFor('barbell-curl'),
    ]);
    const [a, b, c] = await liveSets(squat!.id);
    await updateSet(db, a!.id, { weightKg: 100, reps: 5 });
    await completeSet(db, a!.id);
    await updateSet(db, b!.id, { weightKg: 100, reps: 5 }); // typed, not confirmed
    void c; // left empty
    return { w, squat: squat!, curl: curl! };
  }

  it('reports what is unfinished', async () => {
    const { w } = await workoutWithMixedSets();
    expect(await finishCheck(db, w.id)).toEqual({
      completedSets: 1,
      unconfirmedSets: 1,
      emptySets: 4,
    });
  });

  it('drops unconfirmed and empty sets and empty exercises by default', async () => {
    const { w, squat, curl } = await workoutWithMixedSets();
    const done = await finishWorkout(db, w.id, { now: at(50) });
    expect(done).toMatchObject({ status: 'completed', endedAt: at(50).toISOString() });
    expect((await liveSets(squat.id)).map((s) => s.order)).toEqual([0]);
    expect((await db.workoutExercises.get(curl.id))?.deletedAt).not.toBeNull();
  });

  it('can keep typed sets by marking them done', async () => {
    const { w, squat } = await workoutWithMixedSets();
    await finishWorkout(db, w.id, { keepUnconfirmed: true, now: at(50) });
    const sets = await liveSets(squat.id);
    expect(sets).toHaveLength(2);
    expect(sets.every((s) => s.completedAt !== null)).toBe(true);
  });

  it('refuses to finish with nothing done, and finishing twice changes nothing', async () => {
    const w = await startEmptyWorkout(db, T0);
    await addExercisesToWorkout(db, w.id, [exerciseIdFor('back-squat')]);
    await expect(finishWorkout(db, w.id)).rejects.toThrow('No sets are marked done');
    expect((await db.workouts.get(w.id))?.status).toBe('in_progress');

    const { w: w2 } = await (async () => {
      await cancelWorkout(db, w.id);
      return workoutWithMixedSets();
    })();
    const first = await finishWorkout(db, w2.id, { now: at(50) });
    const second = await finishWorkout(db, w2.id, { now: at(90) });
    expect(second.endedAt).toBe(first.endedAt);
  });

  it('cancelling discards the workout everywhere', async () => {
    const { w } = await workoutWithMixedSets();
    await cancelWorkout(db, w.id);
    expect(await getActiveWorkout(db)).toBeNull();
    const data = await loadTrainingData(db);
    expect(data.workouts.find((x) => x.id === w.id)).toBeUndefined();
    expect(data.sets.some((s) => s.workoutId === w.id)).toBe(false);
  });
});

describe('persistence', () => {
  it('an in-progress workout survives closing and reopening the database', async () => {
    const { day } = await pushDay();
    const w = await startWorkoutFromDay(db, day.id, T0);
    const [we] = await liveExercises(w.id);
    const [s] = await liveSets(we!.id);
    await updateSet(db, s!.id, { weightKg: 80, reps: 8 });
    await completeSet(db, s!.id);
    const name = db.name;
    db.close();

    db = new WorkoutDatabase(name);
    await db.open();
    const active = await getActiveWorkout(db);
    expect(active?.id).toBe(w.id);
    expect(await db.sets.get(s!.id)).toMatchObject({ weightKg: 80, reps: 8 });
    expect((await db.sets.get(s!.id))?.completedAt).not.toBeNull();
  });
});

describe('previous performance', () => {
  it('shows the last completed session for the exercise, never the current workout', async () => {
    await loadDemoData(db, T0);
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('barbell-bench-press')]);
    const sets = await liveSets(we!.id);
    await updateSet(db, sets[0]!.id, { weightKg: 999, reps: 1 });
    await completeSet(db, sets[0]!.id);

    const data = await loadTrainingData(db);
    const prev = previousPerformance(data, exerciseIdFor('barbell-bench-press'), w.startedAt, w.id);
    expect(prev).not.toBeNull();
    expect(prev!.workout.id).not.toBe(w.id);
    expect(prev!.workout.status).toBe('completed');
    expect(prev!.sets.every((s) => s.completedAt !== null && s.weightKg !== 999)).toBe(true);
    const lastBench = data.workouts
      .filter((x) => x.status === 'completed' && x.name === 'Push')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    expect(prev!.workout.id).toBe(lastBench!.id);
  });

  it('lines up today’s sets with last time’s by set type and position', async () => {
    await loadDemoData(db, T0);
    const data = await loadTrainingData(db);
    const prev = previousPerformance(data, exerciseIdFor('barbell-bench-press'), T0.toISOString())!;
    const prevWorking = prev.sets.filter((s) => s.setType === 'working');
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('barbell-bench-press')]);
    const today = await liveSets(we!.id);
    const s = suggestFor(prev.sets, today, today[1]!.id)!;
    expect(s.weightKg).toBe(prevWorking[1]!.weightKg);
    expect(s.reps).toBe(prevWorking[1]!.reps);
  });

  it('with no history, suggests the set completed just above', async () => {
    const w = await startEmptyWorkout(db, T0);
    const [we] = await addExercisesToWorkout(db, w.id, [exerciseIdFor('pec-deck')]);
    const [a, b] = await liveSets(we!.id);
    expect(suggestFor([], await liveSets(we!.id), b!.id)).toBeNull();
    await updateSet(db, a!.id, { weightKg: 50, reps: 12 });
    await completeSet(db, a!.id);
    expect(suggestFor([], await liveSets(we!.id), b!.id)).toMatchObject({ weightKg: 50, reps: 12 });
  });
});
