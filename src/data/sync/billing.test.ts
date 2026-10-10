import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  handleCancel,
  handleSubscribe,
  handleVerify,
  handleWebhook,
  hmacSha256Hex,
  type BillingDeps,
} from '../../../supabase/functions/_shared/billing';
import { createTestServer, type TestServer } from '@/test/server';

/**
 * Razorpay billing against real Postgres with the migrations, and a stand-in for the Razorpay
 * API. Covers: only a valid signature turns Pro on, the stored subscription id is the one that
 * counts, webhooks apply once, cancelling keeps Pro to the end of the paid period, and the
 * billing functions are closed to the app.
 */
let server: TestServer;
const config = { keyId: 'rzp_test_key', keySecret: 'key-secret', webhookSecret: 'hook-secret' };
const DAY = 86_400_000;

interface FakeSub {
  id: string;
  status: string;
  current_end: number | null;
  notes: Record<string, string>;
  plan_id: string;
}
const subs = new Map<string, FakeSub>();
let counter = 0;

function deps(): BillingDeps {
  return {
    config,
    async razorpay(method, path, body) {
      if (method === 'POST' && path === '/subscriptions') {
        const b = body as { plan_id: string; notes: Record<string, string> };
        const sub = {
          id: `sub_test${++counter}`,
          status: 'created',
          current_end: null,
          notes: b.notes,
          plan_id: b.plan_id,
        };
        subs.set(sub.id, sub);
        return sub;
      }
      const cancel = /^\/subscriptions\/(\w+)\/cancel$/.exec(path);
      if (cancel) return subs.get(cancel[1]!) ?? null;
      const get = /^\/subscriptions\/(\w+)$/.exec(path);
      if (get) return subs.get(get[1]!) ?? null;
      return null;
    },
    async rpc(fn, args) {
      const keys = Object.keys(args);
      const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
      return server.pg.transaction(async (tx) => {
        await tx.exec('set local role service_role');
        const res = await tx.query<{ r: unknown }>(
          sql,
          keys.map((k) => args[k]),
        );
        return res.rows[0]?.r ?? null;
      });
    },
  };
}

const mine = async (userId: string) =>
  (
    await server.asUser(userId, (tx) =>
      tx.query<{ s: Record<string, unknown> }>('select public.get_my_subscription() as s'),
    )
  ).rows[0]!.s;

async function connectPlans() {
  await server.pg.exec(`
    update public.billing_plans set razorpay_plan_id = 'plan_M' where id = 'monthly';
    update public.billing_plans set razorpay_plan_id = 'plan_Q' where id = 'quarterly';
    update public.billing_plans set razorpay_plan_id = 'plan_Y' where id = 'yearly';
  `);
}

async function webhook(event: string, sub: FakeSub, id: string) {
  const raw = JSON.stringify({ event, payload: { subscription: { entity: sub } } });
  return handleWebhook(deps(), raw, await hmacSha256Hex(config.webhookSecret, raw), id);
}

beforeAll(async () => {
  server = await createTestServer();
});
afterAll(() => server.close());

describe('billing', () => {
  it('lists plans with prices for everyone, and says which are open', async () => {
    const plans = (
      await server.asAnon((tx) =>
        tx.query<{ p: { id: string; price_inr: number; months: number; available: boolean }[] }>(
          'select public.get_billing_plans() as p',
        ),
      )
    ).rows[0]!.p;
    expect(plans.map((p) => [p.id, Number(p.price_inr), p.months])).toEqual([
      ['monthly', 29, 1],
      ['quarterly', 69, 3],
      ['yearly', 249, 12],
    ]);
    expect(plans.every((p) => p.available === false)).toBe(true);
  });

  it('refuses a plan that is not connected to Razorpay yet', async () => {
    const user = await server.createUser('early@example.com');
    const res = await handleSubscribe(deps(), user, { plan: 'monthly' });
    expect(res.status).toBe(409);
    await connectPlans();
  });

  it('turns Pro on at once after a valid payment, for the paid period', async () => {
    const user = await server.createUser('payer@example.com');
    const started = await handleSubscribe(deps(), user, { plan: 'quarterly' });
    expect(started.status).toBe(200);
    const subId = started.body.subscription_id as string;
    expect(started.body.key_id).toBe(config.keyId);
    expect(subs.get(subId)!.plan_id).toBe('plan_Q');

    // Razorpay reports the first charge done, with the end of the first 3 months.
    const end = Math.floor((Date.now() + 91 * DAY) / 1000);
    Object.assign(subs.get(subId)!, { status: 'active', current_end: end });
    const signature = await hmacSha256Hex(config.keySecret, `pay_1|${subId}`);
    const verified = await handleVerify(deps(), user, {
      razorpay_payment_id: 'pay_1',
      razorpay_subscription_id: subId,
      razorpay_signature: signature,
    });
    expect(verified.status).toBe(200);
    const sub = await mine(user);
    expect(sub).toMatchObject({
      status: 'active',
      billing_plan: 'quarterly',
      billing_status: 'active',
      cancel_at_period_end: false,
    });
    expect(Date.parse(sub.pro_expires_at as string)).toBe(end * 1000);
  });

  it('never grants Pro for a forged or borrowed signature', async () => {
    const user = await server.createUser('forger@example.com');
    const started = await handleSubscribe(deps(), user, { plan: 'monthly' });
    const subId = started.body.subscription_id as string;
    const bad = await handleVerify(deps(), user, {
      razorpay_payment_id: 'pay_x',
      razorpay_signature: 'f'.repeat(64),
    });
    expect(bad.status).toBe(400);
    // A real signature for someone else's subscription does not work for this account.
    const other = await hmacSha256Hex(config.keySecret, `pay_y|sub_someone_else`);
    const borrowed = await handleVerify(deps(), user, {
      razorpay_payment_id: 'pay_y',
      razorpay_subscription_id: 'sub_someone_else',
      razorpay_signature: other,
    });
    expect(borrowed.status).toBe(400);
    expect((await mine(user)).pro_expires_at).toBeNull();
    expect(subId).toBeTruthy();
  });

  it('extends Pro on each renewal webhook, once per event, and rejects bad signatures', async () => {
    const user = await server.createUser('renew@example.com');
    const subId = (await handleSubscribe(deps(), user, { plan: 'monthly' })).body
      .subscription_id as string;
    const sub = subs.get(subId)!;
    Object.assign(sub, {
      status: 'active',
      current_end: Math.floor((Date.now() + 30 * DAY) / 1000),
    });
    expect((await webhook('subscription.activated', sub, 'evt_1')).status).toBe(200);
    const first = Date.parse((await mine(user)).pro_expires_at as string);

    sub.current_end = Math.floor((Date.now() + 61 * DAY) / 1000);
    await webhook('subscription.charged', sub, 'evt_2');
    const second = Date.parse((await mine(user)).pro_expires_at as string);
    expect(second).toBeGreaterThan(first);
    // The same delivery again changes nothing.
    expect((await webhook('subscription.charged', sub, 'evt_2')).body.duplicate).toBe(true);

    const raw = JSON.stringify({ event: 'subscription.charged', payload: {} });
    expect((await handleWebhook(deps(), raw, 'nope', 'evt_3')).status).toBe(401);
  });

  it('cancelling stops renewal but keeps Pro until the end of the paid period', async () => {
    const user = await server.createUser('cancel@example.com');
    const subId = (await handleSubscribe(deps(), user, { plan: 'yearly' })).body
      .subscription_id as string;
    const sub = subs.get(subId)!;
    Object.assign(sub, {
      status: 'active',
      current_end: Math.floor((Date.now() + 365 * DAY) / 1000),
    });
    await webhook('subscription.activated', sub, 'evt_y1');
    const before = (await mine(user)).pro_expires_at;

    expect((await handleCancel(deps(), user)).status).toBe(200);
    let now = await mine(user);
    expect(now.cancel_at_period_end).toBe(true);
    expect(now.pro_expires_at).toBe(before);
    // A second plan cannot be bought on top while this one runs out.
    expect((await handleSubscribe(deps(), user, { plan: 'monthly' })).status).toBe(409);

    sub.status = 'cancelled';
    await webhook('subscription.cancelled', sub, 'evt_y2');
    now = await mine(user);
    expect(now.billing_status).toBe('cancelled');
    expect(now.pro_expires_at).toBe(before);
  });

  it('keeps the billing functions and tables closed to the app', async () => {
    const user = await server.createUser('sneaky@example.com');
    for (const sql of [
      `select public.billing_activate('sub_x', now() + interval '1 year', 'active')`,
      `select public.billing_attach('${user}', 'monthly', 'sub_x')`,
      `select * from public.billing_plans`,
      `select * from public.billing_events`,
      `update public.billing_plans set price_inr = 1`,
    ]) {
      await expect(
        server.asUser(user, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow();
    }
  });
});
