import { WaterLog } from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecords, putRecords, softDelete } from './write';

export class WaterError extends Error {}

/** Logs water: `count` drinks of `ml` each (three glasses at once are three entries). */
export async function addWater(
  db: WorkoutDatabase,
  input: { date: string; ml: number; count?: number },
  now: Date = new Date(),
): Promise<WaterLog[]> {
  const count = Math.round(input.count ?? 1);
  const ml = Math.round(input.ml);
  if (!(ml >= 50 && ml <= 5000)) throw new WaterError('Enter an amount from 50 to 5,000 ml.');
  if (!(count >= 1 && count <= 20)) throw new WaterError('Enter between 1 and 20 drinks.');
  const logs = Array.from({ length: count }, (_, i) =>
    WaterLog.parse({
      ...newRecordMeta('user', new Date(now.getTime() + i).toISOString()),
      date: input.date,
      ml,
    }),
  );
  await db.transaction('rw', [db.waterLogs, db.outbox], () => putRecords(db, 'waterLogs', logs));
  return logs;
}

export async function deleteWaterLogs(db: WorkoutDatabase, ids: string[]): Promise<void> {
  await db.transaction('rw', [db.waterLogs, db.outbox], () => softDelete(db, 'waterLogs', ids));
}

/** Undo for a delete or an add. */
export async function restoreWaterLogs(db: WorkoutDatabase, ids: string[]): Promise<void> {
  await db.transaction('rw', [db.waterLogs, db.outbox], () =>
    patchRecords<WaterLog>(
      db,
      'waterLogs',
      ids.map((id) => ({ id, changes: { deletedAt: null } })),
    ),
  );
}
