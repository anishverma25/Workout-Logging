import type { WorkoutDatabase } from '../db';
import { getMeta, META_KEYS, setMeta } from '../repositories/meta';
import { ensureSystemExercises } from '../repositories/training';
import { generateDemoDataset } from './generate';

/**
 * The single entry point for demo data. Every screen reads the same tables,
 * so Home, History, PRs, analytics and insights all reflect one coherent dataset.
 *
 * Demo records are tagged origin: 'demo'. Clearing removes only those records,
 * never real user data or the built-in exercise library.
 */

export interface DemoStatus {
  loaded: boolean;
  loadedAt: string | null;
  workouts: number;
}

export async function getDemoStatus(db: WorkoutDatabase): Promise<DemoStatus> {
  const workouts = await db.workouts.where('origin').equals('demo').count();
  const profiles = await db.profiles.where('origin').equals('demo').count();
  const loadedAt = (await getMeta<string>(db, META_KEYS.demoLoadedAt)) ?? null;
  return { loaded: workouts + profiles > 0, loadedAt, workouts };
}

/** Loads the demo dataset relative to `now`. Does nothing if demo data is already present. */
export async function loadDemoData(
  db: WorkoutDatabase,
  now: Date = new Date(),
): Promise<DemoStatus> {
  // Accounts only ever hold the person's own training.
  if (db.syncEnabled) throw new Error('Demo data is only available without an account.');
  const status = await getDemoStatus(db);
  if (status.loaded) return status;
  const data = generateDemoDataset(now);
  await db.transaction('rw', [...db.domainTables, db.meta], async () => {
    await ensureSystemExercises(db);
    await db.profiles.put(data.profile);
    await db.routines.bulkPut(data.routines);
    await db.routineDays.bulkPut(data.routineDays);
    await db.routineExercises.bulkPut(data.routineExercises);
    await db.workouts.bulkPut(data.workouts);
    await db.workoutExercises.bulkPut(data.workoutExercises);
    await db.sets.bulkPut(data.sets);
    await db.bodyWeights.bulkPut(data.bodyWeights);
    await setMeta(db, META_KEYS.demoLoadedAt, now.toISOString());
  });
  return getDemoStatus(db);
}

/** Removes every demo record. Real data and the exercise library are untouched. */
export async function clearDemoData(db: WorkoutDatabase): Promise<void> {
  await db.transaction('rw', [...db.domainTables, db.meta], async () => {
    for (const table of db.domainTables) {
      await table.where('origin').equals('demo').delete();
    }
    await db.meta.delete(META_KEYS.demoLoadedAt);
  });
}

/** Clears and regenerates demo data so it lines up with today's date again. */
export async function resetDemoData(
  db: WorkoutDatabase,
  now: Date = new Date(),
): Promise<DemoStatus> {
  await clearDemoData(db);
  return loadDemoData(db, now);
}

/**
 * First-run behaviour in development: load demo data once on an empty database.
 * The decision is remembered, so clearing demo data is respected on later visits.
 */
export async function autoloadDemoIfFirstRun(db: WorkoutDatabase, enabled: boolean): Promise<void> {
  await ensureSystemExercises(db);
  if (!enabled) return;
  if (await getMeta<boolean>(db, META_KEYS.demoAutoloadHandled)) return;
  const userWorkouts = await db.workouts.where('origin').equals('user').count();
  if (userWorkouts === 0) await loadDemoData(db);
  await setMeta(db, META_KEYS.demoAutoloadHandled, true);
}
