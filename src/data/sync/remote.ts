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
  /**
   * Every asked table's rows after its cursor, in one request (`sync_pull`, migration 0031).
   * A table left out of the answer is pulled with `pull`. Null when the server does not have
   * the function: then every table is pulled with `pull`.
   */
  pullAll?(
    cursors: Record<string, PullCursor | null>,
    limit: number,
  ): Promise<Record<string, ServerRow[]> | null>;
}

/** The server does not have this function yet (PostgREST PGRST202, Postgres 42883). */
export function isMissingFunction(error: { code?: string | null; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|function .* does not exist/i.test(error.message ?? '')
  );
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

/**
 * The server does not have this table yet: PostgREST's PGRST205 ("Could not find the table"),
 * or Postgres 42P01 (undefined table).
 */
export function isMissingTable(error: { code?: string | null; message?: string }): boolean {
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table|relation .* does not exist/i.test(error.message ?? '')
  );
}

/** Postgres error classes that will not succeed on retry: data, integrity, permission. */
const PERMANENT_SQLSTATE = /^(22|23|42|P0)/;

export function isPermanentCode(code: string | null | undefined): boolean {
  return !!code && PERMANENT_SQLSTATE.test(code);
}

/** The primary key column used to page a table's change feed. */
export const keyColumn = (table: RemoteTable) => (table === 'user_preferences' ? 'user_id' : 'id');
