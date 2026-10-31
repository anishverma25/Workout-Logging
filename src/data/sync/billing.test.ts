import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  handleCancel,
  handleOrder,
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
const orders: { id: string; amount: number }[] = [];
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
      if (method === 'POST' && path === '/orders') {
        const order = { id: `order_test${++counter}`, amount: (body as { amount: number }).amount };
        orders.push(order);
        return order;
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
    update public.billing_plans set razorpay_plan_id = 'plan_C' where id = 'coach_monthly';
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
      ['coach_monthly', 999, 1],
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

  it('pay once: a valid payment adds the plan months, once, and nothing renews', async () => {
    const user = await server.createUser('once@example.com');
    const started = await handleOrder(deps(), user, { plan: 'quarterly' });
    expect(started.status).toBe(200);
    const orderId = started.body.order_id as string;
    // The server fixes the price: 69 rupees in paise, whatever the browser says.
    expect(started.body.amount).toBe(6900);
    expect(orders.find((o) => o.id === orderId)!.amount).toBe(6900);

    const signature = await hmacSha256Hex(config.keySecret, `${orderId}|pay_o1`);
    const verified = await handleVerify(deps(), user, {
      razorpay_payment_id: 'pay_o1',
      razorpay_order_id: orderId,
      razorpay_signature: signature,
    });
    expect(verified.status).toBe(200);
    const first = await mine(user);
    expect(first).toMatchObject({
      status: 'active',
      billing_plan: 'quarterly',
      billing_kind: 'once',
      cancel_at_period_end: false,
    });
    const end = Date.parse(first.pro_expires_at as string);
    expect(end - Date.now()).toBeGreaterThan(88 * DAY);
    expect(end - Date.now()).toBeLessThan(93 * DAY);

    // The same payment again (a retried request, then the webhook) adds nothing.
    await handleVerify(deps(), user, {
      razorpay_payment_id: 'pay_o1',
      razorpay_order_id: orderId,
      razorpay_signature: signature,
    });
    const raw = JSON.stringify({
      event: 'order.paid',
      payload: { order: { entity: { id: orderId } }, payment: { entity: { id: 'pay_o1' } } },
    });
    await handleWebhook(deps(), raw, await hmacSha256Hex(config.webhookSecret, raw), 'evt_o1');
    expect(Date.parse((await mine(user)).pro_expires_at as string)).toBe(end);

    // A second payment adds on top of the time left.
    const second = (await handleOrder(deps(), user, { plan: 'monthly' })).body.order_id as string;
    await handleVerify(deps(), user, {
      razorpay_payment_id: 'pay_o2',
      razorpay_order_id: second,
      razorpay_signature: await hmacSha256Hex(config.keySecret, `${second}|pay_o2`),
    });
    const stacked = Date.parse((await mine(user)).pro_expires_at as string);
    expect(stacked - end).toBeGreaterThan(27 * DAY);
    expect(stacked - end).toBeLessThan(32 * DAY);
  });

  it('pay once: the webhook alone is enough, and a forged or borrowed payment is not', async () => {
    const user = await server.createUser('once-hook@example.com');
    const other = await server.createUser('once-other@example.com');
    const orderId = (await handleOrder(deps(), user, { plan: 'monthly' })).body.order_id as string;

    const forged = await handleVerify(deps(), user, {
      razorpay_payment_id: 'pay_f',
      razorpay_order_id: orderId,
      razorpay_signature: 'f'.repeat(64),
    });
    expect(forged.status).toBe(400);
    // Someone else's order, even with a correct signature, is refused.
    const borrowed = await handleVerify(deps(), other, {
      razorpay_payment_id: 'pay_b',
      razorpay_order_id: orderId,
      razorpay_signature: await hmacSha256Hex(config.keySecret, `${orderId}|pay_b`),
    });
    expect(borrowed.status).toBe(409);
    expect((await mine(user)).pro_expires_at).toBeNull();
    expect((await mine(other)).pro_expires_at).toBeNull();

    const raw = JSON.stringify({
      event: 'order.paid',
      payload: { order: { entity: { id: orderId } }, payment: { entity: { id: 'pay_h' } } },
    });
    expect((await handleWebhook(deps(), raw, 'nope', 'evt_h0')).status).toBe(401);
    expect(
      (await handleWebhook(deps(), raw, await hmacSha256Hex(config.webhookSecret, raw), 'evt_h1'))
        .body.applied,
    ).toBe('order.paid');
    expect((await mine(user)).billing_kind).toBe('once');
    expect((await mine(user)).pro_expires_at).not.toBeNull();

    // An order we never created (a subscription charge) is ignored.
    const stray = JSON.stringify({
      event: 'order.paid',
      payload: { order: { entity: { id: 'order_unknown' } }, payment: { entity: { id: 'pay_s' } } },
    });
    const ignored = await handleWebhook(
      deps(),
      stray,
      await hmacSha256Hex(config.webhookSecret, stray),
      'evt_h2',
    );
    expect(ignored.body.ignored).toBe(true);
  });

  it('pay once: refused while a renewing plan is running, and the plan list shows the price', async () => {
    const user = await server.createUser('once-sub@example.com');
    const subId = (await handleSubscribe(deps(), user, { plan: 'monthly' })).body
      .subscription_id as string;
    Object.assign(subs.get(subId)!, {
      status: 'active',
      current_end: Math.floor((Date.now() + 30 * DAY) / 1000),
    });
    await webhook('subscription.activated', subs.get(subId)!, 'evt_s1');
    expect((await handleOrder(deps(), user, { plan: 'monthly' })).status).toBe(409);
    expect((await handleOrder(deps(), user, { plan: 'weekly' })).status).toBe(400);

    await server.pg.exec(
      `update public.billing_plans set once_price_inr = 79 where id = 'quarterly'`,
    );
    const plans = (
      await server.asAnon((tx) =>
        tx.query<{ p: { id: string; once_price_inr: number }[] }>(
          'select public.get_billing_plans() as p',
        ),
      )
    ).rows[0]!.p;
    expect(plans.map((p) => [p.id, Number(p.once_price_inr)])).toEqual([
      ['monthly', 29],
      ['quarterly', 79],
      ['yearly', 249],
      ['coach_monthly', 999],
    ]);
    await server.pg.exec(`update public.billing_plans set once_price_inr = null`);
  });

  const coaching = async (userId: string) =>
    (
      await server.asUser(userId, (tx) =>
        tx.query<{ c: Record<string, unknown> }>('select public.get_my_coaching() as c'),
      )
    ).rows[0]!.c;
  const intake = (userId: string, phone = '+91 98765 43210') =>
    server.asUser(userId, (tx) =>
      tx.query(
        `select public.submit_coaching_intake($1, 'Lose 8 kg and bench 80', 'Evenings', '')`,
        [phone],
      ),
    );

  it('coaching: a renewing plan turns on Pro and coaching for the month, and shows the coach', async () => {
    await server.pg.exec(
      `update public.app_settings set coach_name = 'Coach Rahul', coach_whatsapp = '919876543210'`,
    );
    const user = await server.createUser('coached@example.com');
    // Nothing to see before paying: no coach details, and the form is refused.
    expect(await coaching(user)).toMatchObject({ active: false, coach_whatsapp: null });
    await expect(intake(user)).rejects.toThrow();

    const res = await handleSubscribe(deps(), user, { plan: 'coach_monthly' });
    expect(res.status).toBe(200);
    const subId = res.body.subscription_id as string;
    expect(subs.get(subId)!.plan_id).toBe('plan_C');
    const end = Date.now() + 30 * DAY;
    Object.assign(subs.get(subId)!, { status: 'active', current_end: Math.floor(end / 1000) });
    const paymentId = 'pay_coach1';
    const signature = await hmacSha256Hex(config.keySecret, `${paymentId}|${subId}`);
    expect(
      (
        await handleVerify(deps(), user, {
          razorpay_payment_id: paymentId,
          razorpay_subscription_id: subId,
          razorpay_signature: signature,
        })
      ).status,
    ).toBe(200);
    const s = await mine(user);
    expect(s.billing_plan).toBe('coach_monthly');
    expect(new Date(s.pro_expires_at as string).getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
    expect(new Date(s.coaching_expires_at as string).getTime()).toBeGreaterThan(
      Date.now() + 29 * DAY,
    );
    expect(await coaching(user)).toMatchObject({
      active: true,
      coach_name: 'Coach Rahul',
      coach_whatsapp: '919876543210',
      intake: null,
    });
    await intake(user);
    expect(((await coaching(user)).intake as Record<string, string>).goal).toBe(
      'Lose 8 kg and bench 80',
    );
    // Another member never sees this intake, and cannot read the table directly.
    const other = await server.createUser('nosy-coach@example.com');
    expect((await coaching(other)).intake).toBeNull();
    await expect(
      server.asUser(other, (tx) => tx.query('select * from public.coaching_intake')),
    ).rejects.toThrow();
    // A bad phone number is refused by the database.
    await expect(intake(user, 'call me')).rejects.toThrow();
  });

  it('coaching paid once adds one month of coaching, not the length of a Pro plan', async () => {
    const user = await server.createUser('yearly-then-coach@example.com');
    // A year of Pro paid once, then a month of coaching paid once.
    for (const plan of ['yearly', 'coach_monthly']) {
      const started = await handleOrder(deps(), user, { plan });
      expect(started.status).toBe(200);
      const orderId = started.body.order_id as string;
      const paymentId = `pay_${orderId}`;
      const signature = await hmacSha256Hex(config.keySecret, `${orderId}|${paymentId}`);
      await handleVerify(deps(), user, {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });
    }
    expect(orders.at(-1)!.amount).toBe(99_900);
    const s = await mine(user);
    const pro = new Date(s.pro_expires_at as string).getTime();
    const coach = new Date(s.coaching_expires_at as string).getTime();
    // Thirteen months of Pro, one month of coaching.
    expect(pro).toBeGreaterThan(Date.now() + 390 * DAY);
    expect(coach).toBeGreaterThan(Date.now() + 27 * DAY);
    expect(coach).toBeLessThan(Date.now() + 32 * DAY);
  });

  it('keeps the billing functions and tables closed to the app', async () => {
    const user = await server.createUser('sneaky@example.com');
    for (const sql of [
      `select public.billing_activate('sub_x', now() + interval '1 year', 'active')`,
      `select public.billing_attach('${user}', 'monthly', 'sub_x')`,
      `select * from public.billing_plans`,
      `select * from public.billing_events`,
      `select * from public.billing_orders`,
      `select public.billing_order_paid('order_x', 'pay_x')`,
      `select public.billing_order_create('${user}', 'monthly', 'order_x', 29)`,
      `update public.billing_plans set price_inr = 1`,
      `select * from public.app_settings`,
      `update public.subscriptions set coaching_expires_at = now() + interval '1 year'`,
      `insert into public.coaching_intake (user_id, phone, goal) values ('${user}', '9876543210', 'x')`,
    ]) {
      await expect(
        server.asUser(user, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow();
    }
  });
});
