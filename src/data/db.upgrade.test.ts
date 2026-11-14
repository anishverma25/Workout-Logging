import Dexie from 'dexie';
import { onUpgradedElsewhere, switchDatabase, WorkoutDatabase } from './db';

/**
 * Batch 18 (S3, S4): every older database opens with today's code with all its rows, and a
 * database at today's version still works for the previous app version (an update rolled back).
 *
 * The store definitions below are copied from db.ts history. They must never change: they are
 * what phones out there actually have.
 */
const HISTORY: Record<string, string | null>[] = [
  {
    profiles: 'id, origin',
    exercises: 'id, name, primaryMuscle, origin',
    routines: 'id, origin',
    routineDays: 'id, routineId, origin',
    routineExercises: 'id, routineDayId, exerciseId, origin',
    workouts: 'id, startedAt, status, routineDayId, origin',
    workoutExercises: 'id, workoutId, exerciseId, origin',
    sets: 'id, workoutId, workoutExerciseId, exerciseId, origin',
    bodyWeights: 'id, measuredAt, origin',
    meta: 'key',
  },
  { outbox: 'id, table, queuedAt' },
  { bodyMeasurements: 'id, measuredAt, origin', goals: 'id, origin' },
  { foodLogs: 'id, date, foodId, origin', customFoods: 'id, origin' },
  { waterLogs: 'id, date, origin', activityLogs: 'id, date, kind, origin' },
  { planItems: 'id, kind, status, origin' },
];
const CURRENT = HISTORY.length;

/** A database as an app at `version` would have made it. */
function oldDatabase(name: string, version: number) {
  const old = new Dexie(name);
  for (let v = 1; v <= version; v++) old.version(v).stores(HISTORY[v - 1]!);
  return old;
}

const at = '2026-09-01T10:00:00.000Z';
const base = { createdAt: at, updatedAt: at, deletedAt: null, origin: 'user' };

/** A few rows in every table that version had. */
async function fill(old: Dexie, version: number) {
  await old.table('profiles').put({ id: 'p1', name: 'Asha', ...base });
  await old.table('workouts').put({
    id: 'w1',
    startedAt: at,
    endedAt: at,
    status: 'completed',
    routineDayId: null,
    name: 'Push',
    ...base,
  });
  await old.table('sets').put({
    id: 's1',
    workoutId: 'w1',
    workoutExerciseId: 'we1',
    exerciseId: 'e1',
    weightKg: 60,
    reps: 5,
    ...base,
  });
  await old.table('bodyWeights').put({ id: 'b1', measuredAt: at, weightKg: 80, ...base });
  await old.table('meta').put({ key: 'sync.cursor.workouts', value: { ts: at, id: 'w1' } });
  if (version >= 2)
    await old.table('outbox').put({ id: 'workouts:w1', table: 'workouts', queuedAt: at });
  if (version >= 3) await old.table('goals').put({ id: 'g1', ...base });
  if (version >= 4)
    await old.table('foodLogs').put({ id: 'f1', date: '2026-09-01', foodId: 'roti', ...base });
  if (version >= 5) await old.table('waterLogs').put({ id: 'h1', date: '2026-09-01', ...base });
}

describe('database upgrades keep every row', () => {
  it('the history above matches today’s schema', async () => {
    const db = new WorkoutDatabase(`upgrade-shape-${Math.random()}`);
    await db.open();
    expect(db.verno).toBe(CURRENT);
    const expected = new Set(HISTORY.flatMap((h) => Object.keys(h)));
    expect(new Set(db.tables.map((t) => t.name))).toEqual(expected);
    await db.delete();
  });

  for (let version = 1; version < CURRENT; version++) {
    it(`opens a version ${version} database with today’s code`, async () => {
      const name = `upgrade-v${version}-${Math.random()}`;
      const old = oldDatabase(name, version);
      await old.open();
      await fill(old, version);
      old.close();

      const db = new WorkoutDatabase(name);
      await db.open();
      expect(db.verno).toBe(CURRENT);
      expect(await db.profiles.get('p1')).toMatchObject({ name: 'Asha' });
      expect(await db.sets.get('s1')).toMatchObject({ weightKg: 60, reps: 5 });
      expect(await db.bodyWeights.get('b1')).toMatchObject({ weightKg: 80 });
      expect(await db.meta.get('sync.cursor.workouts')).toBeTruthy();
      expect(await db.workouts.get('w1')).toMatchObject({ name: 'Push' });
      // The v2 upgrade gave workouts from version 1 their pause fields.
      if (version === 1)
        expect(await db.workouts.get('w1')).toMatchObject({ pausedAt: null, pausedMs: 0 });
      if (version >= 2) expect(await db.outbox.count()).toBe(1);
      if (version >= 3) expect(await db.goals.count()).toBe(1);
      if (version >= 4) expect(await db.foodLogs.count()).toBe(1);
      if (version >= 5) expect(await db.waterLogs.count()).toBe(1);
      // Tables added later exist and work.
      await db.planItems.put({ id: 'pi1', kind: 'event', status: 'active', ...base } as never);
      expect(await db.planItems.count()).toBe(1);
      await db.delete();
    });
  }

  it('the previous app version still reads and writes today’s database (rollback)', async () => {
    const name = `upgrade-rollback-${Math.random()}`;
    const today = new WorkoutDatabase(name);
    await today.open();
    await today.bodyWeights.put({ id: 'b1', measuredAt: at, weightKg: 80, ...base } as never);
    today.close();

    const previous = oldDatabase(name, CURRENT - 1);
    await previous.open();
    expect(await previous.table('bodyWeights').get('b1')).toMatchObject({ weightKg: 80 });
    await previous.table('bodyWeights').put({ id: 'b2', measuredAt: at, weightKg: 81, ...base });
    expect(await previous.table('bodyWeights').count()).toBe(2);
    previous.close();

    const again = new WorkoutDatabase(name);
    await again.open();
    expect(await again.bodyWeights.count()).toBe(2);
    await again.delete();
  });
});

describe('an upgrade in another tab (S3)', () => {
  it('tells this tab to reload, and only for the open database', async () => {
    const name = `upgrade-tab-${Math.random()}`;
    const active = switchDatabase(name);
    await active.open();
    let told = 0;
    const off = onUpgradedElsewhere(() => told++);

    // Another tab's newer code opens the same database one version up.
    const newer = oldDatabase(name, CURRENT);
    newer.version(CURRENT + 1).stores({ extra: 'id' });
    await newer.open();
    expect(told).toBe(1);
    expect(active.isOpen()).toBe(false);
    newer.close();
    off();
    await Dexie.delete(name);
    switchDatabase('overload');
  });
});
