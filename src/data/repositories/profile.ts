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
