import { WorkoutDatabase } from '../db';
import { addWater, deleteWaterLogs, restoreWaterLogs, WaterError } from './water';

let db: WorkoutDatabase;
beforeEach(async () => {
  db = new WorkoutDatabase(`water-${Math.random()}`, { syncEnabled: true });
  await db.open();
});
afterEach(() => db.delete());

describe('water repository', () => {
  it('logs drinks, queued for sync, one entry each', async () => {
    const logs = await addWater(db, { date: '2026-10-22', ml: 250, count: 3 });
    expect(logs).toHaveLength(3);
    expect(await db.waterLogs.count()).toBe(3);
    expect(await db.outbox.get(`waterLogs:${logs[0]!.id}`)).toBeDefined();
  });

  it('deletes softly and restores', async () => {
    const [log] = await addWater(db, { date: '2026-10-22', ml: 500 });
    await deleteWaterLogs(db, [log!.id]);
    expect((await db.waterLogs.get(log!.id))?.deletedAt).not.toBeNull();
    await restoreWaterLogs(db, [log!.id]);
    expect((await db.waterLogs.get(log!.id))?.deletedAt).toBeNull();
  });

  it('refuses silly amounts', async () => {
    await expect(addWater(db, { date: '2026-10-22', ml: 10 })).rejects.toBeInstanceOf(WaterError);
    await expect(addWater(db, { date: '2026-10-22', ml: 250, count: 50 })).rejects.toThrow(
      /drinks/,
    );
  });
});
