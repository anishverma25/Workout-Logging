import type { Table } from 'dexie';
import type { DomainTable, WorkoutDatabase } from '../db';
import { getMeta, META_KEYS, setMeta } from '../repositories/meta';
import { putRecords, type SyncedRecord } from '../repositories/write';

/**
 * Moving data logged without an account into an account, on the same device.
 *
 * - Only the person's own records (origin 'user') are copied. Demo data and the built-in
 *   library never are.
 * - It only happens when the person chooses it. Nothing is merged silently.
 * - The device-only copy is left exactly as it was. Nothing is deleted.
 * - Copies keep their ids, so running it twice changes nothing.
 */

export const MIGRATION_META_KEY = 'migration.copiedTo';

export interface GuestDataSummary {
  workouts: number;
  routines: number;
  customExercises: number;
  bodyWeights: number;
  measurements: number;
  hasActiveWorkout: boolean;
}

const live = <T extends SyncedRecord>(records: T[]) =>
  records.filter((r) => r.origin === 'user' && r.deletedAt === null);

export async function summarizeGuestData(guest: WorkoutDatabase): Promise<GuestDataSummary> {
  const workouts = live(await guest.workouts.where('origin').equals('user').toArray());
  return {
    workouts: workouts.filter((w) => w.status === 'completed').length,
    routines: live(await guest.routines.where('origin').equals('user').toArray()).length,
    customExercises: live(await guest.exercises.where('origin').equals('user').toArray()).length,
    bodyWeights: live(await guest.bodyWeights.where('origin').equals('user').toArray()).length,
    measurements: live(await guest.bodyMeasurements.where('origin').equals('user').toArray())
      .length,
    hasActiveWorkout: workouts.some((w) => w.status === 'in_progress'),
  };
}

export const hasGuestData = (s: GuestDataSummary) =>
  s.workouts + s.routines + s.customExercises + s.bodyWeights + s.measurements > 0 ||
  s.hasActiveWorkout;

/** Whether the person already answered the import question for this account. */
export async function migrationHandled(guest: WorkoutDatabase, userId: string): Promise<boolean> {
  const handled = (await getMeta<Record<string, string>>(guest, MIGRATION_META_KEY)) ?? {};
  return userId in handled;
}

export async function markMigrationHandled(
  guest: WorkoutDatabase,
  userId: string,
  choice: 'copied' | 'skipped',
): Promise<void> {
  const handled = (await getMeta<Record<string, string>>(guest, MIGRATION_META_KEY)) ?? {};
  await setMeta(guest, MIGRATION_META_KEY, {
    ...handled,
    [userId]: `${choice}:${new Date().toISOString()}`,
  });
}

export interface MigrationResult {
  copied: number;
  /** Records the account already had in the same or a newer version. */
  unchanged: number;
  /** The device's unfinished workout was left out because the account has one open already. */
  skippedActiveWorkout: boolean;
}

/** Copies the person's own guest records into the account database, parents first. */
export async function copyGuestData(
  guest: WorkoutDatabase,
  account: WorkoutDatabase,
): Promise<MigrationResult> {
  const own = async <T extends SyncedRecord>(table: DomainTable) =>
    (await (guest.table(table) as Table<T>).where('origin').equals('user').toArray()) as T[];

  const exercises = await own<SyncedRecord>('exercises');
  const routines = await own<SyncedRecord>('routines');
  const routineIds = new Set(routines.map((r) => r.id));
  // A day added to a demo routine cannot come along without its routine.
  const days = (await own<SyncedRecord & { routineId: string }>('routineDays')).filter((d) =>
    routineIds.has(d.routineId),
  );
  const dayIds = new Set(days.map((d) => d.id));
  const slots = (await own<SyncedRecord & { routineDayId: string }>('routineExercises')).filter(
    (s) => dayIds.has(s.routineDayId),
  );

  let workouts = await own<SyncedRecord & { status: string }>('workouts');
  const accountActive = await account.workouts.where('status').equals('in_progress').toArray();
  const guestActive = workouts.find((w) => w.status === 'in_progress' && w.deletedAt === null);
  const skippedActiveWorkout =
    !!guestActive && accountActive.some((w) => w.deletedAt === null && w.id !== guestActive.id);
  if (skippedActiveWorkout) workouts = workouts.filter((w) => w.id !== guestActive!.id);
  const workoutIds = new Set(workouts.map((w) => w.id));
  const workoutExercises = (
    await own<SyncedRecord & { workoutId: string }>('workoutExercises')
  ).filter((we) => workoutIds.has(we.workoutId));
  const weIds = new Set(workoutExercises.map((we) => we.id));
  const sets = (await own<SyncedRecord & { workoutExerciseId: string }>('sets')).filter((s) =>
    weIds.has(s.workoutExerciseId),
  );
  const bodyWeights = await own<SyncedRecord>('bodyWeights');
  const measurements = await own<SyncedRecord>('bodyMeasurements');
  const profiles = await own<SyncedRecord>('profiles');
  const exerciseIds = new Set([
    ...(await account.exercises.toCollection().primaryKeys()),
    ...exercises.map((e) => e.id),
  ]);
  // A goal on a demo-only exercise cannot come along without it.
  const goals = (await own<SyncedRecord & { exerciseId: string | null }>('goals')).filter(
    (g) => g.exerciseId === null || exerciseIds.has(g.exerciseId),
  );

  const plan: [DomainTable, SyncedRecord[]][] = [
    ['profiles', profiles],
    ['exercises', exercises],
    ['routines', routines],
    ['routineDays', days],
    ['routineExercises', slots],
    ['workouts', workouts],
    ['workoutExercises', workoutExercises],
    ['sets', sets],
    ['bodyWeights', bodyWeights],
    ['bodyMeasurements', measurements],
    ['goals', goals],
  ];

  // Read before the account transaction: awaiting another database inside it would end it.
  const guestPrefs = await guest.meta.get(META_KEYS.preferences);

  let copied = 0;
  let unchanged = 0;
  await account.transaction(
    'rw',
    [...account.domainTables, account.outbox, account.meta],
    async () => {
      for (const [table, records] of plan) {
        const t = account.table(table) as Table<SyncedRecord>;
        const existing = await t.bulkGet(records.map((r) => r.id));
        const toCopy = records.filter((r, i) => {
          const current = existing[i];
          return !current || current.updatedAt < r.updatedAt;
        });
        unchanged += records.length - toCopy.length;
        // Through the write path, so every copied record is queued for the account.
        await putRecords(account, table, toCopy);
        copied += toCopy.length;
      }
      // Keep the units and timer settings the person chose, unless the account has its own.
      const accountPrefs = await account.meta.get(META_KEYS.preferences);
      if (guestPrefs && !accountPrefs) {
        await account.meta.put(guestPrefs);
        if (account.syncEnabled) {
          await account.outbox.put({
            id: 'preferences:preferences',
            table: 'preferences',
            recordId: 'preferences',
            recordUpdatedAt: guestPrefs.updatedAt,
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: null,
          });
        }
      }
    },
  );
  return { copied, unchanged, skippedActiveWorkout };
}
