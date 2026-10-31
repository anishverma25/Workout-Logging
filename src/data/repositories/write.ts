import type { Table } from 'dexie';
import type { RecordOrigin } from '@/domain/models/schemas';
import { newId } from '@/lib/ids';
import type { DomainTable, WorkoutDatabase } from '../db';

/**
 * The single write path for domain records.
 *
 * Every change made through here:
 * - stamps `updatedAt` (and `createdAt` for new records)
 * - soft deletes instead of removing rows, so history and sync both stay intact
 * - queues the record in the outbox when the database belongs to a signed-in account,
 *   inside the same transaction, so a change can never be saved without being queued
 *
 * Repositories call these helpers inside their own transactions; Dexie nests them safely.
 */

export interface SyncedRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  origin: RecordOrigin;
}

export const nowIso = () => new Date().toISOString();

/** Fields every new record starts with. */
export function newRecordMeta(origin: RecordOrigin = 'user', at: string = nowIso()) {
  return { id: newId(), createdAt: at, updatedAt: at, deletedAt: null, origin };
}

function tableOf<T>(db: WorkoutDatabase, name: DomainTable) {
  return db.table(name) as Table<T, string>;
}

/**
 * Updated timestamps must move forward even when two writes land in the same millisecond,
 * so "newer wins" conflict handling never sees a tie between a record and its own edit.
 */
function nextUpdatedAt(previous: string | undefined, at: string): string {
  if (!previous || previous < at) return at;
  return new Date(Date.parse(previous) + 1).toISOString();
}

async function enqueue(
  db: WorkoutDatabase,
  table: DomainTable,
  recordId: string,
  recordUpdatedAt: string,
) {
  if (!db.syncEnabled) return;
  await db.outbox.put({
    id: `${table}:${recordId}`,
    table,
    recordId,
    recordUpdatedAt,
    queuedAt: nowIso(),
    attempts: 0,
    lastError: null,
  });
}

/** Inserts or replaces whole records. New records must already carry their meta fields. */
export async function putRecords<T extends SyncedRecord>(
  db: WorkoutDatabase,
  table: DomainTable,
  records: T[],
): Promise<void> {
  if (records.length === 0) return;
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await tableOf<T>(db, table).bulkPut(records);
    for (const r of records) await enqueue(db, table, r.id, r.updatedAt);
  });
}

/** Applies a partial change to an existing record. Returns the saved record, or null if missing. */
export async function patchRecord<T extends SyncedRecord>(
  db: WorkoutDatabase,
  table: DomainTable,
  id: string,
  changes: Partial<Omit<T, 'id' | 'createdAt' | 'origin'>>,
): Promise<T | null> {
  return db.transaction('rw', [db.table(table), db.outbox], async () => {
    const t = tableOf<T>(db, table);
    const current = await t.get(id);
    if (!current) return null;
    const next = {
      ...current,
      ...changes,
      updatedAt: nextUpdatedAt(current.updatedAt, nowIso()),
    } as T;
    await t.put(next);
    await enqueue(db, table, id, next.updatedAt);
    return next;
  });
}

/** Applies the same kind of change to many records (reordering, cascading deletes). */
export async function patchRecords<T extends SyncedRecord>(
  db: WorkoutDatabase,
  table: DomainTable,
  changes: { id: string; changes: Partial<Omit<T, 'id' | 'createdAt' | 'origin'>> }[],
): Promise<void> {
  if (changes.length === 0) return;
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    for (const c of changes) await patchRecord<T>(db, table, c.id, c.changes);
  });
}

/** Soft delete: the row stays so sync can propagate the deletion and history can still resolve it. */
export async function softDelete(
  db: WorkoutDatabase,
  table: DomainTable,
  ids: string[],
): Promise<void> {
  const at = nowIso();
  await patchRecords<SyncedRecord>(
    db,
    table,
    ids.map((id) => ({ id, changes: { deletedAt: at } })),
  );
}
