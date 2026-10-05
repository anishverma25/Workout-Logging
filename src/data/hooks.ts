import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES, type Exercise, type Preferences } from '@/domain/models/schemas';
import { exerciseUsage, type ExerciseUsage } from '@/domain/exercises/search';
import type { TrainingData } from '@/domain/analytics/sessions';
import { db } from './db';
import { getDemoStatus, type DemoStatus } from './demo/service';
import { getPreferences, getRestTimer } from './repositories/meta';
import { getActiveWorkout } from './repositories/workouts';
import {
  loadActiveWorkoutView,
  loadWorkoutView,
  type WorkoutView,
} from './repositories/workoutView';
import { loadTrainingData } from './repositories/training';

export type QueryState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

/**
 * Subscribes to a Dexie live query. Re-runs automatically when any table it read changes,
 * so every screen updates the moment demo data is loaded, cleared or a set is logged.
 */
export function useLiveData<T>(query: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (data) => setState({ status: 'success', data, error: undefined }),
      error: (err: unknown) =>
        setState({
          status: 'error',
          data: undefined,
          error: err instanceof Error ? err : new Error(String(err)),
        }),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const useTrainingData = () => useLiveData<TrainingData>(() => loadTrainingData(db));
export const useDemoStatus = () => useLiveData<DemoStatus>(() => getDemoStatus(db));

export function usePreferences(): Preferences {
  const state = useLiveData<Preferences>(() => getPreferences(db));
  return state.data ?? DEFAULT_PREFERENCES;
}

export interface ExerciseCatalog {
  exercises: Exercise[];
  usage: ExerciseUsage[];
}

/** The exercise library plus when each exercise was last used. Lighter than useTrainingData. */
export const useExerciseCatalog = () =>
  useLiveData<ExerciseCatalog>(async () => {
    const [exercises, workouts, workoutExercises] = await Promise.all([
      db.exercises.toArray(),
      db.workouts.toArray(),
      db.workoutExercises.toArray(),
    ]);
    return {
      exercises: exercises.filter((e) => e.deletedAt === null),
      usage: exerciseUsage(workouts, workoutExercises),
    };
  });

export const useActiveWorkoutView = () =>
  useLiveData<WorkoutView | null>(() => loadActiveWorkoutView(db));

export const useWorkoutView = (workoutId: string | undefined) =>
  useLiveData<WorkoutView | null>(
    async () => (workoutId ? loadWorkoutView(db, workoutId) : null),
    [workoutId],
  );

/** Only the id and start of the workout in progress: cheap enough for the app shell. */
export const useActiveWorkout = () => useLiveData(() => getActiveWorkout(db));

export const useRestTimer = () => useLiveData(() => getRestTimer(db));
