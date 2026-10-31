import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import type { TrainingData } from '@/domain/analytics/sessions';
import type { SetType, Workout, WorkoutExercise, WorkoutSet } from '@/domain/models/schemas';

let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};
const meta = (at = '2026-01-01T00:00:00.000Z') => ({
  createdAt: at,
  updatedAt: at,
  deletedAt: null,
  origin: 'user' as const,
});

export interface SetSpec {
  w: number | null;
  r: number;
  type?: SetType;
  done?: boolean;
  rir?: number;
}

export interface SessionSpec {
  at: string;
  exercises: { key: string; sets: SetSpec[] }[];
  routineId?: string | null;
  routineDayId?: string | null;
  name?: string;
  minutes?: number;
  pausedMinutes?: number;
}

/** Builds TrainingData from compact session descriptions. */
export function buildData(specs: SessionSpec[]): TrainingData {
  const workouts: Workout[] = [];
  const workoutExercises: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];
  for (const spec of specs) {
    const workoutId = uuid();
    const end = new Date(
      Date.parse(spec.at) + ((spec.minutes ?? 60) + (spec.pausedMinutes ?? 0)) * 60_000,
    ).toISOString();
    workouts.push({
      id: workoutId,
      ...meta(spec.at),
      name: spec.name ?? 'Session',
      routineId: spec.routineId ?? null,
      routineDayId: spec.routineDayId ?? null,
      status: 'completed',
      startedAt: spec.at,
      endedAt: end,
      pausedAt: null,
      pausedMs: (spec.pausedMinutes ?? 0) * 60_000,
      notes: null,
      timeZone: 'UTC',
    });
    spec.exercises.forEach((ex, order) => {
      const exerciseId = exerciseIdFor(ex.key);
      const weId = uuid();
      workoutExercises.push({
        id: weId,
        ...meta(spec.at),
        workoutId,
        exerciseId,
        exerciseName: ex.key,
        order,
        notes: null,
        target: null,
      });
      ex.sets.forEach((s, i) => {
        sets.push({
          id: uuid(),
          ...meta(spec.at),
          workoutId,
          workoutExerciseId: weId,
          exerciseId,
          order: i,
          setType: s.type ?? 'working',
          weightKg: s.w,
          reps: s.r,
          rir: s.rir ?? null,
          rpe: null,
          durationSec: null,
          distanceM: null,
          completedAt: s.done === false ? null : spec.at,
          notes: null,
        });
      });
    });
  }
  return {
    profile: null,
    exercises: SYSTEM_EXERCISES,
    routines: [],
    routineDays: [],
    routineExercises: [],
    workouts,
    workoutExercises,
    sets,
    bodyWeights: [],
    measurements: [],
    goals: [],
  };
}

export const BENCH = exerciseIdFor('barbell-bench-press');
export const PULL_UP = exerciseIdFor('pull-up');
export const CURL = exerciseIdFor('dumbbell-curl');
