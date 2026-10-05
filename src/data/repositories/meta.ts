import { DEFAULT_PREFERENCES, Preferences } from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';

export const META_KEYS = {
  preferences: 'preferences',
  demoLoadedAt: 'demo.loadedAt',
  /** Set once the app has decided whether to auto-load demo data, so clearing it sticks. */
  demoAutoloadHandled: 'demo.autoloadHandled',
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
