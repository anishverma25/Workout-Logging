import type { ServerRow, ServerTable } from './mapping';

export type RemoteTable = ServerTable | 'user_preferences';

/** Position in a table's change feed: rows are ordered by (server_updated_at, id). */
export interface PullCursor {
  ts: string;
  id: string;
}

/**
 * The server, as the sync engine sees it. The app uses Supabase; tests use a real Postgres
 * (PGlite) running the same migrations and row level security.
 */
export interface RemoteStore {
  /** Inserts or updates rows by id. Throws RemoteError on failure. */
  upsert(table: RemoteTable, rows: ServerRow[]): Promise<void>;
  /** Rows changed after the cursor, oldest first. */
  pull(table: RemoteTable, after: PullCursor | null, limit: number): Promise<ServerRow[]>;
}

/**
 * `transient` errors (offline, timeouts, server busy) are retried with backoff.
 * Others (a constraint or permission error) will fail the same way again, so the change is
 * set aside and reported instead of blocking everything behind it.
 */
export class RemoteError extends Error {
  readonly transient: boolean;
  readonly code: string | null;
  constructor(message: string, options: { transient: boolean; code?: string | null }) {
    super(message);
    this.name = 'RemoteError';
    this.transient = options.transient;
    this.code = options.code ?? null;
  }
}

/** Postgres error classes that will not succeed on retry: data, integrity, permission. */
const PERMANENT_SQLSTATE = /^(22|23|42|P0)/;

export function isPermanentCode(code: string | null | undefined): boolean {
  return !!code && PERMANENT_SQLSTATE.test(code);
}

/** The primary key column used to page a table's change feed. */
export const keyColumn = (table: RemoteTable) => (table === 'user_preferences' ? 'user_id' : 'id');
