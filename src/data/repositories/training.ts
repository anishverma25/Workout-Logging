import type { TrainingData } from '@/domain/analytics/sessions';
import type { Profile } from '@/domain/models/schemas';
import { SYSTEM_EXERCISES } from '../library/exercises';
import type { WorkoutDatabase } from '../db';

const alive = <T extends { deletedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

/** The profile to show: the person's own most recent one, else the demo athlete's. */
export function pickProfile(profiles: Profile[]): Profile | null {
  const live = alive(profiles);
  const own = live
    .filter((p) => p.origin === 'user')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return own[0] ?? live[0] ?? null;
}

/**
 * Reads everything the dashboard and analytics need in one transaction.
 * A single user's history (thousands of sets) is small enough to load at once;
 * if that changes, this is the one place to switch to windowed queries.
 */
export async function loadTrainingData(db: WorkoutDatabase): Promise<TrainingData> {
  return db.transaction(
    'r',
    [
      db.profiles,
      db.exercises,
      db.routines,
      db.routineDays,
      db.routineExercises,
      db.workouts,
      db.workoutExercises,
      db.sets,
      db.bodyWeights,
      db.bodyMeasurements,
      db.goals,
    ],
    async () => {
      const [
        profiles,
        exercises,
        routines,
        routineDays,
        routineExercises,
        workouts,
        workoutExercises,
        sets,
        bodyWeights,
        measurements,
        goals,
      ] = await Promise.all([
        db.profiles.toArray(),
        db.exercises.toArray(),
        db.routines.toArray(),
        db.routineDays.toArray(),
        db.routineExercises.toArray(),
        db.workouts.toArray(),
        db.workoutExercises.toArray(),
        db.sets.toArray(),
        db.bodyWeights.toArray(),
        db.bodyMeasurements.toArray(),
        db.goals.toArray(),
      ]);
      const profile = pickProfile(profiles);
      return {
        profile,
        exercises: alive(exercises),
        routines: alive(routines),
        routineDays: alive(routineDays),
        routineExercises: alive(routineExercises),
        workouts: alive(workouts),
        workoutExercises: alive(workoutExercises),
        sets: alive(sets),
        bodyWeights: alive(bodyWeights),
        measurements: alive(measurements),
        goals: alive(goals),
      };
    },
  );
}

/** Built-in exercises are written with fixed ids and timestamps, so this is idempotent. */
export async function ensureSystemExercises(db: WorkoutDatabase): Promise<void> {
  await db.exercises.bulkPut(SYSTEM_EXERCISES);
}
