import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyWeightEntry,
  Exercise,
  Profile,
  Routine,
  RoutineDay,
  RoutineExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/models/schemas';

/** Key-value records for app state that is not domain data (preferences, demo flags). */
export interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

/**
 * Local-first database (IndexedDB via Dexie). This is the source of truth on the device:
 * every user action is saved here first, so data survives refreshes, closing the app and
 * going offline. Cloud sync (Phase 6) will read from these same tables.
 *
 * Schema changes must add a new version with a migration, never edit version 1 in place.
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
  meta!: EntityTable<MetaRecord, 'key'>;

  constructor(name = 'overload') {
    super(name);
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
    ] as const;
  }
}

export const db = new WorkoutDatabase();
