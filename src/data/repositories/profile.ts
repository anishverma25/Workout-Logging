import { Profile } from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, putRecords } from './write';

export interface ProfileInput {
  displayName: string;
  birthDate: string | null;
  goal: Profile['goal'];
  experience: Profile['experience'];
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
  const fields = { ...input, displayName };
  return db.transaction('rw', [db.profiles, db.outbox], async () => {
    const current = await ownProfile(db);
    if (current) return (await patchRecord<Profile>(db, 'profiles', current.id, fields))!;
    const profile = Profile.parse({ ...newRecordMeta('user', now.toISOString()), ...fields });
    await putRecords(db, 'profiles', [profile]);
    return profile;
  });
}
