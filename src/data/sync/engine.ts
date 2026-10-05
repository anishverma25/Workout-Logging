import type { Table } from 'dexie';
import type { OutboxEntry, SyncTable, WorkoutDatabase } from '../db';
import { getMeta, getPreferences, META_KEYS, setMeta } from '../repositories/meta';
import {
  fromServerRow,
  preferencesFromRow,
  preferencesToRow,
  TABLE_SPECS,
  toServerRow,
  type ServerRow,
} from './mapping';
import {
  keyColumn,
  RemoteError,
  type PullCursor,
  type RemoteStore,
  type RemoteTable,
} from './remote';

/**
 * Local-first sync.
 *
 *   user action -> local database -> outbox -> server -> confirmation -> outbox entry removed
 *
 * - Every change is saved on the device first (write.ts) and queued in the outbox in the same
 *   transaction. Nothing here can lose a local change.
 * - Push sends records by their client id with an upsert, parents before children. Sending the
 *   same change twice updates the same row, so retries never create duplicates.
 * - An outbox entry is removed only after the server confirmed it, and only if the record was
 *   not edited again meanwhile (otherwise the newer version is sent next time).
 * - Pull reads each table's changes since the last cursor and keeps whichever version has the
 *   newer `updatedAt` (the server applies the same rule on its side).
 * - Only records the person created (origin 'user') ever leave the device.
 */

export const PUSH_BATCH = 100;
export const PULL_PAGE = 500;
/** Re-read a little before the cursor, in case a slow transaction committed late. */
export const PULL_OVERLAP_MS = 5_000;
/** After this many permanent failures a change is set aside until the person retries. */
export const MAX_ATTEMPTS = 5;

export interface SyncResult {
  pushed: number;
  pulled: number;
  /** Changes the server rejected (not network problems). They stay on the device. */
  rejected: number;
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function remoteTableOf(table: SyncTable): RemoteTable {
  if (table === 'preferences') return 'user_preferences';
  return TABLE_SPECS.find((s) => s.local === table)!.server;
}

/** Outbox entries in push order: parents first, oldest first within a table. */
async function pendingEntries(db: WorkoutDatabase, table: SyncTable) {
  const entries = await db.outbox.where('table').equals(table).sortBy('queuedAt');
  return entries.filter((e) => e.attempts < MAX_ATTEMPTS);
}

/** Removes outbox entries the server has confirmed, unless the record changed again since. */
async function acknowledge(db: WorkoutDatabase, sent: { entry: OutboxEntry; updatedAt: string }[]) {
  await db.transaction('rw', db.outbox, async () => {
    for (const { entry, updatedAt } of sent) {
      const current = await db.outbox.get(entry.id);
      if (current && current.recordUpdatedAt <= updatedAt) await db.outbox.delete(entry.id);
    }
  });
}

async function markFailed(db: WorkoutDatabase, entries: OutboxEntry[], error: RemoteError) {
  await db.transaction('rw', db.outbox, async () => {
    for (const e of entries) {
      const current = await db.outbox.get(e.id);
      if (!current) continue;
      await db.outbox.put({
        ...current,
        // Network problems do not count toward giving up; they are retried with backoff.
        attempts: error.transient ? current.attempts : current.attempts + 1,
        lastError: error.message,
      });
    }
  });
}

interface Outgoing {
  entry: OutboxEntry;
  row: ServerRow;
  updatedAt: string;
}

/** Reads the records behind outbox entries and turns them into server rows. */
async function collect(
  db: WorkoutDatabase,
  table: SyncTable,
  entries: OutboxEntry[],
  userId: string,
): Promise<Outgoing[]> {
  if (table === 'preferences') {
    const record = await db.meta.get(META_KEYS.preferences);
    if (!record) {
      await db.outbox.bulkDelete(entries.map((e) => e.id));
      return [];
    }
    const prefs = await getPreferences(db);
    return entries.map((entry) => ({
      entry,
      row: preferencesToRow(prefs, record.updatedAt, userId),
      updatedAt: record.updatedAt,
    }));
  }
  const spec = TABLE_SPECS.find((s) => s.local === table)!;
  const records = await (
    db.table(table) as Table<{ id: string; updatedAt: string; origin: string }>
  ).bulkGet(entries.map((e) => e.recordId));
  const out: Outgoing[] = [];
  const skip: string[] = [];
  entries.forEach((entry, i) => {
    const record = records[i];
    // Missing records, the built-in library and demo data never go to the server.
    if (!record || record.origin !== 'user') skip.push(entry.id);
    else out.push({ entry, row: toServerRow(spec, record, userId), updatedAt: record.updatedAt });
  });
  if (skip.length) await db.outbox.bulkDelete(skip);
  return out;
}

async function pushBatch(
  db: WorkoutDatabase,
  remote: RemoteStore,
  table: SyncTable,
  batch: Outgoing[],
): Promise<{ pushed: number; rejected: number }> {
  const target = remoteTableOf(table);
  try {
    await remote.upsert(
      target,
      batch.map((b) => b.row),
    );
    await acknowledge(db, batch);
    return { pushed: batch.length, rejected: 0 };
  } catch (err) {
    const error = asRemoteError(err);
    if (error.transient) {
      await markFailed(
        db,
        batch.map((b) => b.entry),
        error,
      );
      throw error;
    }
    if (batch.length === 1) {
      await markFailed(db, [batch[0]!.entry], error);
      return { pushed: 0, rejected: 1 };
    }
    // One bad record must not hold back the rest: send them one by one.
    let pushed = 0;
    let rejected = 0;
    for (const one of batch) {
      const r = await pushBatch(db, remote, table, [one]);
      pushed += r.pushed;
      rejected += r.rejected;
    }
    return { pushed, rejected };
  }
}

export function asRemoteError(err: unknown): RemoteError {
  if (err instanceof RemoteError) return err;
  return new RemoteError(err instanceof Error ? err.message : String(err), { transient: true });
}

const PUSH_ORDER: SyncTable[] = [...TABLE_SPECS.map((s) => s.local), 'preferences'];

/** Sends queued changes. Throws a transient RemoteError when the server cannot be reached. */
export async function push(
  db: WorkoutDatabase,
  remote: RemoteStore,
  userId: string,
): Promise<{ pushed: number; rejected: number }> {
  let pushed = 0;
  let rejected = 0;
  for (const table of PUSH_ORDER) {
    const entries = await pendingEntries(db, table);
    for (let i = 0; i < entries.length; i += PUSH_BATCH) {
      const outgoing = await collect(db, table, entries.slice(i, i + PUSH_BATCH), userId);
      if (outgoing.length === 0) continue;
      const r = await pushBatch(db, remote, table, outgoing);
      pushed += r.pushed;
      rejected += r.rejected;
    }
  }
  return { pushed, rejected };
}

async function readCursor(db: WorkoutDatabase, table: RemoteTable): Promise<PullCursor | null> {
  return (await getMeta<PullCursor>(db, `${META_KEYS.syncCursor}${table}`)) ?? null;
}

function withOverlap(cursor: PullCursor | null): PullCursor | null {
  if (!cursor) return null;
  const ts = new Date(Date.parse(cursor.ts) - PULL_OVERLAP_MS).toISOString();
  return { ts, id: ZERO_UUID };
}

/** Saves a server record locally if it is newer than the local copy. Returns true if saved. */
async function mergeRecord(db: WorkoutDatabase, table: SyncTable, record: Record<string, unknown>) {
  const t = db.table(table) as Table<{ id: string; updatedAt: string }>;
  const id = record.id as string;
  const updatedAt = record.updatedAt as string;
  return db.transaction('rw', [t, db.outbox], async () => {
    const local = await t.get(id);
    const pending = await db.outbox.get(`${table}:${id}`);
    if (local && local.updatedAt >= updatedAt) return false;
    // Written directly, not through write.ts: this change came from the server and must not
    // be queued to go back there.
    await t.put(record as { id: string; updatedAt: string });
    if (pending && pending.recordUpdatedAt <= updatedAt) await db.outbox.delete(pending.id);
    return true;
  });
}

async function mergePreferences(db: WorkoutDatabase, row: ServerRow) {
  const parsed = preferencesFromRow(row);
  if (!parsed) return false;
  return db.transaction('rw', [db.meta, db.outbox], async () => {
    const local = await db.meta.get(META_KEYS.preferences);
    if (local && local.updatedAt >= parsed.updatedAt) return false;
    await db.meta.put({
      key: META_KEYS.preferences,
      value: parsed.prefs,
      updatedAt: parsed.updatedAt,
    });
    const pending = await db.outbox.get('preferences:preferences');
    if (pending && pending.recordUpdatedAt <= parsed.updatedAt) await db.outbox.delete(pending.id);
    return true;
  });
}

/** Fetches changes from the server, table by table, and merges them into the local database. */
export async function pull(db: WorkoutDatabase, remote: RemoteStore): Promise<number> {
  let pulled = 0;
  for (const table of PUSH_ORDER) {
    const target = remoteTableOf(table);
    const key = keyColumn(target);
    let cursor = await readCursor(db, target);
    let after = withOverlap(cursor);
    for (;;) {
      const rows = await remote.pull(target, after, PULL_PAGE);
      for (const row of rows) {
        if (table === 'preferences') {
          if (await mergePreferences(db, row)) pulled++;
          continue;
        }
        const record = fromServerRow(
          TABLE_SPECS.find((s) => s.local === table)!,
          row,
        );
        if (!record) {
          console.warn(`Skipped an invalid ${target} row from the server`, row[key]);
          continue;
        }
        if (await mergeRecord(db, table, record)) pulled++;
      }
      const last = rows.at(-1);
      if (last) {
        // Keep the server's own timestamp text: it has microseconds that a JS Date would drop.
        cursor = { ts: String(last.server_updated_at), id: String(last[key]) };
        await setMeta(db, `${META_KEYS.syncCursor}${target}`, cursor);
        after = cursor;
      }
      if (rows.length < PULL_PAGE) break;
    }
  }
  return pulled;
}

/** One full round: send local changes, then fetch everything newer from the server. */
export async function syncOnce(
  db: WorkoutDatabase,
  remote: RemoteStore,
  userId: string,
): Promise<SyncResult> {
  const { pushed, rejected } = await push(db, remote, userId);
  const pulled = await pull(db, remote);
  await setMeta(db, META_KEYS.lastSyncedAt, new Date().toISOString());
  return { pushed, pulled, rejected };
}

/** Changes that have not reached the server yet, and those it refused. */
export async function outboxCounts(db: WorkoutDatabase) {
  const all = await db.outbox.toArray();
  return {
    pending: all.length,
    rejected: all.filter((e) => e.attempts >= MAX_ATTEMPTS).length,
  };
}

/** Puts changes the server refused back in line, for a manual "try again". */
export async function retryRejected(db: WorkoutDatabase): Promise<void> {
  await db.outbox.toCollection().modify((e) => {
    e.attempts = 0;
  });
}
