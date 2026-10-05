import { WorkoutDatabase } from '../db';
import { loadDemoData } from '../demo/service';
import { exerciseIdFor } from '../library/exercises';
import { ROUTINE_TEMPLATES } from '../library/templates';
import { ensureSystemExercises } from './training';
import {
  addDay,
  addExercisesToDay,
  createRoutineFromTemplate,
  deleteDay,
  deleteRoutine,
  duplicateDay,
  duplicateRoutine,
  moveDay,
  moveExercise,
  removeExercise,
  renameDay,
  RoutineError,
  setActiveRoutine,
  setDayWeekdays,
  swapExercise,
  updateRoutine,
  updateTargets,
} from './routines';
import { startWorkoutFromDay } from './workouts';

let db: WorkoutDatabase;
let n = 0;

beforeEach(async () => {
  db = new WorkoutDatabase(`routines-${++n}`);
  await db.open();
  await ensureSystemExercises(db);
});
afterEach(async () => {
  await db.delete();
});

const liveDays = async (routineId: string) =>
  (await db.routineDays.where('routineId').equals(routineId).toArray())
    .filter((d) => d.deletedAt === null)
    .sort((a, b) => a.order - b.order);
const liveSlots = async (dayId: string) =>
  (await db.routineExercises.where('routineDayId').equals(dayId).toArray())
    .filter((s) => s.deletedAt === null)
    .sort((a, b) => a.order - b.order);

describe('templates', () => {
  it.each(ROUTINE_TEMPLATES.map((t) => [t.key, t]))(
    '%s creates a complete routine',
    async (_, t) => {
      const routine = await createRoutineFromTemplate(db, t.key);
      const days = await liveDays(routine.id);
      expect(days.map((d) => d.name)).toEqual(t.days.map((d) => d.name));
      for (const [i, day] of days.entries()) {
        expect((await liveSlots(day.id)).length).toBe(t.days[i]!.exercises.length);
      }
      // No weekday is planned twice in one routine.
      const weekdays = days.flatMap((d) => d.weekdays);
      expect(new Set(weekdays).size).toBe(weekdays.length);
      if (t.key !== 'custom') expect(weekdays.length).toBe(t.daysPerWeek);
    },
  );

  it('makes the first routine active and later ones inactive', async () => {
    const a = await createRoutineFromTemplate(db, 'ppl');
    const b = await createRoutineFromTemplate(db, 'upper-lower');
    expect((await db.routines.get(a.id))?.isActive).toBe(true);
    expect((await db.routines.get(b.id))?.isActive).toBe(false);
  });

  it('rejects unknown templates', async () => {
    await expect(createRoutineFromTemplate(db, 'nope')).rejects.toBeInstanceOf(RoutineError);
  });
});

describe('routine CRUD', () => {
  it('renames, validates names and switches the active routine', async () => {
    const a = await createRoutineFromTemplate(db, 'ppl');
    const b = await createRoutineFromTemplate(db, 'full-body');
    await updateRoutine(db, a.id, { name: '  My PPL ', description: 'Summer block' });
    expect((await db.routines.get(a.id))?.name).toBe('My PPL');
    await expect(updateRoutine(db, a.id, { name: '   ' })).rejects.toThrow('name');
    await setActiveRoutine(db, b.id);
    expect((await db.routines.get(a.id))?.isActive).toBe(false);
    expect((await db.routines.get(b.id))?.isActive).toBe(true);
  });

  it('duplicates a routine with new ids and identical content', async () => {
    const a = await createRoutineFromTemplate(db, 'upper-lower');
    const copy = await duplicateRoutine(db, a.id);
    expect(copy.id).not.toBe(a.id);
    expect(copy.name).toBe('Upper Lower (copy)');
    expect(copy.isActive).toBe(false);
    const [origDays, copyDays] = [await liveDays(a.id), await liveDays(copy.id)];
    expect(copyDays.map((d) => d.name)).toEqual(origDays.map((d) => d.name));
    for (const [i, d] of copyDays.entries()) {
      const o = await liveSlots(origDays[i]!.id);
      const c = await liveSlots(d.id);
      expect(c.map((s) => [s.exerciseId, s.targetSets, s.repMin, s.repMax])).toEqual(
        o.map((s) => [s.exerciseId, s.targetSets, s.repMin, s.repMax]),
      );
      expect(c.every((s) => !o.some((x) => x.id === s.id))).toBe(true);
    }
    // Editing the copy leaves the original alone.
    await updateTargets(db, (await liveSlots(copyDays[0]!.id))[0]!.id, {
      targetSets: 5,
      repMin: 3,
      repMax: 5,
      targetRir: 1,
      restSeconds: 240,
      notes: null,
    });
    expect((await liveSlots(origDays[0]!.id))[0]!.targetSets).toBe(3);
  });

  it('deletes a routine with its days and slots, and hands the active flag on', async () => {
    const a = await createRoutineFromTemplate(db, 'ppl');
    const b = await createRoutineFromTemplate(db, 'upper-lower');
    const days = await liveDays(a.id);
    await deleteRoutine(db, a.id);
    expect((await db.routines.get(a.id))?.deletedAt).not.toBeNull();
    expect(await liveDays(a.id)).toHaveLength(0);
    expect(await liveSlots(days[0]!.id)).toHaveLength(0);
    expect((await db.routines.get(b.id))?.isActive).toBe(true);
  });
});

describe('days', () => {
  it('adds, renames, reorders, duplicates and deletes days', async () => {
    const r = await createRoutineFromTemplate(db, 'custom');
    const d2 = await addDay(db, r.id);
    expect(d2.name).toBe('Day 2');
    await renameDay(db, d2.id, 'Arms');
    await moveDay(db, d2.id, -1);
    expect((await liveDays(r.id)).map((d) => d.name)).toEqual(['Arms', 'Day 1']);
    await moveDay(db, d2.id, -1); // already first: no change
    expect((await liveDays(r.id)).map((d) => d.order)).toEqual([0, 1]);

    await addExercisesToDay(db, d2.id, [exerciseIdFor('barbell-curl')]);
    const copy = await duplicateDay(db, d2.id);
    expect((await liveDays(r.id)).map((d) => d.name)).toEqual(['Arms', 'Arms (copy)', 'Day 1']);
    expect(await liveSlots(copy.id)).toHaveLength(1);

    await deleteDay(db, d2.id);
    expect((await liveDays(r.id)).map((d) => [d.name, d.order])).toEqual([
      ['Arms (copy)', 0],
      ['Day 1', 1],
    ]);
  });

  it('gives each weekday to one day only', async () => {
    const r = await createRoutineFromTemplate(db, 'ppl');
    const [push, pull] = await liveDays(r.id);
    await setDayWeekdays(db, pull!.id, [1, 2]); // Monday was Push
    const days = await liveDays(r.id);
    expect(days[0]!.weekdays).toEqual([4]);
    expect(days[1]!.weekdays).toEqual([1, 2]);
    expect(push!.id).toBe(days[0]!.id);
  });

  it('caps a routine at 7 days', async () => {
    const r = await createRoutineFromTemplate(db, 'custom');
    for (let i = 0; i < 6; i++) await addDay(db, r.id);
    await expect(addDay(db, r.id)).rejects.toThrow('7 days');
  });
});

describe('exercises in a day', () => {
  it('adds with defaults, edits targets, swaps, reorders and removes', async () => {
    const r = await createRoutineFromTemplate(db, 'custom');
    const [day] = await liveDays(r.id);
    await addExercisesToDay(db, day!.id, [
      exerciseIdFor('back-squat'),
      exerciseIdFor('leg-extension'),
      exerciseIdFor('plank'),
    ]);
    let slots = await liveSlots(day!.id);
    expect(slots.map((s) => [s.repMin, s.repMax, s.targetRir])).toEqual([
      [6, 10, 2],
      [10, 15, 1],
      [30, 60, null],
    ]);

    await updateTargets(db, slots[0]!.id, {
      targetSets: 4,
      repMin: 5,
      repMax: 8,
      targetRir: 1.5,
      restSeconds: 200,
      notes: '  pause at the bottom ',
    });
    await expect(
      updateTargets(db, slots[0]!.id, {
        targetSets: 4,
        repMin: 9,
        repMax: 8,
        targetRir: 1,
        restSeconds: 200,
        notes: null,
      }),
    ).rejects.toThrow();

    await swapExercise(db, slots[1]!.id, exerciseIdFor('hack-squat'));
    await moveExercise(db, slots[2]!.id, -1);
    slots = await liveSlots(day!.id);
    expect(slots.map((s) => s.exerciseId)).toEqual([
      exerciseIdFor('back-squat'),
      exerciseIdFor('plank'),
      exerciseIdFor('hack-squat'),
    ]);
    expect(slots[0]).toMatchObject({ targetSets: 4, repMin: 5, notes: 'pause at the bottom' });
    expect(slots[2]).toMatchObject({ repMin: 10, repMax: 15 }); // swap kept the targets

    await removeExercise(db, slots[1]!.id);
    slots = await liveSlots(day!.id);
    expect(slots.map((s) => s.order)).toEqual([0, 1]);
  });
});

describe('history stays unchanged', () => {
  it('editing, swapping, reordering and deleting a routine never touches logged workouts', async () => {
    await loadDemoData(db, new Date(2026, 9, 5, 18, 0));
    const before = {
      workouts: await db.workouts.toArray(),
      workoutExercises: await db.workoutExercises.toArray(),
      sets: await db.sets.toArray(),
    };
    const routine = (await db.routines.toArray())[0]!;
    const days = await liveDays(routine.id);
    const slots = await liveSlots(days[0]!.id);

    await updateRoutine(db, routine.id, { name: 'Renamed' });
    await renameDay(db, days[0]!.id, 'Chest day');
    await updateTargets(db, slots[0]!.id, {
      targetSets: 5,
      repMin: 1,
      repMax: 3,
      targetRir: 0,
      restSeconds: 300,
      notes: 'heavy',
    });
    await swapExercise(db, slots[1]!.id, exerciseIdFor('pec-deck'));
    await moveExercise(db, slots[2]!.id, -1);
    await removeExercise(db, slots[3]!.id);
    await moveDay(db, days[2]!.id, -1);
    await duplicateRoutine(db, routine.id);
    await deleteRoutine(db, routine.id);

    expect(await db.workouts.toArray()).toEqual(before.workouts);
    expect(await db.workoutExercises.toArray()).toEqual(before.workoutExercises);
    expect(await db.sets.toArray()).toEqual(before.sets);
  });

  it('a workout started from a routine keeps its targets after the routine changes', async () => {
    const r = await createRoutineFromTemplate(db, 'ppl');
    const [push] = await liveDays(r.id);
    const workout = await startWorkoutFromDay(db, push!.id);
    const slot = (await liveSlots(push!.id))[0]!;
    await updateTargets(db, slot.id, {
      targetSets: 6,
      repMin: 1,
      repMax: 1,
      targetRir: 0,
      restSeconds: 300,
      notes: null,
    });
    await renameDay(db, push!.id, 'Chest');
    const wes = await db.workoutExercises.where('workoutId').equals(workout.id).toArray();
    const first = wes.sort((a, b) => a.order - b.order)[0]!;
    expect(first.target).toEqual({ sets: 3, repMin: 5, repMax: 8, rir: 2, rest: 180 });
    expect((await db.workouts.get(workout.id))?.name).toBe('Push');
  });
});
