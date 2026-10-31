import { WorkoutDatabase } from '../db';
import { loadDemoData } from '../demo/service';
import { ProfileError, saveAvatar, saveProfile, saveTargetSettings } from './profile';
import { loadTrainingData } from './training';

let db: WorkoutDatabase;
beforeEach(async () => {
  db = new WorkoutDatabase(`profile-${Math.random()}`, { syncEnabled: true });
  await db.open();
});
afterEach(() => db.delete());

const input = {
  displayName: ' Asha ',
  birthDate: '1998-04-02',
  goal: 'strength' as const,
  experience: 'beginner' as const,
};

describe('profile', () => {
  it('creates once, then edits the same record, queued for sync', async () => {
    const first = await saveProfile(db, input);
    expect(first.displayName).toBe('Asha');
    const second = await saveProfile(db, { ...input, goal: 'hypertrophy' });
    expect(second.id).toBe(first.id);
    expect(await db.profiles.count()).toBe(1);
    expect(await db.outbox.get(`profiles:${first.id}`)).toBeDefined();
  });

  it('keeps a profile photo, syncs it, and removes it again', async () => {
    await expect(saveAvatar(db, 'data:image/jpeg;base64,AAAA')).rejects.toThrow(ProfileError);
    const mine = await saveProfile(db, input);
    await db.outbox.clear();
    await saveAvatar(db, 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect((await db.profiles.get(mine.id))!.avatar).toBe(
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    );
    expect(await db.outbox.get(`profiles:${mine.id}`)).toBeDefined();
    await saveAvatar(db, null);
    expect((await db.profiles.get(mine.id))!.avatar).toBeNull();
    // Anything that is not a small image data URL is refused.
    await expect(saveAvatar(db, 'https://example.com/me.jpg')).rejects.toThrow(ProfileError);
    await expect(saveAvatar(db, `data:image/jpeg;base64,${'A'.repeat(80_000)}`)).rejects.toThrow(
      'too large',
    );
  });

  it('never edits the demo profile, and the person’s own wins', async () => {
    // Demo data only exists in the device-only database.
    const guest = new WorkoutDatabase(`profile-guest-${Math.random()}`);
    await guest.open();
    await loadDemoData(guest);
    const mine = await saveProfile(guest, input);
    expect((await loadTrainingData(guest)).profile?.id).toBe(mine.id);
    expect(await guest.profiles.where('origin').equals('demo').count()).toBe(1);
    await guest.delete();
  });

  it('rejects an empty name or an impossible birth date', async () => {
    await expect(saveProfile(db, { ...input, displayName: '  ' })).rejects.toThrow('Enter a name');
    await expect(saveProfile(db, { ...input, birthDate: '2024-01-01' })).rejects.toThrow(
      'birth date',
    );
  });

  it('saves target settings on the profile, keeps typed numbers, and rejects bad ones', async () => {
    await expect(saveTargetSettings(db, { targetMode: 'own' })).rejects.toBeInstanceOf(
      ProfileError,
    );
    const p = await saveProfile(db, input);
    await saveTargetSettings(db, {
      targetMode: 'own',
      calorieTarget: 2400.4,
      carbsTargetG: 300,
      fatTargetG: 70,
      fibreTargetG: 35,
      waterTargetMl: 3000,
      waterGlassMl: 300,
    });
    // Switching to calculated leaves the typed numbers in place.
    await saveTargetSettings(db, { targetMode: 'calculated' });
    const saved = await db.profiles.get(p.id);
    expect(saved).toMatchObject({
      targetMode: 'calculated',
      calorieTarget: 2400,
      carbsTargetG: 300,
      waterTargetMl: 3000,
      waterGlassMl: 300,
    });
    await expect(saveTargetSettings(db, { waterTargetMl: 100 })).rejects.toThrow(/water/);
    await expect(saveTargetSettings(db, { fatTargetG: 2 })).rejects.toThrow(/fat/);
    await saveTargetSettings(db, { carbsTargetG: null });
    expect((await db.profiles.get(p.id))?.carbsTargetG).toBeNull();
  });
});
