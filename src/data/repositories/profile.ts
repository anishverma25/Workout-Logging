import { Profile } from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, putRecords } from './write';

export interface ProfileInput {
  displayName: string;
  birthDate: string | null;
  goal: Profile['goal'];
  experience: Profile['experience'];
  sex?: Profile['sex'];
  heightCm?: number | null;
  trainingDays?: number | null;
  sessionMinutes?: number | null;
  equipment?: Profile['equipment'];
  dailyActivity?: Profile['dailyActivity'];
  calorieTarget?: number | null;
  proteinTargetG?: number | null;
  dietType?: Profile['dietType'];
  katoriMl?: number | null;
}

export class ProfileError extends Error {}

/** The person's own profile: the most recently edited one they created (never the demo's). */
async function ownProfile(db: WorkoutDatabase): Promise<Profile | null> {
  const mine = (await db.profiles.where('origin').equals('user').toArray())
    .filter((p) => p.deletedAt === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return mine[0] ?? null;
}

/** Creates the profile on first save, then edits it. Synced like any other record. */
export async function saveProfile(
  db: WorkoutDatabase,
  input: ProfileInput,
  now: Date = new Date(),
): Promise<Profile> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new ProfileError('Enter a name.');
  if (input.birthDate) {
    const born = new Date(`${input.birthDate}T00:00:00`);
    const age = (now.getTime() - born.getTime()) / (365.25 * 86_400_000);
    if (Number.isNaN(age) || age < 13 || age > 110) throw new ProfileError('Check the birth date.');
  }
  if (input.heightCm != null && !(input.heightCm >= 100 && input.heightCm <= 250))
    throw new ProfileError('Enter a height between 100 and 250 cm.');
  if (input.trainingDays != null && !(input.trainingDays >= 1 && input.trainingDays <= 7))
    throw new ProfileError('Pick between 1 and 7 training days.');
  if (input.sessionMinutes != null && !(input.sessionMinutes >= 15 && input.sessionMinutes <= 240))
    throw new ProfileError('Pick a session length between 15 and 240 minutes.');
  if (input.calorieTarget != null && !(input.calorieTarget >= 800 && input.calorieTarget <= 8000))
    throw new ProfileError('Enter calories between 800 and 8,000 a day.');
  if (input.proteinTargetG != null && !(input.proteinTargetG >= 20 && input.proteinTargetG <= 500))
    throw new ProfileError('Enter protein between 20 and 500 g a day.');
  if (input.katoriMl != null && !(input.katoriMl >= 80 && input.katoriMl <= 500))
    throw new ProfileError('Enter a katori size between 80 and 500 ml.');
  // Fields left out keep their current value; null clears them.
  const heightCm = input.heightCm == null ? input.heightCm : Math.round(input.heightCm * 10) / 10;
  const fields = Object.fromEntries(
    Object.entries({ ...input, displayName, heightCm }).filter(([, v]) => v !== undefined),
  ) as Partial<Profile>;
  return db.transaction('rw', [db.profiles, db.outbox], async () => {
    const current = await ownProfile(db);
    if (current) return (await patchRecord<Profile>(db, 'profiles', current.id, fields))!;
    const profile = Profile.parse({ ...newRecordMeta('user', now.toISOString()), ...fields });
    await putRecords(db, 'profiles', [profile]);
    return profile;
  });
}

/** Food settings on the person's own profile: what they eat and the size of their katori. */
export async function saveFoodSettings(
  db: WorkoutDatabase,
  settings: { dietType?: Profile['dietType']; katoriMl?: number | null },
): Promise<void> {
  if (settings.katoriMl != null && !(settings.katoriMl >= 80 && settings.katoriMl <= 500))
    throw new ProfileError('Enter a katori size between 80 and 500 ml.');
  const katoriMl = settings.katoriMl == null ? settings.katoriMl : Math.round(settings.katoriMl);
  const changes = Object.fromEntries(
    Object.entries({ ...settings, katoriMl }).filter(([, v]) => v !== undefined),
  ) as Partial<Profile>;
  await db.transaction('rw', [db.profiles, db.outbox], async () => {
    const current = await ownProfile(db);
    if (!current) throw new ProfileError('Set up your profile first.');
    await patchRecord<Profile>(db, 'profiles', current.id, changes);
  });
}

export interface TargetSettings {
  targetMode?: Profile['targetMode'];
  calorieTarget?: number | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
  fibreTargetG?: number | null;
  waterTargetMl?: number | null;
  waterGlassMl?: number | null;
}

const TARGET_LIMITS: [keyof TargetSettings, number, number, string][] = [
  ['calorieTarget', 800, 8000, 'Enter calories between 800 and 8,000 a day.'],
  ['proteinTargetG', 20, 500, 'Enter protein between 20 and 500 g a day.'],
  ['carbsTargetG', 0, 1500, 'Enter carbs between 0 and 1,500 g a day.'],
  ['fatTargetG', 10, 500, 'Enter fat between 10 and 500 g a day.'],
  ['fibreTargetG', 0, 150, 'Enter fibre between 0 and 150 g a day.'],
  ['waterTargetMl', 500, 8000, 'Enter water between 500 and 8,000 ml a day.'],
  ['waterGlassMl', 100, 1000, 'Enter a glass size between 100 and 1,000 ml.'],
];

/**
 * Food and water targets on the person's own profile: the mode (calculated or their own) and
 * the numbers they typed. Fields left out keep their value; null clears one. Typed numbers stay
 * saved when the mode is calculated, so switching back brings them back.
 */
export async function saveTargetSettings(
  db: WorkoutDatabase,
  settings: TargetSettings,
): Promise<void> {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    changes[key] = typeof value === 'number' ? Math.round(value) : value;
  }
  for (const [key, lo, hi, message] of TARGET_LIMITS) {
    const v = changes[key];
    if (v != null && !(typeof v === 'number' && v >= lo && v <= hi)) throw new ProfileError(message);
  }
  await db.transaction('rw', [db.profiles, db.outbox], async () => {
    const current = await ownProfile(db);
    if (!current) throw new ProfileError('Set up your profile first.');
    await patchRecord<Profile>(db, 'profiles', current.id, changes as Partial<Profile>);
  });
}
