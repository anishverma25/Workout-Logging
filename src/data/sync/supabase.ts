import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ServerRow } from './mapping';
import {
  isPermanentCode,
  keyColumn,
  RemoteError,
  type PullCursor,
  type RemoteStore,
  type RemoteTable,
} from './remote';

/**
 * The browser only ever gets the public (anon or publishable) key. Row level security on the
 * server is what keeps accounts apart. A secret key in the frontend would bypass it, so the
 * app refuses to start cloud features with one.
 */
export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: string;
    };
    return json.role === 'service_role';
  } catch {
    return false;
  }
}

function createSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (isSecretKey(key)) {
    console.error(
      'VITE_SUPABASE_ANON_KEY is a secret (service role) key. Use the public anon key. Accounts are turned off.',
    );
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

/** Null when this build has no Supabase project configured: the app then runs on-device only. */
export const supabase = createSupabase();
export const cloudEnabled = supabase !== null;

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function toRemoteError(error: PostgrestLikeError): RemoteError {
  const code = error.code || null;
  // PGRST1xx/2xx are request and schema errors: retrying the same request will not help.
  const permanent = isPermanentCode(code) || /^PGRST[12]/.test(code ?? '');
  return new RemoteError(error.message, { transient: !permanent, code });
}

/** Quoted so timestamps with dots and plus signs survive PostgREST's filter syntax. */
const q = (value: string) => `"${value.replace(/"/g, '')}"`;

export class SupabaseRemote implements RemoteStore {
  constructor(private client: SupabaseClient) {}

  async upsert(table: RemoteTable, rows: ServerRow[]): Promise<void> {
    if (rows.length === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new RemoteError('You are offline', { transient: true });
    }
    try {
      const { error } = await this.client
        .from(table)
        .upsert(rows, { onConflict: keyColumn(table), defaultToNull: false });
      if (error) throw toRemoteError(error);
    } catch (err) {
      if (err instanceof RemoteError) throw err;
      throw new RemoteError((err as Error).message, { transient: true });
    }
  }

  async pull(table: RemoteTable, after: PullCursor | null, limit: number): Promise<ServerRow[]> {
    const key = keyColumn(table);
    try {
      let query = this.client
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .order(key, { ascending: true })
        .limit(limit);
      if (after) {
        query = query.or(
          `server_updated_at.gt.${q(after.ts)},and(server_updated_at.eq.${q(after.ts)},${key}.gt.${q(after.id)})`,
        );
      }
      const { data, error } = await query;
      if (error) throw toRemoteError(error);
      return (data ?? []) as ServerRow[];
    } catch (err) {
      if (err instanceof RemoteError) throw err;
      throw new RemoteError((err as Error).message, { transient: true });
    }
  }
}
