import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/models/schemas';
import type { TrainingData } from '@/domain/analytics/sessions';
import { db } from './db';
import { getDemoStatus, type DemoStatus } from './demo/service';
import { getPreferences } from './repositories/meta';
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
