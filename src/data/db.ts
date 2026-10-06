import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyMeasurement,
  BodyWeightEntry,
  Exercise,
  Profile,
  Routine,
  RoutineDay,
  RoutineExercise,
  TrainingGoal,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/models/schemas';

/** Key-value records for app state that is not domain data (preferences, demo flags, timer). */
export interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

/** Names of tables that hold synced domain records. */
export type DomainTable =
  | 'profiles'
  | 'exercises'
  | 'routines'
  | 'routineDays'
  | 'routineExercises'
  | 'workouts'
  | 'workoutExercises'
  | 'sets'
  | 'bodyWeights'
  | 'bodyMeasurements'
  | 'goals';

/** What the outbox can hold: domain records, plus the preferences stored in meta. */
export type SyncTable = DomainTable | 'preferences';

/**
 * A pending change waiting to reach the server. One entry per record: a newer local change
 * replaces the older entry (same id), so a record is never sent twice for the same state.
 */
export interface OutboxEntry {
  /** `${table}:${recordId}` */
  id: string;
  table: SyncTable;
  recordId: string;
  /** updatedAt of the record when queued; used to detect newer local edits during a push. */
  recordUpdatedAt: string;
  queuedAt: string;
  attempts: number;
  lastError: string | null;
}

/**
 * Local-first database (IndexedDB via Dexie). This is the source of truth on the device:
 * every user action is saved here first, so data survives refreshes, closing the app and
 * going offline. Cloud sync reads the outbox and pushes changes when possible.
 *
 * Each signed-in account gets its own database. The guest database holds local-only use
 * and the demo, so demo data can never leak into an account.
 *
 * Schema changes must add a new version with a migration, never edit an existing version.
 */
export class WorkoutDatabase extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineDays!: EntityTable<RoutineDay, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  bodyWeights!: EntityTable<BodyWeightEntry, 'id'>;
  bodyMeasurements!: EntityTable<BodyMeasurement, 'id'>;
  goals!: EntityTable<TrainingGoal, 'id'>;
  meta!: EntityTable<MetaRecord, 'key'>;
  outbox!: EntityTable<OutboxEntry, 'id'>;

  /** True for account databases. Writes are queued for the server only when this is set. */
  readonly syncEnabled: boolean;

  constructor(name = GUEST_DB_NAME, options: { syncEnabled?: boolean } = {}) {
    super(name);
    this.syncEnabled = options.syncEnabled ?? false;
    this.version(1).stores({
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
    });
    // v2: pause tracking on workouts, and the sync outbox.
    this.version(2)
      .stores({ outbox: 'id, table, queuedAt' })
      .upgrade((tx) =>
        tx
          .table('workouts')
          .toCollection()
          .modify((w: Partial<Workout>) => {
            if (w.pausedAt === undefined) w.pausedAt = null;
            if (w.pausedMs === undefined) w.pausedMs = 0;
          }),
      );
    // v3: body measurements and goals. New profile, workout and superset fields are optional,
    // so older records stay valid as they are.
    this.version(3).stores({
      bodyMeasurements: 'id, measuredAt, origin',
      goals: 'id, origin',
    });
  }

  /** Tables that hold origin-tagged domain records. */
  get domainTables() {
    return [
      this.profiles,
      this.exercises,
      this.routines,
      this.routineDays,
      this.routineExercises,
      this.workouts,
      this.workoutExercises,
      this.sets,
      this.bodyWeights,
      this.bodyMeasurements,
      this.goals,
    ] as const;
  }
}

export const GUEST_DB_NAME = 'overload';
export const accountDbName = (userId: string) => `overload-user-${userId}`;

/**
 * The active database. An ES module live binding: after `switchDatabase`, every importer
 * sees the new instance. The app remounts its tree on switch so live queries re-subscribe.
 */
export let db = new WorkoutDatabase(GUEST_DB_NAME);

const switchListeners = new Set<(db: WorkoutDatabase) => void>();

export function switchDatabase(
  name: string,
  options: { syncEnabled?: boolean } = {},
): WorkoutDatabase {
  if (db.name === name && db.syncEnabled === (options.syncEnabled ?? false)) return db;
  db.close();
  db = new WorkoutDatabase(name, options);
  switchListeners.forEach((l) => l(db));
  return db;
}

export function onDatabaseSwitch(listener: (db: WorkoutDatabase) => void): () => void {
  switchListeners.add(listener);
  return () => switchListeners.delete(listener);
}

let guestHandle: WorkoutDatabase | null = null;

/**
 * The guest (device-only) database, even while an account database is active. Used to offer
 * moving device data into an account. Never synced.
 */
export function guestDatabase(): WorkoutDatabase {
  if (db.name === GUEST_DB_NAME) return db;
  guestHandle ??= new WorkoutDatabase(GUEST_DB_NAME);
  return guestHandle;
}
