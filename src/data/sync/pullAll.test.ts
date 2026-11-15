import { createTestServer, type TestServer } from '@/test/server';
import { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import { addBodyWeight, deleteBodyWeight } from '../repositories/bodyweight';
import { ensureSystemExercises } from '../repositories/training';
import {
  addExercisesToWorkout,
  addSet,
  completeSet,
  finishWorkout,
  startEmptyWorkout,
  updateSet,
} from '../repositories/workouts';
import { PULL_ALL_PAGE, pull, syncOnce } from './engine';
import { META_KEYS } from '../repositories/meta';

/**
 * Batch 3: one request for a whole pull (`sync_pull`, migration 0031). Whatever the route,
 * the phone must end up with the same rows and the same cursors.
 */
let server: TestServer;
let userA: string;
let userB: string;
let n = 0;
const open: WorkoutDatabase[] = [];

async function device(): Promise<WorkoutDatabase> {
  const db = new WorkoutDatabase(`pullall-${++n}`, { syncEnabled: true });
  await db.open();
  await ensureSystemExercises(db);
  open.push(db);
  return db;
}

async function logWorkout(db: WorkoutDatabase, day: number) {
  const at = `2026-09-${String(day).padStart(2, '0')}`;
  const workout = await startEmptyWorkout(db, new Date(`${at}T10:00:00Z`));
  const [we] = await addExercisesToWorkout(db, workout.id, [exerciseIdFor('barbell-bench-press')]);
  const existing = await db.sets.where('workoutExerciseId').equals(we!.id).toArray();
  const set = existing[0] ?? (await addSet(db, we!.id));
  await updateSet(db, set.id, { weightKg: 60 + day, reps: 5 });
  await completeSet(db, set.id);
  await finishWorkout(db, workout.id, { keepUnconfirmed: false, now: new Date(`${at}T11:00:00Z`) });
}

/** Everything a pull writes: the synced tables and the cursors (not the last-synced time). */
async function snapshot(db: WorkoutDatabase) {
  const byId = <T extends { id: string }>(rows: T[]) =>
    [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
  const user = <T extends { origin?: string }>(rows: T[]) =>
    rows.filter((r) => r.origin === 'user');
  const cursors = (await db.meta.toArray())
    .filter((m) => m.key.startsWith(META_KEYS.syncCursor))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((m) => ({ key: m.key, value: m.value }));
  return {
    workouts: byId(user(await db.workouts.toArray())),
    workoutExercises: byId(user(await db.workoutExercises.toArray())),
    sets: byId(user(await db.sets.toArray())),
    bodyWeights: byId(user(await db.bodyWeights.toArray())),
    cursors,
  };
}

beforeAll(async () => {
  server = await createTestServer();
  userA = await server.createUser('pa@example.com');
  userB = await server.createUser('pb@example.com');
  // User A: more body weights than one page of sync_pull, two workouts, one deletion.
  const phone = await device();
  const remote = server.remoteFor(userA);
  const start = Date.UTC(2025, 0, 1);
  for (let d = 0; d < PULL_ALL_PAGE + 30; d++) {
    const date = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
    await addBodyWeight(phone, { weight: 70 + (d % 10) / 10, unit: 'kg', date, note: null });
  }
  await logWorkout(phone, 1);
  await logWorkout(phone, 3);
  const someWeight = (await phone.bodyWeights.toArray())[5]!;
  await deleteBodyWeight(phone, someWeight.id);
  await syncOnce(phone, remote, userA);
  // User B has one row of their own.
  const other = await device();
  await addBodyWeight(other, { weight: 90, unit: 'kg', date: '2026-09-01', note: null });
  await syncOnce(other, server.remoteFor(userB), userB);
}, 120_000);

afterAll(async () => {
  for (const db of open) await db.delete();
  await server.close();
});

describe('one request pull (sync_pull)', () => {
  it('ends with the same rows and cursors as pulling table by table', async () => {
    const viaAll = await device();
    const viaTables = await device();
    const all = server.remoteFor(userA);
    const tables = server.remoteFor(userA);
    tables.hasPullAll = false;
    const pulledAll = await pull(viaAll, all);
    const pulledTables = await pull(viaTables, tables);
    expect(pulledAll).toBe(pulledTables);
    expect(pulledAll).toBeGreaterThan(PULL_ALL_PAGE);
    const a = await snapshot(viaAll);
    expect(a.bodyWeights.length).toBe(PULL_ALL_PAGE + 30);
    expect(a.bodyWeights.filter((w) => w.deletedAt).length).toBe(1);
    expect(a.workouts.length).toBe(2);
    expect(a).toEqual(await snapshot(viaTables));
    // A second pull reads only the overlap window and saves nothing new, either way.
    expect(await pull(viaAll, all)).toBe(0);
    expect(await pull(viaTables, tables)).toBe(0);
  }, 60_000);

  it('asks far fewer times than one request per table', async () => {
    const fresh = await device();
    const all = server.remoteFor(userA);
    await pull(fresh, all);
    // A page for every table, then only the body weights that filled a page.
    expect(all.calls).toBeLessThanOrEqual(3);
    // Again: the 5 s overlap re-reads rows written together, so at most one more page.
    const again = server.remoteFor(userA);
    await pull(fresh, again);
    expect(again.calls).toBeLessThanOrEqual(2);

    const tables = server.remoteFor(userA);
    tables.hasPullAll = false;
    await pull(await device(), tables);
    expect(tables.calls).toBeGreaterThan(10);
  }, 60_000);

  it('a server without sync_pull still syncs everything', async () => {
    const db = await device();
    const remote = server.remoteFor(userA);
    remote.hasPullAll = false;
    await syncOnce(db, remote, userA);
    expect((await snapshot(db)).bodyWeights.length).toBe(PULL_ALL_PAGE + 30);
  }, 60_000);

  it('returns only the caller’s own rows (row level security)', async () => {
    const db = await device();
    await pull(db, server.remoteFor(userB));
    const weights = (await snapshot(db)).bodyWeights;
    expect(weights.map((w) => w.weightKg)).toEqual([90]);
  });

  it('ignores names that are not sync tables and refuses visitors', async () => {
    const r = await server.asUser(userA, (tx) =>
      tx.query<{ r: Record<string, unknown> }>('select public.sync_pull($1, 10) as r', [
        JSON.stringify({ 'body_weights; drop table x': null, pg_class: null, nope: null }),
      ]),
    );
    expect(r.rows[0]!.r).toEqual({});
    await expect(
      server.asAnon((tx) => tx.query(`select public.sync_pull('{}'::jsonb, 10)`)),
    ).rejects.toThrow();
  });
});
