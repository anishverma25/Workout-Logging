import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestServer, type TestServer } from '@/test/server';

/**
 * Trial and Pro records, tested on real Postgres with the migrations. Nothing a signed-in
 * user can send changes their own access: only an administrator (the database owner) can.
 */

interface Sub {
  status: string;
  trial_started_at: string;
  trial_expires_at: string;
  pro_started_at: string | null;
  pro_expires_at: string | null;
  payment_reference: string | null;
  server_now: string;
  early_access: boolean;
  founding_member: boolean;
  admin_note?: string;
}

let server: TestServer;
let userA: string;
let userB: string;

const mine = async (userId: string) =>
  (
    await server.asUser(userId, (tx) =>
      tx.query<{ sub: Sub }>('select public.get_my_subscription() as sub'),
    )
  ).rows[0]!.sub;

beforeAll(async () => {
  server = await createTestServer();
  userA = await server.createUser('a@example.com');
  userB = await server.createUser('b@example.com');
}, 30_000);

afterAll(() => server.close());

describe('subscriptions', () => {
  it('starts exactly 168 hours of trial when the account is created, on the server clock', async () => {
    const sub = await mine(userA);
    expect(sub.status).toBe('trialing');
    const hours = (Date.parse(sub.trial_expires_at) - Date.parse(sub.trial_started_at)) / 3_600_000;
    expect(hours).toBe(168);
    expect(Math.abs(Date.parse(sub.server_now) - Date.parse(sub.trial_started_at))).toBeLessThan(
      60_000,
    );
    // Administrator notes never reach the app.
    expect(sub).not.toHaveProperty('admin_note');
  });

  it('never resets the trial when the person signs in again', async () => {
    const before = await mine(userA);
    // A sign-in does not create a user; reading access many times changes nothing either.
    await mine(userA);
    await server.pg.query(
      `insert into public.subscriptions (user_id) values ($1) on conflict (user_id) do nothing`,
      [userA],
    );
    expect((await mine(userA)).trial_expires_at).toBe(before.trial_expires_at);
  });

  it('cannot be read, changed or deleted directly by a signed-in user', async () => {
    const attempts = [
      'select * from public.subscriptions',
      `update public.subscriptions set pro_expires_at = now() + interval '10 years'`,
      `update public.subscriptions set trial_expires_at = now() + interval '10 years'`,
      `update public.subscriptions set status = 'active'`,
      'delete from public.subscriptions',
      `insert into public.subscriptions (user_id) values ('${crypto.randomUUID()}')`,
    ];
    for (const sql of attempts) {
      await expect(
        server.asUser(userA, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
    }
    expect((await mine(userA)).pro_expires_at).toBeNull();
  });

  it('is invisible to signed-out visitors', async () => {
    await expect(
      server.asAnon((tx) => tx.query('select public.get_my_subscription()')),
    ).rejects.toThrow(/permission denied/);
    await expect(
      server.asAnon((tx) => tx.query(`select public.submit_payment_reference('ABC123456')`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('records a payment reference without granting anything', async () => {
    const result = await server.asUser(userA, (tx) =>
      tx.query<{ sub: Sub }>(`select public.submit_payment_reference(' utr123456789 ') as sub`),
    );
    const sub = result.rows[0]!.sub;
    expect(sub.payment_reference).toBe('UTR123456789');
    expect(sub.status).toBe('payment_pending');
    expect(sub.pro_expires_at).toBeNull();
    // Only A's row changed.
    expect((await mine(userB)).payment_reference).toBeNull();
  });

  it('rejects references that are not a transaction id', async () => {
    for (const bad of ['', '12345', 'drop table x;', 'a'.repeat(41), '<script>']) {
      await expect(
        server.asUser(userB, (tx) => tx.query('select public.submit_payment_reference($1)', [bad])),
        bad,
      ).rejects.toThrow(/transaction reference/);
    }
  });

  it('lets an administrator grant Pro, but never move the trial', async () => {
    await server.pg.query(
      `update public.subscriptions
       set status = 'active', pro_started_at = now(), pro_expires_at = now() + interval '30 days',
           admin_note = 'UPI verified', trial_expires_at = now() + interval '1 year'
       where user_id = $1`,
      [userB],
    );
    const sub = await mine(userB);
    expect(sub.status).toBe('active');
    expect(Date.parse(sub.pro_expires_at!)).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    const hours = (Date.parse(sub.trial_expires_at) - Date.parse(sub.trial_started_at)) / 3_600_000;
    expect(hours).toBe(168);
  });

  it('the queries in the administrator guide work as written', async () => {
    const guide = readFileSync(join(process.cwd(), 'docs', 'admin-pro-payments.md'), 'utf8');
    const blocks = [...guide.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    const [endEarlyAccess, founders, grant, revoke] = blocks;
    expect(blocks).toHaveLength(4);
    // Early access: list early accounts, end it, then reopen it for the rest of the tests.
    const listed = await server.pg.query<{ email: string }>(founders!);
    expect(listed.rows.map((r) => r.email)).toContain('a@example.com');
    await server.pg.exec(endEarlyAccess!);
    expect(await mine(userA)).toMatchObject({ early_access: false, founding_member: true });
    await server.pg.exec('update public.app_settings set early_access_ended_at = null');
    const userC = await server.createUser('person@example.com');

    await server.pg.exec(grant!);
    let sub = await mine(userC);
    expect(sub.status).toBe('active');
    const firstEnd = Date.parse(sub.pro_expires_at!);
    expect(firstEnd - Date.now()).toBeGreaterThan(29.9 * 86_400_000);
    // Granting again extends from the current end instead of resetting.
    await server.pg.exec(grant!);
    sub = await mine(userC);
    expect(Date.parse(sub.pro_expires_at!) - firstEnd).toBeGreaterThan(29.9 * 86_400_000);
    const note = await server.pg.query<{ admin_note: string }>(
      'select admin_note from public.subscriptions where user_id = $1',
      [userC],
    );
    expect(note.rows[0]!.admin_note).toMatch(/granted by hand/);

    await server.pg.exec(revoke!);
    expect((await mine(userC)).status).toBe('revoked');
  });

  it('gives everyone early access until it ends, and keeps founding members marked', async () => {
    expect(await mine(userA)).toMatchObject({ early_access: true, founding_member: true });
    // A signed-in user cannot read or change the setting directly.
    await expect(
      server.asUser(userA, (tx) =>
        tx.query('update public.app_settings set early_access_ended_at = null'),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      server.asUser(userA, (tx) => tx.query('select * from public.app_settings')),
    ).rejects.toThrow(/permission denied/);

    // The administrator ends it, as in the guide.
    await server.pg.exec('update public.app_settings set early_access_ended_at = now()');
    const later = await server.createUser('later@example.com');
    expect(await mine(userA)).toMatchObject({ early_access: false, founding_member: true });
    expect(await mine(later)).toMatchObject({ early_access: false, founding_member: false });
    await server.pg.exec('update public.app_settings set early_access_ended_at = null');
  });
});
