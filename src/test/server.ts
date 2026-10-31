import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { ServerRow } from '@/data/sync/mapping';
import {
  isPermanentCode,
  keyColumn,
  RemoteError,
  type PullCursor,
  type RemoteStore,
  type RemoteTable,
} from '@/data/sync/remote';

/**
 * A real Postgres for tests, set up the way Supabase is: `anon` and `authenticated` roles,
 * an `auth.users` table and `auth.uid()` reading the JWT claims of the request. The project's
 * migrations then run unchanged, so row level security is tested for real.
 */
const AUTH_STUB = readFileSync(join(process.cwd(), 'supabase', 'tests', 'auth-stub.sql'), 'utf8');

export const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export interface TestServer {
  pg: PGlite;
  createUser(email: string): Promise<string>;
  /** Runs statements as a signed-in user (role `authenticated`, JWT sub = userId). */
  asUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Runs statements as a visitor who is not signed in. */
  asAnon<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  remoteFor(userId: string): PGliteRemote;
  close(): Promise<void>;
}

export async function createTestServer(): Promise<TestServer> {
  const pg = new PGlite();
  await pg.exec(AUTH_STUB);
  for (const file of migrationFiles()) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  // Supabase grants table access to service_role; mirror it for admin-style test setup.
  await pg.exec('grant all on all tables in schema public to service_role;');

  const asRole = async <T>(
    role: 'authenticated' | 'anon',
    claims: object,
    fn: (tx: Transaction) => Promise<T>,
  ) =>
    pg.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      return fn(tx);
    });

  const server: TestServer = {
    pg,
    async createUser(email) {
      const id = crypto.randomUUID();
      await pg.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
      return id;
    },
    asUser: (userId, fn) => asRole('authenticated', { sub: userId, role: 'authenticated' }, fn),
    asAnon: (fn) => asRole('anon', { role: 'anon' }, fn),
    remoteFor: (userId) => new PGliteRemote(server, userId),
    close: () => pg.close(),
  };
  return server;
}

const ident = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Bad identifier ${name}`);
  return `"${name}"`;
};

/**
 * RemoteStore over the test server. Builds the same statements PostgREST does for an upsert
 * (insert of the given columns, on conflict update) and returns rows as JSON like the API.
 */
export class PGliteRemote implements RemoteStore {
  /** Set to make the next calls fail as if the network were down. */
  offline = false;
  calls = 0;

  constructor(
    private server: TestServer,
    private userId: string,
  ) {}

  private wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    this.calls++;
    if (this.offline) throw new RemoteError('Network request failed', { transient: true });
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RemoteError) throw err;
      const code = (err as { code?: string }).code ?? null;
      throw new RemoteError((err as Error).message, {
        transient: !isPermanentCode(code),
        code,
      });
    }
  };

  async upsert(table: RemoteTable, rows: ServerRow[]): Promise<void> {
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]!);
    const key = keyColumn(table);
    const cols = columns.map(ident).join(', ');
    const updates = columns
      .filter((c) => c !== key)
      .map((c) => `${ident(c)} = excluded.${ident(c)}`)
      .join(', ');
    await this.wrap(() =>
      this.server.asUser(this.userId, (tx) =>
        tx.query(
          `insert into public.${ident(table)} (${cols})
           select ${cols} from jsonb_populate_recordset(null::public.${ident(table)}, $1::jsonb)
           on conflict (${ident(key)}) do update set ${updates}`,
          [JSON.stringify(rows)],
        ),
      ),
    );
  }

  async pull(table: RemoteTable, after: PullCursor | null, limit: number): Promise<ServerRow[]> {
    const key = ident(keyColumn(table));
    return this.wrap(async () => {
      const result = await this.server.asUser(this.userId, (tx) =>
        after
          ? tx.query<{ row: ServerRow }>(
              `select to_jsonb(t) as row from public.${ident(table)} t
               where t.server_updated_at > $1::timestamptz
                  or (t.server_updated_at = $1::timestamptz and t.${key} > $2::uuid)
               order by t.server_updated_at, t.${key} limit $3`,
              [after.ts, after.id, limit],
            )
          : tx.query<{ row: ServerRow }>(
              `select to_jsonb(t) as row from public.${ident(table)} t
               order by t.server_updated_at, t.${key} limit $1`,
              [limit],
            ),
      );
      return result.rows.map((r) => r.row);
    });
  }
}
