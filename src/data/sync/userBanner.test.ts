import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestServer, type TestServer } from '@/test/server';

/**
 * The milestone gift (docs/admin/milestone-grant.sql) and the personal message on Home, on real
 * Postgres with the migrations. The SQL tested here is the file the administrator runs.
 */

interface Sub {
  status: string;
  trial_started_at: string;
  pro_started_at: string | null;
  pro_expires_at: string | null;
  banner_message?: string | null;
  banner_expires_at?: string | null;
  cancel_at_period_end?: boolean;
}

// Each test starts a fresh in-memory Postgres with every migration, which takes a few seconds.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DAY = 86_400_000;
const GRANT_SQL = readFileSync(join(process.cwd(), 'docs', 'admin', 'milestone-grant.sql'), 'utf8');
const GUIDE = readFileSync(join(process.cwd(), 'docs', 'admin-pro-payments.md'), 'utf8');
const FIRST = 'gotanks619@gmail.com';
const SECOND = 'aritrabanerjee841@gmail.com';

let server: TestServer;

const mine = async (userId: string) =>
  (
    await server.asUser(userId, (tx) =>
      tx.query<{ sub: Sub }>('select public.get_my_subscription() as sub'),
    )
  ).rows[0]!.sub;

/** Stands in for time passing: the account was created this many days ago. */
async function backdate(userId: string, daysAgo: number) {
  await server.pg.exec('alter table public.subscriptions disable trigger subscriptions_touch');
  await server.pg.query(
    `update public.subscriptions
     set trial_started_at = now() - make_interval(days => $2::int),
         trial_expires_at = now() - make_interval(days => $2::int) + interval '168 hours'
     where user_id = $1`,
    [userId, daysAgo],
  );
  await server.pg.exec('alter table public.subscriptions enable trigger subscriptions_touch');
}

const runGrant = async () => (await server.pg.query(GRANT_SQL)).affectedRows ?? 0;

afterEach(async () => {
  await server?.close();
});

async function fresh() {
  server = await createTestServer();
  const first = await server.createUser(FIRST);
  const second = await server.createUser(SECOND);
  const other = await server.createUser('someone.else@example.com');
  return { first, second, other };
}

describe('milestone gift', () => {
  it('gives one month from sign-up, with the trial inside it, and a thank you to each person', async () => {
    const { first, second, other } = await fresh();
    await backdate(first, 3);
    await backdate(second, 1);

    expect(await runGrant()).toBe(2);

    for (const [id, nth] of [
      [first, '100th'],
      [second, '101st'],
    ] as const) {
      const sub = await mine(id);
      expect(sub.status).toBe('active');
      // Exactly 30 days after the account was created: not 30 days after today.
      expect(Date.parse(sub.pro_expires_at!) - Date.parse(sub.trial_started_at)).toBe(30 * DAY);
      expect(sub.pro_started_at).toBe(sub.trial_started_at);
      expect(Date.parse(sub.pro_expires_at!)).toBeLessThan(Date.now() + 29.5 * DAY);
      expect(sub.banner_message).toBe(
        `Thank you for being our ${nth} user. We are giving you one month of Pro free.`,
      );
      expect(sub.banner_expires_at).toBe(sub.pro_expires_at);
    }

    // Nobody else is touched.
    const untouched = await mine(other);
    expect(untouched.status).toBe('trialing');
    expect(untouched.pro_expires_at).toBeNull();
    expect(untouched.banner_message).toBeNull();
  });

  it('is safe to run twice and never extends the month', async () => {
    const { first } = await fresh();
    await backdate(first, 2);
    await runGrant();
    const once = await mine(first);
    await runGrant();
    const twice = await mine(first);
    expect(twice.pro_expires_at).toBe(once.pro_expires_at);
    expect(twice.banner_message).toBe(once.banner_message);
  });

  it('skips someone who already pays for Pro, and a month that is already over', async () => {
    const { first, second } = await fresh();
    await server.pg.query(
      `update public.subscriptions
       set status = 'active', billing_plan = 'monthly', pro_started_at = now(),
           pro_expires_at = now() + interval '20 days'
       where user_id = $1`,
      [first],
    );
    await backdate(second, 40);
    expect(await runGrant()).toBe(0);
    const paying = await mine(first);
    expect(paying.banner_message).toBeNull();
    expect(Date.parse(paying.pro_expires_at!)).toBeGreaterThan(Date.now() + 19 * DAY);
    expect((await mine(second)).status).not.toBe('active');
  });
});

describe('personal message', () => {
  it('reaches only its own account and disappears when it expires on the server clock', async () => {
    const { first, other } = await fresh();
    await server.pg.query(
      `update public.subscriptions
       set banner_message = '  Hello there  ', banner_expires_at = now() + interval '1 hour'
       where user_id = $1`,
      [first],
    );
    expect((await mine(first)).banner_message).toBe('Hello there');
    expect((await mine(other)).banner_message).toBeNull();

    await server.pg.query(
      `update public.subscriptions set banner_expires_at = now() - interval '1 second'
       where user_id = $1`,
      [first],
    );
    const expired = await mine(first);
    expect(expired.banner_message).toBeNull();
    expect(expired.banner_expires_at).toBeNull();

    // No expiry date means it stays until removed.
    await server.pg.query(
      `update public.subscriptions set banner_expires_at = null where user_id = $1`,
      [first],
    );
    expect((await mine(first)).banner_message).toBe('Hello there');
  });

  it('cannot be written or read directly by a user', async () => {
    const { first, second } = await fresh();
    for (const sql of [
      `update public.subscriptions set banner_message = 'I am special'`,
      `update public.subscriptions set banner_expires_at = now() + interval '1 year'`,
      'select banner_message from public.subscriptions',
    ]) {
      await expect(
        server.asUser(first, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
    }
    expect((await mine(first)).banner_message).toBeNull();
    expect((await mine(second)).banner_message).toBeNull();
  });

  it('keeps messages short and non-empty', async () => {
    const { first } = await fresh();
    for (const bad of ['', '   ', 'x'.repeat(281)]) {
      await expect(
        server.pg.query(`update public.subscriptions set banner_message = $2 where user_id = $1`, [
          first,
          bad,
        ]),
        JSON.stringify(bad.slice(0, 10)),
      ).rejects.toThrow(/banner_message/);
    }
    await server.pg.query(
      `update public.subscriptions set banner_message = $2 where user_id = $1`,
      [first, 'x'.repeat(280)],
    );
  });

  it('leaves every other field of get_my_subscription as it was', async () => {
    const { first } = await fresh();
    const sub = (await mine(first)) as unknown as Record<string, unknown>;
    for (const key of [
      'status',
      'trial_started_at',
      'trial_expires_at',
      'pro_started_at',
      'pro_expires_at',
      'payment_reference',
      'payment_submitted_at',
      'updated_at',
      'server_now',
      'early_access',
      'founding_member',
      'billing_plan',
      'billing_kind',
      'billing_status',
      'cancel_at_period_end',
    ]) {
      expect(sub, key).toHaveProperty(key);
    }
    expect(sub).not.toHaveProperty('admin_note');
  });

  it('the check and removal queries in the administrator guide work as written', async () => {
    const { first } = await fresh();
    await backdate(first, 2);
    await runGrant();
    const blocks = [...GUIDE.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    const [check, remove] = blocks.slice(-2);
    const listed = await server.pg.query<{ email: string; pro_expires_at: string }>(check!);
    expect(listed.rows.map((r) => r.email)).toContain(FIRST);
    await server.pg.exec(remove!.replace('person@example.com', FIRST));
    expect((await mine(first)).banner_message).toBeNull();
    // Removing the message leaves the Pro month in place.
    expect((await mine(first)).status).toBe('active');
  });
});
