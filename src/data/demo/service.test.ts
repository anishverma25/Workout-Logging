import { WorkoutDatabase } from '../db';
import { SYSTEM_EXERCISES } from '../library/exercises';
import {
  autoloadDemoIfFirstRun,
  clearDemoData,
  getDemoStatus,
  loadDemoData,
  resetDemoData,
} from './service';

let db: WorkoutDatabase;
let n = 0;

beforeEach(async () => {
  db = new WorkoutDatabase(`test-${++n}`);
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

const NOW = new Date(2026, 9, 5, 16, 40);

describe('demo data service', () => {
  it('loads a complete dataset', async () => {
    const status = await loadDemoData(db, NOW);
    expect(status.loaded).toBe(true);
    expect(status.workouts).toBeGreaterThan(20);
    expect(await db.sets.count()).toBeGreaterThan(400);
    expect(await db.exercises.count()).toBe(SYSTEM_EXERCISES.length);
  });

  it('is idempotent when loaded twice', async () => {
    await loadDemoData(db, NOW);
    const sets = await db.sets.count();
    await loadDemoData(db, NOW);
    expect(await db.sets.count()).toBe(sets);
  });

  it('clears demo records but keeps the library and real data', async () => {
    await loadDemoData(db, NOW);
    const realWorkout = {
      ...(await db.workouts.toCollection().first())!,
      id: '99999999-9999-4999-8999-999999999999',
      origin: 'user' as const,
    };
    await db.workouts.put(realWorkout);

    await clearDemoData(db);

    expect((await getDemoStatus(db)).loaded).toBe(false);
    expect(await db.sets.count()).toBe(0);
    expect(await db.profiles.count()).toBe(0);
    expect(await db.exercises.count()).toBe(SYSTEM_EXERCISES.length);
    expect(await db.workouts.get(realWorkout.id)).toBeDefined();
  });

  it('reset regenerates the same dataset for the same day', async () => {
    await loadDemoData(db, NOW);
    const before = (await db.workouts.toArray()).map((w) => w.id).sort();
    await resetDemoData(db, NOW);
    const after = (await db.workouts.toArray()).map((w) => w.id).sort();
    expect(after).toEqual(before);
  });

  it('auto-loads only once, so clearing is respected', async () => {
    await autoloadDemoIfFirstRun(db, true);
    expect((await getDemoStatus(db)).loaded).toBe(true);
    await clearDemoData(db);
    await autoloadDemoIfFirstRun(db, true);
    expect((await getDemoStatus(db)).loaded).toBe(false);
  });

  it('does not auto-load when disabled', async () => {
    await autoloadDemoIfFirstRun(db, false);
    expect((await getDemoStatus(db)).loaded).toBe(false);
    expect(await db.exercises.count()).toBe(SYSTEM_EXERCISES.length);
  });
});
