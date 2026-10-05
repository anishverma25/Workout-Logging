import { DEFAULT_PREFERENCES, Preferences } from '@/domain/models/schemas';
import type { RestTimerState } from '@/domain/workout/restTimer';
import type { WorkoutDatabase } from '../db';

export const META_KEYS = {
  preferences: 'preferences',
  demoLoadedAt: 'demo.loadedAt',
  /** Set once the app has decided whether to auto-load demo data, so clearing it sticks. */
  demoAutoloadHandled: 'demo.autoloadHandled',
  restTimer: 'workout.restTimer',
  dismissedSuggestions: 'progress.dismissedSuggestions',
} as const;

export async function getMeta<T>(db: WorkoutDatabase, key: string): Promise<T | undefined> {
  const record = await db.meta.get(key);
  return record?.value as T | undefined;
}

export async function setMeta(db: WorkoutDatabase, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value, updatedAt: new Date().toISOString() });
}

export async function getPreferences(db: WorkoutDatabase): Promise<Preferences> {
  const stored = await getMeta<unknown>(db, META_KEYS.preferences);
  const parsed = Preferences.safeParse({
    ...DEFAULT_PREFERENCES,
    ...(stored as object | undefined),
  });
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
}

export async function updatePreferences(
  db: WorkoutDatabase,
  patch: Partial<Preferences>,
): Promise<Preferences> {
  const next = Preferences.parse({ ...(await getPreferences(db)), ...patch });
  await setMeta(db, META_KEYS.preferences, next);
  return next;
}

/** The rest timer is device state, not training data: it is never synced. */
export async function getRestTimer(db: WorkoutDatabase): Promise<RestTimerState | null> {
  return (await getMeta<RestTimerState>(db, META_KEYS.restTimer)) ?? null;
}

export async function saveRestTimer(db: WorkoutDatabase, state: RestTimerState | null) {
  if (state === null) await db.meta.delete(META_KEYS.restTimer);
  else await setMeta(db, META_KEYS.restTimer, state);
}

/** Ids of progression suggestions the person dismissed (exerciseId:workoutId). */
export async function getDismissedSuggestions(db: WorkoutDatabase): Promise<string[]> {
  return (await getMeta<string[]>(db, META_KEYS.dismissedSuggestions)) ?? [];
}

export async function dismissSuggestion(db: WorkoutDatabase, id: string): Promise<void> {
  const current = await getDismissedSuggestions(db);
  if (current.includes(id)) return;
  // Keep the list short: old sessions never come back as suggestions anyway.
  await setMeta(db, META_KEYS.dismissedSuggestions, [...current, id].slice(-200));
}
