import { WorkoutDatabase } from '../db';
import { loadDemoData } from '../demo/service';
import { saveProfile } from './profile';
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

  it('never edits the demo profile, and the person’s own wins', async () => {
    await loadDemoData(db);
    const mine = await saveProfile(db, input);
    expect((await loadTrainingData(db)).profile?.id).toBe(mine.id);
    expect(await db.profiles.where('origin').equals('demo').count()).toBe(1);
  });

  it('rejects an empty name or an impossible birth date', async () => {
    await expect(saveProfile(db, { ...input, displayName: '  ' })).rejects.toThrow('Enter a name');
    await expect(saveProfile(db, { ...input, birthDate: '2024-01-01' })).rejects.toThrow(
      'birth date',
    );
  });
});
