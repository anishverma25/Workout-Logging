import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES, type Exercise, type Preferences } from '@/domain/models/schemas';
import { exerciseUsage, type ExerciseUsage } from '@/domain/exercises/search';
import type { TrainingData } from '@/domain/analytics/sessions';
import { db, guestDatabase } from './db';
import { migrationHandled, summarizeGuestData, type GuestDataSummary } from './sync/migrate';
import { getDemoStatus, type DemoStatus } from './demo/service';
import {
  getDismissedSuggestions,
  getMeta,
  getPreferences,
  getRestTimer,
  META_KEYS,
} from './repositories/meta';
import { getActiveWorkout } from './repositories/workouts';
import {
  combineWorkoutView,
  loadPreviousPerformance,
  loadWorkoutCore,
  shareWorkoutCore,
  type WorkoutCore,
  type WorkoutView,
} from './repositories/workoutView';
import { loadTrainingData, pickProfile } from './repositories/training';

export type QueryState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

/**
 * Subscribes to a Dexie live query. Re-runs automatically when any table it read changes,
 * so every screen updates the moment demo data is loaded, cleared or a set is logged.
 */
export function useLiveData<T>(
  query: () => Promise<T>,
  deps: unknown[] = [],
  /** Optional structural sharing: keep parts of the previous result that did not change. */
  share?: (prev: T | undefined, next: T) => T,
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (data) =>
        setState((prev) => ({
          status: 'success',
          data: share ? share(prev.data, data) : data,
          error: undefined,
        })),
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
/** Just the profile: cheap enough for headers on every page. */
export const useProfile = () => useLiveData(async () => pickProfile(await db.profiles.toArray()));
export const useDemoStatus = () => useLiveData<DemoStatus>(() => getDemoStatus(db));

/** True once on a brand-new install, until the preview tour is finished or skipped. */
export const useTourPending = () =>
  useLiveData(async () => (await getMeta<boolean>(db, META_KEYS.tourPending)) === true);

/** Whether the founding member welcome was already shown for this account. */
export const useFoundingWelcomed = () =>
  useLiveData(async () => (await getMeta<boolean>(db, META_KEYS.foundingWelcomed)) === true);

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

/**
 * A workout with "last time" for each exercise, as two live queries: the workout itself
 * re-runs on every change (cheap), history only when the exercises or the workout change.
 * Logging a set never re-reads the past, however long it is.
 */
function useWorkoutViewFrom(core: QueryState<WorkoutCore | null>): QueryState<WorkoutView | null> {
  const c = core.data;
  const ids = c ? [...new Set(c.exercises.map((e) => e.workoutExercise.exerciseId))] : [];
  const key = c ? `${c.workout.id}|${c.workout.startedAt}|${ids.join(',')}` : '';
  const previous = useLiveData(
    async () =>
      c
        ? {
            workoutId: c.workout.id,
            map: await loadPreviousPerformance(db, ids, c.workout.startedAt, c.workout.id),
          }
        : undefined,
    [key],
  );
  if (core.status !== 'success') return core;
  if (!c) return { status: 'success', data: null, error: undefined };
  // The workout shows straight away. Each exercise's "last time" is filled in once its
  // history is loaded; a result for another workout is never used.
  const map = previous.data?.workoutId === c.workout.id ? previous.data.map : undefined;
  return { status: 'success', data: combineWorkoutView(c, map), error: undefined };
}

export const useActiveWorkoutView = () =>
  useWorkoutViewFrom(
    useLiveData<WorkoutCore | null>(
      async () => {
        const active = await getActiveWorkout(db);
        return active ? loadWorkoutCore(db, active.id) : null;
      },
      [],
      shareWorkoutCore,
    ),
  );

export const useWorkoutView = (workoutId: string | undefined) =>
  useWorkoutViewFrom(
    useLiveData<WorkoutCore | null>(
      async () => (workoutId ? loadWorkoutCore(db, workoutId) : null),
      [workoutId],
      shareWorkoutCore,
    ),
  );

/** Only the id and start of the workout in progress: cheap enough for the app shell. */
export const useActiveWorkout = () => useLiveData(() => getActiveWorkout(db));

export const useRestTimer = () => useLiveData(() => getRestTimer(db));

export function useDismissedSuggestions(): Set<string> {
  const state = useLiveData(() => getDismissedSuggestions(db));
  return new Set(state.data ?? []);
}

export interface GuestImportState {
  summary: GuestDataSummary;
  handled: boolean;
}

/** Device-only data that could be moved into the signed-in account. */
export function useGuestImport(userId: string | null) {
  return useLiveData<GuestImportState | null>(async () => {
    if (!userId) return null;
    const guest = guestDatabase();
    return {
      summary: await summarizeGuestData(guest),
      handled: await migrationHandled(guest, userId),
    };
  }, [userId]);
}
