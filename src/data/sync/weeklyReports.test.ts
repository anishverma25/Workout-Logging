import { createTestServer, type TestServer } from '@/test/server';

/**
 * Weekly reports on real Postgres with the migrations: one per person per week, a second save
 * returns the first, only Pro accounts can save, only weeks the server clock has opened, and
 * nobody reads anyone else's.
 */

let server: TestServer;
let n = 0;
const uuid = () => `00000000-0000-4000-b000-${String(++n).padStart(12, '0')}`;

const as = <T>(userId: string, sql: string, params: unknown[] = []) =>
  server
    .asUser(userId, (tx) => tx.query<{ r: T }>(`select ${sql} as r`, params))
    .then((res) => res.rows[0]!.r);

async function expectError(p: Promise<unknown>, match: RegExp) {
  let error: unknown = null;
  try {
    await p;
  } catch (e) {
    error = e;
  }
  expect(String((error as Error | null)?.message ?? error)).toMatch(match);
}

/** Ends a trial, as the e2e fake Supabase does to stand in for time passing. */
const expire = (userId: string) =>
  server.pg.transaction(async (tx) => {
    await tx.exec('alter table public.subscriptions disable trigger subscriptions_touch');
    await tx.query(
      `update public.subscriptions set status = 'expired',
        trial_started_at = now() - interval '10 days',
        trial_expires_at = now() - interval '3 days' where user_id = $1`,
      [userId],
    );
    await tx.exec('alter table public.subscriptions enable trigger subscriptions_touch');
  });

/** Monday of the week `offset` weeks from this one, by the server clock. */
const monday = async (offset: number) =>
  (
    await server.pg.query<{ d: string }>(
      `select to_char((date_trunc('week', now())::date + ($1::int * 7)), 'YYYY-MM-DD') as d`,
      [offset],
    )
  ).rows[0]!.d;

beforeAll(async () => {
  server = await createTestServer();
}, 120_000);

afterAll(async () => {
  await server?.close();
});

describe('weekly reports', () => {
  it('saves one report a week; a second save returns the first and changes nothing', async () => {
    const user = await server.createUser(`${uuid()}@example.com`);
    const week = await monday(-1);
    const first = await as<{ created: boolean; report: { v: number }; id: string }>(
      user,
      `public.claim_weekly_report($1, $2::date, $3::jsonb)`,
      [uuid(), week, JSON.stringify({ v: 1 })],
    );
    expect(first.created).toBe(true);
    expect(first.report).toEqual({ v: 1 });
    const second = await as<{ created: boolean; report: { v: number }; id: string }>(
      user,
      `public.claim_weekly_report($1, $2::date, $3::jsonb)`,
      [uuid(), week, JSON.stringify({ v: 2 })],
    );
    expect(second.created).toBe(false);
    expect(second.report).toEqual({ v: 1 });
    expect(second.id).toBe(first.id);
    const list = await as<{ week_start: string }[]>(user, `public.get_my_weekly_reports(12)`);
    expect(list).toHaveLength(1);
    expect(list[0]!.week_start).toBe(week);
  });

  it('only opens weeks the server clock allows', async () => {
    const user = await server.createUser(`${uuid()}@example.com`);
    const claim = (week: string) =>
      as(user, `public.claim_weekly_report($1, $2::date, '{}'::jsonb)`, [uuid(), week]);
    await expectError(claim(await monday(1)), /opens on its last day/);
    await expectError(claim(await monday(-3)), /too far back/);
    // A Wednesday is not a week start.
    const wed = (
      await server.pg.query<{ d: string }>(
        `select to_char(date_trunc('week', now())::date - 5, 'YYYY-MM-DD') as d`,
      )
    ).rows[0]!.d;
    await expectError(claim(wed), /Monday or a Sunday/);
  });

  it('is Pro only, and private', async () => {
    const owner = await server.createUser(`${uuid()}@example.com`);
    const other = await server.createUser(`${uuid()}@example.com`);
    const week = await monday(-1);
    await as(owner, `public.claim_weekly_report($1, $2::date, '{"mine":true}'::jsonb)`, [uuid(), week]);
    // Nobody reads the table directly; the list only ever holds the caller's own.
    await expectError(
      server.asUser(other, (tx) => tx.query('select * from public.weekly_reports')),
      /permission denied/,
    );
    expect(await as<unknown[]>(other, `public.get_my_weekly_reports(12)`)).toEqual([]);
    await expectError(
      server.asAnon((tx) => tx.query(`select public.get_my_weekly_reports(12)`)),
      /permission denied/,
    );
    // Once early access ends, an account with no trial or plan cannot save.
    await server.pg.query(`update public.app_settings set early_access_ended_at = now() - interval '1 day'`);
    try {
      const free = await server.createUser(`${uuid()}@example.com`);
      // New accounts start a trial; this one has used it up.
      await expire(free);
      await expectError(
        as(free, `public.claim_weekly_report($1, $2::date, '{}'::jsonb)`, [uuid(), week]),
        /comes with Pro/,
      );
      // Past reports stay readable after Pro ends.
      await expire(owner);
      expect(await as<unknown[]>(owner, `public.get_my_weekly_reports(12)`)).toHaveLength(1);
    } finally {
      await server.pg.query(`update public.app_settings set early_access_ended_at = null`);
    }
  });
});
