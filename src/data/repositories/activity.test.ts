import { WorkoutDatabase } from '../db';
import { ActivityError, addCardio, deleteActivity, restoreActivity, saveSteps } from './activity';

let db: WorkoutDatabase;
beforeEach(async () => {
  db = new WorkoutDatabase(`activity-${Math.random()}`, { syncEnabled: true });
  await db.open();
});
afterEach(() => db.delete());

const date = '2026-10-22';
const ctx = { weightKg: 70, heightCm: 173 };

describe('cardio', () => {
  it('saves an estimate, and keeps it as saved', async () => {
    const log = await addCardio(
      db,
      { date, activity: 'treadmill_walk', minutes: 30, speedKmh: 5 },
      ctx,
    );
    expect(log).toMatchObject({ kind: 'cardio', kcal: 83, kcalSource: 'estimated', minutes: 30 });
    expect(await db.outbox.get(`activityLogs:${log.id}`)).toBeDefined();
  });

  it('uses a typed number from a watch or machine instead of the estimate', async () => {
    const log = await addCardio(
      db,
      { date, activity: 'stair_machine', minutes: 20, typedKcal: 210 },
      { weightKg: null },
    );
    expect(log).toMatchObject({ kcal: 210, kcalSource: 'typed', effort: null });
  });

  it('asks for a weigh-in when there is nothing to estimate from', async () => {
    await expect(
      addCardio(db, { date, activity: 'hiit', minutes: 20 }, { weightKg: null }),
    ).rejects.toThrow(/weigh-in/);
    await expect(addCardio(db, { date, activity: 'hiit', minutes: 0 }, ctx)).rejects.toBeInstanceOf(
      ActivityError,
    );
  });

  it('records the effort the estimate used, only where effort matters', async () => {
    const bike = await addCardio(
      db,
      { date, activity: 'cycle_indoor', minutes: 30, effort: 'hard' },
      ctx,
    );
    expect(bike.effort).toBe('hard');
    const walk = await addCardio(db, { date, activity: 'treadmill_walk', minutes: 30 }, ctx);
    expect(walk.effort).toBeNull();
  });

  it('deletes softly and restores', async () => {
    const log = await addCardio(db, { date, activity: 'hiit', minutes: 20 }, ctx);
    await deleteActivity(db, [log.id]);
    expect((await db.activityLogs.get(log.id))?.deletedAt).not.toBeNull();
    await restoreActivity(db, [log.id]);
    expect((await db.activityLogs.get(log.id))?.deletedAt).toBeNull();
  });
});

describe('steps', () => {
  it('keeps one record a day and replaces it when saved again', async () => {
    const first = await saveSteps(db, { date, steps: 8000 }, ctx);
    expect(first).toMatchObject({ steps: 8000, kcalSource: 'estimated' });
    const again = await saveSteps(db, { date, steps: 10000 }, ctx);
    expect(again.id).toBe(first.id);
    expect(again.kcal).toBe(251);
    expect(await db.activityLogs.count()).toBe(1);
    await saveSteps(db, { date: '2026-10-23', steps: 5000 }, ctx);
    expect(await db.activityLogs.count()).toBe(2);
  });

  it('takes typed calories over the estimate and validates', async () => {
    const log = await saveSteps(db, { date, steps: 6000, typedKcal: 180 }, ctx);
    expect(log).toMatchObject({ kcal: 180, kcalSource: 'typed' });
    await expect(saveSteps(db, { date, steps: 0 }, ctx)).rejects.toThrow(/steps/);
    await expect(saveSteps(db, { date, steps: 500, typedKcal: 99999 }, ctx)).rejects.toThrow(
      /calories/,
    );
  });
});
