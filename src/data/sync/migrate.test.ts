import { WorkoutDatabase } from '../db';
import { loadDemoData } from '../demo/service';
import { exerciseIdFor } from '../library/exercises';
import { addBodyWeight } from '../repositories/bodyweight';
import { createCustomExercise } from '../repositories/exercises';
import { getPreferences, updatePreferences } from '../repositories/meta';
import { addExercisesToDay, createRoutineFromTemplate } from '../repositories/routines';
import { ensureSystemExercises } from '../repositories/training';
import { addExercisesToWorkout, startEmptyWorkout } from '../repositories/workouts';
import {
  copyGuestData,
  hasGuestData,
  markMigrationHandled,
  migrationHandled,
  summarizeGuestData,
} from './migrate';

let guest: WorkoutDatabase;
let account: WorkoutDatabase;
let n = 0;

beforeEach(async () => {
  n++;
  guest = new WorkoutDatabase(`guest-${n}`);
  account = new WorkoutDatabase(`account-${n}`, { syncEnabled: true });
  await guest.open();
  await account.open();
  await ensureSystemExercises(guest);
  await ensureSystemExercises(account);
});

afterEach(async () => {
  await guest.delete();
  await account.delete();
});

async function snapshot(db: WorkoutDatabase) {
  const out: Record<string, unknown[]> = {};
  for (const t of db.domainTables) out[t.name] = await t.toArray();
  return out;
}

describe('moving device data into an account', () => {
  it('reports nothing to move for an empty or demo-only device', async () => {
    expect(hasGuestData(await summarizeGuestData(guest))).toBe(false);
    await loadDemoData(guest);
    expect(hasGuestData(await summarizeGuestData(guest))).toBe(false);
  });

  it('copies only the person’s own records and queues them for the account', async () => {
    await loadDemoData(guest);
    const routine = await createRoutineFromTemplate(guest, 'ppl', 'Mine');
    await createCustomExercise(guest, {
      name: 'Own move',
      primaryMuscle: 'back',
      secondaryMuscles: [],
      equipment: 'cable',
      category: 'isolation',
      trackingType: 'weight_reps',
      loadMode: 'total',
      instructions: null,
    });
    await addBodyWeight(guest, { weight: 80, unit: 'kg', date: '2026-09-01', note: null });
    await updatePreferences(guest, { weightUnit: 'lb' });
    const summary = await summarizeGuestData(guest);
    expect(summary).toMatchObject({ routines: 1, customExercises: 1, bodyWeights: 1 });

    const result = await copyGuestData(guest, account);
    expect(result.copied).toBeGreaterThan(3);
    expect(await account.routines.get(routine.id)).toBeDefined();
    expect(await account.workouts.where('origin').equals('demo').count()).toBe(0);
    expect(await account.profiles.where('origin').equals('demo').count()).toBe(0);
    expect(await account.exercises.where('origin').equals('user').count()).toBe(1);
    expect((await getPreferences(account)).weightUnit).toBe('lb');
    // Everything copied is waiting to reach the server.
    expect(await account.outbox.count()).toBe(result.copied + 1);
  });

  it('never changes or deletes the device copy', async () => {
    await createRoutineFromTemplate(guest, 'full-body', 'Mine');
    await addBodyWeight(guest, { weight: 80, unit: 'kg', date: '2026-09-01', note: null });
    const before = await snapshot(guest);
    await copyGuestData(guest, account);
    expect(await snapshot(guest)).toEqual(before);
  });

  it('is safe to run twice', async () => {
    await createRoutineFromTemplate(guest, 'full-body', 'Mine');
    const first = await copyGuestData(guest, account);
    const second = await copyGuestData(guest, account);
    expect(second.copied).toBe(0);
    expect(second.unchanged).toBe(first.copied);
    expect(await account.routines.count()).toBe(1);
  });

  it('keeps a newer version already in the account', async () => {
    const routine = await createRoutineFromTemplate(guest, 'full-body', 'Old name');
    await copyGuestData(guest, account);
    await account.routines.update(routine.id, {
      name: 'Renamed in account',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await copyGuestData(guest, account);
    expect((await account.routines.get(routine.id))?.name).toBe('Renamed in account');
  });

  it('leaves out records whose parent is demo data', async () => {
    await loadDemoData(guest);
    const demoDay = (await guest.routineDays.where('origin').equals('demo').first())!;
    await addExercisesToDay(guest, demoDay.id, [exerciseIdFor('pull-up')]);
    await copyGuestData(guest, account);
    expect(await account.routineExercises.count()).toBe(0);
  });

  it('does not open a second workout when the account already has one', async () => {
    const accountWorkout = await startEmptyWorkout(account);
    const guestWorkout = await startEmptyWorkout(guest);
    await addExercisesToWorkout(guest, guestWorkout.id, [exerciseIdFor('pull-up')]);
    expect((await summarizeGuestData(guest)).hasActiveWorkout).toBe(true);
    const result = await copyGuestData(guest, account);
    expect(result.skippedActiveWorkout).toBe(true);
    const open = await account.workouts.where('status').equals('in_progress').toArray();
    expect(open.map((w) => w.id)).toEqual([accountWorkout.id]);
    expect(await account.workoutExercises.where('workoutId').equals(guestWorkout.id).count()).toBe(
      0,
    );
  });

  it('remembers the choice per account', async () => {
    expect(await migrationHandled(guest, 'user-1')).toBe(false);
    await markMigrationHandled(guest, 'user-1', 'skipped');
    expect(await migrationHandled(guest, 'user-1')).toBe(true);
    expect(await migrationHandled(guest, 'user-2')).toBe(false);
  });
});
