import { toDateKey } from '@/lib/dates';
import { WorkoutDatabase } from '../db';
import { addBodyWeight, deleteBodyWeight, updateBodyWeight } from './bodyweight';

let db: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`bw-${++n}`);
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

const NOW = new Date(2026, 9, 5, 19, 30);
const today = toDateKey(NOW);

describe('body weight entries', () => {
  it('adds today at the current time and past days at 8:00', async () => {
    const a = await addBodyWeight(
      db,
      { weight: 67.2, unit: 'kg', date: today, note: ' after breakfast ' },
      NOW,
    );
    expect(a).toMatchObject({
      weightKg: 67.2,
      enteredUnit: 'kg',
      note: 'after breakfast',
      origin: 'user',
    });
    expect(a.measuredAt).toBe(NOW.toISOString());
    const b = await addBodyWeight(
      db,
      { weight: 67, unit: 'kg', date: '2026-10-01', note: null },
      NOW,
    );
    expect(new Date(b.measuredAt).getHours()).toBe(8);
  });

  it('stores lb entries in kg and remembers the unit they were entered in', async () => {
    const e = await addBodyWeight(db, { weight: 150, unit: 'lb', date: today, note: null }, NOW);
    expect(e.weightKg).toBeCloseTo(68.0389, 3);
    expect(e.enteredUnit).toBe('lb');
  });

  it('rejects impossible values and future dates', async () => {
    await expect(
      addBodyWeight(db, { weight: 0, unit: 'kg', date: today, note: null }, NOW),
    ).rejects.toThrow('Enter your weight');
    await expect(
      addBodyWeight(db, { weight: 900, unit: 'kg', date: today, note: null }, NOW),
    ).rejects.toThrow('between 20 and 400');
    await expect(
      addBodyWeight(db, { weight: 67, unit: 'kg', date: '2026-10-09', note: null }, NOW),
    ).rejects.toThrow('future');
  });

  it('edits keep the original time unless the day changes, and deletes are soft', async () => {
    const e = await addBodyWeight(
      db,
      { weight: 67, unit: 'kg', date: '2026-10-02', note: null },
      NOW,
    );
    await updateBodyWeight(
      db,
      e.id,
      { weight: 66.8, unit: 'kg', date: '2026-10-02', note: 'fasted' },
      NOW,
    );
    expect(await db.bodyWeights.get(e.id)).toMatchObject({
      weightKg: 66.8,
      measuredAt: e.measuredAt,
      note: 'fasted',
    });
    await updateBodyWeight(
      db,
      e.id,
      { weight: 66.8, unit: 'kg', date: '2026-10-03', note: null },
      NOW,
    );
    expect(toDateKey(new Date((await db.bodyWeights.get(e.id))!.measuredAt))).toBe('2026-10-03');
    await deleteBodyWeight(db, e.id);
    expect((await db.bodyWeights.get(e.id))?.deletedAt).not.toBeNull();
  });
});
