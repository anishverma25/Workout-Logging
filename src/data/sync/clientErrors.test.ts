import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestServer, type TestServer } from '@/test/server';

/** Batch 4: error reports and step counts (migration 0032). */
let server: TestServer;
let a: string;
let b: string;

const report = (user: string, fp: string, kind = 'crash') =>
  server.asUser(user, (tx) =>
    tx.query<{ r: boolean }>('select public.report_client_error($1, $2, $3, $4, $5, $6, $7) as r', [
      kind,
      fp,
      'TypeError: x is undefined',
      'at f (a.js:1:2)',
      '/home',
      'abc1234',
      'UA',
    ]),
  );

beforeAll(async () => {
  server = await createTestServer();
  a = await server.createUser('err-a@example.com');
  b = await server.createUser('err-b@example.com');
}, 30_000);
afterAll(() => server.close());

describe('report_client_error', () => {
  it('counts a repeat instead of adding a row', async () => {
    await report(a, 'crash:one');
    await report(a, 'crash:one');
    await report(a, 'crash:one');
    const rows = await server.pg.query<{ count: number }>(
      `select count from public.client_errors where user_id = $1 and fingerprint = 'crash:one'`,
      [a],
    );
    expect(rows.rows).toEqual([{ count: 3 }]);
  });

  it('keeps at most 20 distinct reports a person a day', async () => {
    for (let i = 0; i < 25; i++) await report(a, `crash:${i}`);
    const n = await server.pg.query<{ n: number }>(
      'select count(*)::int as n from public.client_errors where user_id = $1',
      [a],
    );
    expect(n.rows[0]!.n).toBe(20);
    // Others are not affected by one person's flood.
    expect((await report(b, 'crash:x')).rows[0]!.r).toBe(true);
  });

  it('caps lengths and refuses unknown kinds', async () => {
    const long = 'x'.repeat(5000);
    await server.asUser(b, (tx) =>
      tx.query('select public.report_client_error($1, $2, $3, $4, $5, $6, $7)', [
        'error',
        long,
        long,
        long,
        long,
        long,
        long,
      ]),
    );
    const r = await server.pg.query<Record<string, number>>(
      `select length(fingerprint) f, length(message) m, length(stack) s, length(route) r,
              length(app_version) v, length(user_agent) u
         from public.client_errors where user_id = $1 and kind = 'error'`,
      [b],
    );
    expect(r.rows[0]).toEqual({ f: 120, m: 300, s: 1500, r: 80, v: 40, u: 200 });
    expect((await report(b, 'x', 'steal_data')).rows[0]!.r).toBe(false);
  });

  it('nobody can read reports, not even their own, and visitors cannot send', async () => {
    const own = await server.asUser(a, (tx) =>
      tx.query('select * from public.client_errors').catch((e: Error) => e),
    );
    expect(own).toBeInstanceOf(Error);
    await expect(
      server.asAnon((tx) =>
        tx.query(`select public.report_client_error('crash', 'x', '', '', '', '', '')`),
      ),
    ).rejects.toThrow();
  });

  it('forgets reports older than 30 days', async () => {
    await server.pg.query(
      `insert into public.client_errors (user_id, day, kind, fingerprint)
       values ($1, (now() at time zone 'utc')::date - 31, 'crash', 'old')`,
      [b],
    );
    await report(b, 'crash:new');
    const old = await server.pg.query(
      `select 1 from public.client_errors where fingerprint = 'old'`,
    );
    expect(old.rows).toHaveLength(0);
  });

  it('every query in docs/admin-errors.md runs', async () => {
    await report(a, 'tour_done', 'step');
    const guide = readFileSync(join(process.cwd(), 'docs', 'admin-errors.md'), 'utf8');
    const blocks = [...guide.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(blocks.length).toBe(4);
    for (const sql of blocks) await server.pg.query(sql);
  });
});
