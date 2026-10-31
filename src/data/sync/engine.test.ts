import { createTestServer, type TestServer } from '@/test/server';
import { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import { addBodyWeight, deleteBodyWeight } from '../repositories/bodyweight';
import { createCustomExercise } from '../repositories/exercises';
import { getPreferences, updatePreferences } from '../repositories/meta';
import { createRoutineFromTemplate, updateRoutine } from '../repositories/routines';
import { ensureSystemExercises, loadTrainingData } from '../repositories/training';
import {
  addExercisesToWorkout,
  addSet,
  completeSet,
  finishWorkout,
  startEmptyWorkout,
  updateSet,
} from '../repositories/workouts';
import { MAX_ATTEMPTS, outboxCounts, pull, push, retryRejected, syncOnce } from './engine';
import { RemoteError } from './remote';

let server: TestServer;
let userA: string;
let userB: string;
let n = 0;
const open: WorkoutDatabase[] = [];

async function device(): Promise<WorkoutDatabase> {
  const db = new WorkoutDatabase(`sync-${++n}`, { syncEnabled: true });
  await db.open();
  await ensureSystemExercises(db);
  open.push(db);
  return db;
}

async function logWorkout(db: WorkoutDatabase, weightKg = 100) {
  const workout = await startEmptyWorkout(db, new Date('2026-09-01T10:00:00Z'));
  const [we] = await addExercisesToWorkout(db, workout.id, [exerciseIdFor('barbell-bench-press')]);
  const existing = await db.sets.where('workoutExerciseId').equals(we!.id).toArray();
  const set = existing[0] ?? (await addSet(db, we!.id));
  await updateSet(db, set.id, { weightKg, reps: 5 });
  await completeSet(db, set.id);
  await finishWorkout(db, workout.id, {
    keepUnconfirmed: false,
    now: new Date('2026-09-01T11:00:00Z'),
  });
  return workout;
}

async function serverCount(table: string, userId: string) {
  const r = await server.pg.query<{ n: number }>(
    `select count(*)::int as n from public.${table} where user_id = $1`,
    [userId],
  );
  return r.rows[0]!.n;
}

beforeAll(async () => {
  server = await createTestServer();
  userA = await server.createUser('a@example.com');
  userB = await server.createUser('b@example.com');
}, 30_000);

afterAll(async () => {
  for (const db of open) await db.delete();
  await server.close();
});

describe('sync engine', () => {
  it('queues local changes and removes them only after the server confirms', async () => {
    const db = await device();
    const remote = server.remoteFor(userA);
    await logWorkout(db);
    const before = await outboxCounts(db);
    expect(before.pending).toBeGreaterThan(0);

    remote.offline = true;
    await expect(push(db, remote, userA)).rejects.toBeInstanceOf(RemoteError);
    // Nothing confirmed, so nothing leaves the queue and the workout stays on the device.
    expect((await outboxCounts(db)).pending).toBe(before.pending);
    expect(await db.workouts.count()).toBe(1);

    remote.offline = false;
    const result = await syncOnce(db, remote, userA);
    expect(result.pushed).toBe(before.pending);
    expect((await outboxCounts(db)).pending).toBe(0);
    expect(await serverCount('sets', userA)).toBeGreaterThan(0);
  });

  it('never creates duplicates when the same changes are sent again', async () => {
    const db = await device();
    const remote = server.remoteFor(userA);
    const workout = await logWorkout(db);
    const queued = await db.outbox.toArray();
    await push(db, remote, userA);
    const counts = await Promise.all(
      ['workouts', 'workout_exercises', 'sets'].map((t) => serverCount(t, userA)),
    );

    // Simulate a lost confirmation: the same entries are queued and pushed again.
    await db.outbox.bulkPut(queued);
    await push(db, remote, userA);
    await push(db, remote, userA);
    const after = await Promise.all(
      ['workouts', 'workout_exercises', 'sets'].map((t) => serverCount(t, userA)),
    );
    expect(after).toEqual(counts);
    const row = await server.pg.query('select 1 from public.workouts where id = $1', [workout.id]);
    expect(row.rows).toHaveLength(1);
  });

  it('brings a workout from one device to another', async () => {
    const phone = await device();
    const laptop = await device();
    const remote = server.remoteFor(userA);
    const workout = await logWorkout(phone, 102.5);
    await syncOnce(phone, remote, userA);
    await syncOnce(laptop, remote, userA);

    const data = await loadTrainingData(laptop);
    const synced = data.workouts.find((w) => w.id === workout.id);
    expect(synced?.status).toBe('completed');
    const sets = data.sets.filter((s) => s.workoutId === workout.id);
    expect(sets.some((s) => s.weightKg === 102.5 && s.reps === 5)).toBe(true);
    // Pulled records are not queued to go back to the server.
    expect((await outboxCounts(laptop)).pending).toBe(0);
  });

  it('syncs custom exercises, routines, body weight and preferences', async () => {
    const phone = await device();
    const laptop = await device();
    const remote = server.remoteFor(userA);
    const custom = await createCustomExercise(phone, {
      name: 'Sync test press',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'machine',
      category: 'compound',
      trackingType: 'weight_reps',
      loadMode: 'total',
      instructions: null,
    });
    const routine = await createRoutineFromTemplate(phone, 'ppl', 'Sync PPL');
    await addBodyWeight(phone, { weight: 176, unit: 'lb', date: '2026-09-01', note: null });
    await updatePreferences(phone, { weightUnit: 'lb', defaultRestSeconds: 150 });
    await syncOnce(phone, remote, userA);
    await syncOnce(laptop, remote, userA);

    expect((await laptop.exercises.get(custom.id))?.isCustom).toBe(true);
    expect((await laptop.routines.get(routine.id))?.name).toBe('Sync PPL');
    expect(await laptop.routineDays.where('routineId').equals(routine.id).count()).toBeGreaterThan(
      0,
    );
    const bw = await laptop.bodyWeights.toArray();
    // Exact kilograms survive the round trip, so 176 lb still reads as 176 lb.
    expect(bw.some((b) => Math.abs(b.weightKg - 79.832) < 0.001)).toBe(true);
    expect(await getPreferences(laptop)).toMatchObject({
      weightUnit: 'lb',
      defaultRestSeconds: 150,
    });
  });

  it('resolves conflicts by keeping the newer change on every device', async () => {
    const phone = await device();
    const laptop = await device();
    const remote = server.remoteFor(userA);
    const routine = await createRoutineFromTemplate(phone, 'upper-lower', 'Conflict');
    await syncOnce(phone, remote, userA);
    await syncOnce(laptop, remote, userA);

    // Both edit offline. The laptop's edit happens later.
    await updateRoutine(phone, routine.id, { name: 'From phone', description: null });
    await new Promise((r) => setTimeout(r, 5));
    await updateRoutine(laptop, routine.id, { name: 'From laptop', description: null });

    // The newer edit reaches the server first; the older one must not overwrite it.
    await syncOnce(laptop, remote, userA);
    await syncOnce(phone, remote, userA);
    await syncOnce(laptop, remote, userA);

    expect((await phone.routines.get(routine.id))?.name).toBe('From laptop');
    expect((await laptop.routines.get(routine.id))?.name).toBe('From laptop');
    const row = await server.pg.query<{ name: string }>(
      'select name from public.routines where id = $1',
      [routine.id],
    );
    expect(row.rows[0]!.name).toBe('From laptop');
    expect((await outboxCounts(phone)).pending).toBe(0);
  });

  it('carries deletions to other devices', async () => {
    const phone = await device();
    const laptop = await device();
    const remote = server.remoteFor(userA);
    const entry = await addBodyWeight(phone, {
      weight: 81,
      unit: 'kg',
      date: '2026-09-02',
      note: null,
    });
    await syncOnce(phone, remote, userA);
    await syncOnce(laptop, remote, userA);
    expect((await laptop.bodyWeights.get(entry.id))?.deletedAt).toBeNull();

    await deleteBodyWeight(phone, entry.id);
    await syncOnce(phone, remote, userA);
    await syncOnce(laptop, remote, userA);
    expect((await laptop.bodyWeights.get(entry.id))?.deletedAt).not.toBeNull();
  });

  it('keeps an edit made while a push was in flight', async () => {
    const db = await device();
    const remote = server.remoteFor(userA);
    const entry = await addBodyWeight(db, {
      weight: 80,
      unit: 'kg',
      date: '2026-09-03',
      note: null,
    });
    const originalUpsert = remote.upsert.bind(remote);
    let edited = false;
    remote.upsert = async (table, rows) => {
      await originalUpsert(table, rows);
      if (table === 'body_weight' && !edited) {
        edited = true;
        // The person edits the entry after it was sent but before the confirmation arrives.
        await db.bodyWeights.update(entry.id, {
          note: 'edited',
          updatedAt: new Date(Date.now() + 1000).toISOString(),
        });
        const e = (await db.outbox.get(`bodyWeights:${entry.id}`))!;
        await db.outbox.put({
          ...e,
          recordUpdatedAt: (await db.bodyWeights.get(entry.id))!.updatedAt,
        });
      }
    };
    await push(db, remote, userA);
    // The newer edit is still queued, so it will be sent next time.
    expect(await db.outbox.get(`bodyWeights:${entry.id}`)).toBeDefined();
    remote.upsert = originalUpsert;
    await push(db, remote, userA);
    expect(await db.outbox.get(`bodyWeights:${entry.id}`)).toBeUndefined();
    const row = await server.pg.query<{ note: string }>(
      'select note from public.body_weight where id = $1',
      [entry.id],
    );
    expect(row.rows[0]!.note).toBe('edited');
  });

  it('sets aside a change the server refuses without blocking the others', async () => {
    const db = await device();
    const remote = server.remoteFor(userA);
    const good = await addBodyWeight(db, {
      weight: 82,
      unit: 'kg',
      date: '2026-09-04',
      note: null,
    });
    const bad = await addBodyWeight(db, { weight: 83, unit: 'kg', date: '2026-09-05', note: null });
    // Corrupt one record locally so the database check constraint rejects it.
    await db.bodyWeights.update(bad.id, { weightKg: 5 });

    for (let i = 0; i < MAX_ATTEMPTS; i++) await push(db, remote, userA);
    expect(await serverCount('body_weight', userA)).toBeGreaterThan(0);
    const goodRow = await server.pg.query('select 1 from public.body_weight where id = $1', [
      good.id,
    ]);
    expect(goodRow.rows).toHaveLength(1);
    const counts = await outboxCounts(db);
    expect(counts.rejected).toBe(1);
    const entry = await db.outbox.get(`bodyWeights:${bad.id}`);
    expect(entry?.lastError).toMatch(/check constraint/);

    // Set aside means not retried automatically, until the person asks.
    const calls = remote.calls;
    await push(db, remote, userA);
    expect(remote.calls).toBe(calls);
    await retryRejected(db);
    expect((await outboxCounts(db)).rejected).toBe(0);
  });

  it('never sends demo or built-in records', async () => {
    const db = await device();
    const remote = server.remoteFor(userB);
    const routine = await createRoutineFromTemplate(db, 'ppl', 'Demo-ish');
    await db.routines.update(routine.id, { origin: 'demo' });
    await push(db, remote, userB);
    expect(await serverCount('routines', userB)).toBe(0);
  });

  it('keeps each account to its own data', async () => {
    const a = await device();
    const b = await device();
    await logWorkout(a);
    await syncOnce(a, server.remoteFor(userA), userA);
    await syncOnce(b, server.remoteFor(userB), userB);
    expect(await b.workouts.count()).toBe(0);
    // Even a device that tries to push A's records as B cannot touch A's rows.
    const workout = (await a.workouts.toArray())[0]!;
    await b.workouts.put({
      ...workout,
      name: 'Taken over',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await b.outbox.put({
      id: `workouts:${workout.id}`,
      table: 'workouts',
      recordId: workout.id,
      recordUpdatedAt: new Date().toISOString(),
      queuedAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    });
    const result = await push(b, server.remoteFor(userB), userB);
    expect(result.rejected).toBe(1);
    const row = await server.pg.query<{ name: string; user_id: string }>(
      'select name, user_id from public.workouts where id = $1',
      [workout.id],
    );
    expect(row.rows[0]).toMatchObject({ user_id: userA });
    expect(row.rows[0]!.name).not.toBe('Taken over');
  });

  it('pulls in pages and resumes from its cursor', async () => {
    const phone = await device();
    const laptop = await device();
    const remote = server.remoteFor(userB);
    for (let d = 1; d <= 12; d++) {
      await addBodyWeight(phone, {
        weight: 70 + d / 10,
        unit: 'kg',
        date: `2026-08-${String(d).padStart(2, '0')}`,
        note: null,
      });
    }
    await syncOnce(phone, remote, userB);
    const first = await pull(laptop, remote);
    expect(first).toBe(12);
    // A second pull only re-reads the small overlap window and saves nothing new.
    expect(await pull(laptop, remote)).toBe(0);
  });
});
