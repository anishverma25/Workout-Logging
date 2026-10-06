import { toDateKey } from '@/lib/dates';
import { WorkoutDatabase } from '../db';
import { addGoal, deleteGoal, GoalError, markGoalAchieved, updateGoal } from './goals';
import {
  addMeasurement,
  deleteMeasurement,
  MeasurementError,
  updateMeasurement,
} from './measurements';
import { exerciseIdFor } from '../library/exercises';

let db: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`measure-${++n}`, { syncEnabled: true });
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

const NOW = new Date(2026, 9, 5, 19, 30);
const today = toDateKey(NOW);
const BENCH = exerciseIdFor('barbell-bench-press');

describe('body measurements', () => {
  it('stores centimetres, converts inches and rounds to a millimetre', async () => {
    const a = await addMeasurement(
      db,
      { values: { waistCm: 32 }, unit: 'in', bodyFatPct: null, date: today, note: null },
      NOW,
    );
    expect(a.waistCm).toBe(81.3);
    expect(a.neckCm).toBeNull();
    const b = await addMeasurement(
      db,
      {
        values: { waistCm: 80.04, armCm: 35.06 },
        unit: 'cm',
        bodyFatPct: 14.25,
        date: today,
        note: ' morning ',
      },
      NOW,
    );
    expect(b).toMatchObject({ waistCm: 80, armCm: 35.1, bodyFatPct: 14.3, note: 'morning' });
    // Queued for the account in the same transaction.
    expect(await db.outbox.count()).toBe(2);
  });

  it('needs at least one value and rejects implausible ones', async () => {
    const base = { unit: 'cm' as const, bodyFatPct: null, date: today, note: null };
    await expect(addMeasurement(db, { ...base, values: {} }, NOW)).rejects.toThrow(
      MeasurementError,
    );
    await expect(addMeasurement(db, { ...base, values: { waistCm: 8 } }, NOW)).rejects.toThrow(
      /Waist looks off/,
    );
    await expect(addMeasurement(db, { ...base, values: {}, bodyFatPct: 90 }, NOW)).rejects.toThrow(
      /body fat/,
    );
    await expect(
      addMeasurement(db, { ...base, values: { waistCm: 80 }, date: '2030-01-01' }, NOW),
    ).rejects.toThrow(/future/);
  });

  it('edits and soft deletes', async () => {
    const a = await addMeasurement(
      db,
      { values: { waistCm: 82 }, unit: 'cm', bodyFatPct: null, date: today, note: null },
      NOW,
    );
    await updateMeasurement(
      db,
      a.id,
      {
        values: { waistCm: 81, neckCm: 38 },
        unit: 'cm',
        bodyFatPct: null,
        date: today,
        note: null,
      },
      NOW,
    );
    expect(await db.bodyMeasurements.get(a.id)).toMatchObject({ waistCm: 81, neckCm: 38 });
    await deleteMeasurement(db, a.id);
    expect((await db.bodyMeasurements.get(a.id))?.deletedAt).not.toBeNull();
  });
});

describe('goals', () => {
  it('adds a lift goal and a body weight goal', async () => {
    const lift = await addGoal(
      db,
      {
        kind: 'exercise_e1rm',
        exerciseId: BENCH,
        targetValue: 100,
        startValue: 87.46,
        targetDate: '2027-01-31',
      },
      NOW,
    );
    expect(lift).toMatchObject({ targetValue: 100, startValue: 87.5, achievedAt: null });
    const weight = await addGoal(
      db,
      { kind: 'body_weight', exerciseId: null, targetValue: 72, startValue: 75, targetDate: null },
      NOW,
    );
    expect(weight.kind).toBe('body_weight');
  });

  it('rejects goals that do not make sense', async () => {
    const lift = {
      kind: 'exercise_load' as const,
      exerciseId: BENCH,
      targetValue: 100,
      startValue: null,
      targetDate: null,
    };
    await expect(addGoal(db, { ...lift, exerciseId: null }, NOW)).rejects.toThrow(GoalError);
    await expect(addGoal(db, { ...lift, startValue: 110 }, NOW)).rejects.toThrow(/above/);
    await expect(addGoal(db, { ...lift, targetDate: '2026-01-01' }, NOW)).rejects.toThrow(/future/);
    await expect(
      addGoal(db, { ...lift, kind: 'body_weight', exerciseId: BENCH }, NOW),
    ).rejects.toThrow(GoalError);
  });

  it('records the first time a goal is reached, and a new target resets it', async () => {
    const g = await addGoal(
      db,
      {
        kind: 'exercise_load',
        exerciseId: BENCH,
        targetValue: 100,
        startValue: 90,
        targetDate: null,
      },
      NOW,
    );
    const first = new Date(2026, 9, 6);
    await markGoalAchieved(db, g.id, first);
    await markGoalAchieved(db, g.id, new Date(2026, 9, 9));
    expect((await db.goals.get(g.id))?.achievedAt).toBe(first.toISOString());
    await updateGoal(
      db,
      g.id,
      {
        kind: 'exercise_load',
        exerciseId: BENCH,
        targetValue: 110,
        startValue: 100,
        targetDate: null,
      },
      NOW,
    );
    expect((await db.goals.get(g.id))?.achievedAt).toBeNull();
    await deleteGoal(db, g.id);
    expect((await db.goals.get(g.id))?.deletedAt).not.toBeNull();
  });
});
