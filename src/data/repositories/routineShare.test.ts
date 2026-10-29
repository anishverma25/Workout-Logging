import {
  decodeRoutine,
  encodeRoutine,
  shareLink,
  type SharedRoutine,
} from '@/domain/routines/share';
import { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import { createCustomExercise } from './exercises';
import { addSharedRoutine, routineToShare, saveWorkoutAsRoutine } from './routineShare';
import { createRoutineFromTemplate, setSlotBySide, updateSlotAngle } from './routines';
import { ensureSystemExercises } from './training';
import {
  addExercisesToWorkout,
  completeSet,
  finishWorkout,
  startEmptyWorkout,
  updateSet,
} from './workouts';

let db: WorkoutDatabase;
let other: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`share-a-${++n}`);
  other = new WorkoutDatabase(`share-b-${n}`);
  await db.open();
  await other.open();
  await ensureSystemExercises(db);
  await ensureSystemExercises(other);
});
afterEach(async () => {
  await db.delete();
  await other.delete();
});

const slotsOf = async (d: WorkoutDatabase, routineId: string) => {
  const days = (await d.routineDays.where('routineId').equals(routineId).toArray())
    .filter((x) => x.deletedAt === null)
    .sort((a, b) => a.order - b.order);
  const out = [];
  for (const day of days) {
    const slots = (await d.routineExercises.where('routineDayId').equals(day.id).toArray())
      .filter((x) => x.deletedAt === null)
      .sort((a, b) => a.order - b.order);
    out.push({ day, slots });
  }
  return out;
};

describe('sharing a routine', () => {
  it('goes through a link and arrives the same in another account', async () => {
    const r = await createRoutineFromTemplate(db, 'ppl');
    const [first] = await slotsOf(db, r.id);
    await updateSlotAngle(db, first!.slots[0]!.id, 30);
    await setSlotBySide(db, first!.slots[1]!.id, true);
    const mine = await createCustomExercise(db, {
      name: 'Landmine press',
      primaryMuscle: 'shoulders',
      secondaryMuscles: ['chest'],
      equipment: 'barbell',
      category: 'compound',
      trackingType: 'weight_reps',
      loadMode: 'total',
      instructions: null,
    });
    await db.routineExercises.put({
      ...first!.slots[0]!,
      id: crypto.randomUUID(),
      exerciseId: mine.id,
      order: 99,
    });

    const shared = await routineToShare(db, r.id);
    const link = shareLink('https://overloadgym.in', shared);
    expect(link).toMatch(/^https:\/\/overloadgym\.in\/r#[A-Za-z0-9_-]+$/);
    // Short enough for any chat app.
    expect(link.length).toBeLessThan(3000);
    const received = decodeRoutine(link.split('#')[1]!)!;
    expect(received).toEqual(shared);

    const { routine, missing } = await addSharedRoutine(other, received);
    expect(missing).toBe(0);
    expect(routine.name).toBe(r.name);
    expect(routine.isActive).toBe(true);
    const a = await slotsOf(db, r.id);
    const b = await slotsOf(other, routine.id);
    expect(b.map((x) => x.day.name)).toEqual(a.map((x) => x.day.name));
    const pick = (s: (typeof a)[number]['slots'][number]) => [
      s.targetSets,
      s.repMin,
      s.repMax,
      s.targetRir,
      s.restSeconds,
      s.angleDeg ?? null,
      s.bySide ?? null,
    ];
    expect(b[0]!.slots.map(pick)).toEqual(a[0]!.slots.map(pick));
    // The sender's own exercise is made in the new account, once.
    const made = (await other.exercises.toArray()).filter((e) => e.name === 'Landmine press');
    expect(made).toHaveLength(1);
    expect(made[0]!.isCustom).toBe(true);
    await addSharedRoutine(other, received);
    expect(
      (await other.exercises.toArray()).filter((e) => e.name === 'Landmine press'),
    ).toHaveLength(1);
  });

  it('a damaged or cut-off link is refused, never half imported', () => {
    const code = encodeRoutine({
      v: 1,
      name: 'Upper lower',
      days: [{ name: 'Upper', weekdays: [1], exercises: [] }],
    });
    expect(decodeRoutine(code)).not.toBeNull();
    expect(decodeRoutine(code.slice(0, -6))).toBeNull();
    expect(decodeRoutine('not a routine!')).toBeNull();
    expect(decodeRoutine('')).toBeNull();
  });

  it('leaves out exercises a newer version of the app added, and says how many', async () => {
    const shared: SharedRoutine = {
      v: 1,
      name: 'From the future',
      days: [
        {
          name: 'Day 1',
          weekdays: [],
          exercises: [
            { key: 'box-squat', sets: 3, repMin: 5, repMax: 8, rir: 2, rest: 180 },
            { key: 'hover-press-3000', sets: 3, repMin: 8, repMax: 12, rir: 1, rest: 90 },
          ],
        },
      ],
    };
    const { routine, missing } = await addSharedRoutine(other, shared);
    expect(missing).toBe(1);
    const [day] = await slotsOf(other, routine.id);
    expect(day!.slots.map((s) => s.exerciseId)).toEqual([exerciseIdFor('box-squat')]);
  });
});

describe('a workout as a routine', () => {
  it('an empty workout becomes a routine day with the sets and reps that were done', async () => {
    const t0 = new Date(2026, 9, 20, 18, 0, 0);
    const w = await startEmptyWorkout(db, t0);
    const [bench, curl] = await addExercisesToWorkout(db, w.id, [
      exerciseIdFor('barbell-bench-press'),
      exerciseIdFor('one-arm-cable-curl'),
    ]);
    const benchSets = (await db.sets.where('workoutExerciseId').equals(bench!.id).toArray()).sort(
      (a, b) => a.order - b.order,
    );
    for (const [i, reps] of [8, 6, 7].entries()) {
      await updateSet(db, benchSets[i]!.id, { weightKg: 80, reps });
      await completeSet(db, benchSets[i]!.id, null, new Date(t0.getTime() + i * 60_000));
    }
    const curlSet = (await db.sets.where('workoutExerciseId').equals(curl!.id).toArray())[0]!;
    await updateSet(db, curlSet.id, { weightKg: 10, repsLeft: 12, repsRight: 10 });
    await completeSet(db, curlSet.id, null, new Date(t0.getTime() + 5 * 60_000));
    await finishWorkout(db, w.id, { now: new Date(t0.getTime() + 30 * 60_000) });

    const { routine, day } = await saveWorkoutAsRoutine(db, w.id, { kind: 'new', name: 'Push A' });
    expect(routine.name).toBe('Push A');
    const [saved] = await slotsOf(db, routine.id);
    expect(saved!.day.id).toBe(day.id);
    expect(saved!.slots.map((s) => [s.exerciseId, s.targetSets, s.repMin, s.repMax])).toEqual([
      [exerciseIdFor('barbell-bench-press'), 3, 6, 8],
      [exerciseIdFor('one-arm-cable-curl'), 1, 10, 10],
    ]);

    // Or as one more day of a routine that already exists.
    const r = await createRoutineFromTemplate(db, 'ppl');
    const before = (await slotsOf(db, r.id)).length;
    await saveWorkoutAsRoutine(db, w.id, { kind: 'day', routineId: r.id });
    const after = await slotsOf(db, r.id);
    expect(after).toHaveLength(before + 1);
    expect(after.at(-1)!.day.name).toBe(w.name);
  });
});
