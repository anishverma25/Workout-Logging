import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  handleCancel,
  handleOrder,
  handleRetireLegacy,
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
  start_at?: number | null;
  /** Paise charged up front as an add-on. */
  upfront?: number | null;
}
const subs = new Map<string, FakeSub>();
/** Razorpay plan amounts in paise that differ from the server price (a plan left from old prices). */
const planAmounts = new Map<string, number>();
const cancelledNow: string[] = [];
const orders: { id: string; amount: number }[] = [];
let counter = 0;

function deps(): BillingDeps {
  return {
    config,
    async razorpay(method, path, body) {
      if (method === 'POST' && path === '/subscriptions') {
        const b = body as FakeSub & { addons?: { item: { amount: number } }[] };
        const sub: FakeSub = {
          id: `sub_test${++counter}`,
          status: 'created',
          current_end: null,
          notes: b.notes,
          plan_id: b.plan_id,
          start_at: b.start_at ?? null,
          upfront: b.addons?.[0]?.item.amount ?? null,
        };
        subs.set(sub.id, sub);
        return sub;
      }
      const plan = /^\/plans\/(\w+)$/.exec(path);
      if (plan) {
        if (planAmounts.has(plan[1]!))
          return { id: plan[1], item: { amount: planAmounts.get(plan[1]!) } };
        const row = await server.pg.query<{ price_inr: string }>(
          'select price_inr from public.billing_plans where razorpay_plan_id = $1',
          [plan[1]],
        );
        return row.rows[0]
          ? { id: plan[1], item: { amount: Math.round(Number(row.rows[0].price_inr) * 100) } }
          : null;
      }
      if (method === 'POST' && path === '/orders') {
        const order = { id: `order_test${++counter}`, amount: (body as { amount: number }).amount };
        orders.push(order);
        return order;
      }
      const cancel = /^\/subscriptions\/(\w+)\/cancel$/.exec(path);
      if (cancel) {
        const sub = subs.get(cancel[1]!);
        if (sub && (body as { cancel_at_cycle_end?: number }).cancel_at_cycle_end === 0) {
          sub.status = 'cancelled';
          cancelledNow.push(sub.id);
        }
        return sub ?? null;
      }
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
      ['monthly', 149, 1],
      ['quarterly', 399, 3],
      ['yearly', 1499, 12],
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
    // The server fixes the price: 399 rupees in paise, whatever the browser says.
    expect(started.body.amount).toBe(39900);
    expect(orders.find((o) => o.id === orderId)!.amount).toBe(39900);

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
      ['monthly', 149],
      ['quarterly', 79],
      ['yearly', 1499],
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

  // -------------------------------------------------------------------------------------------
  // New prices, both ways to pay at any time, stuck renewals and coupons (migration 0024)
  // -------------------------------------------------------------------------------------------

  const activate = async (subId: string, days: number, evt: string) => {
    Object.assign(subs.get(subId)!, {
      status: 'active',
      current_end: Math.floor((Date.now() + days * DAY) / 1000),
    });
    await webhook('subscription.activated', subs.get(subId)!, evt);
  };
  const payOnce = async (user: string, plan: string, pay: string, coupon?: string) => {
    const started = await handleOrder(deps(), user, { plan, coupon });
    if (started.status !== 200) return started;
    const orderId = started.body.order_id as string;
    const signature = await hmacSha256Hex(config.keySecret, `${orderId}|${pay}`);
    await handleVerify(deps(), user, {
      razorpay_order_id: orderId,
      razorpay_payment_id: pay,
      razorpay_signature: signature,
    });
    return started;
  };
  const verifySub = async (user: string, subId: string, pay: string) =>
    handleVerify(deps(), user, {
      razorpay_payment_id: pay,
      razorpay_signature: await hmacSha256Hex(config.keySecret, `${pay}|${subId}`),
    });
  const near = (iso: unknown, ms: number, slack = 2 * DAY) =>
    Math.abs(new Date(iso as string).getTime() - ms) < slack;

  it('autopay never charges through a Razorpay plan left from another price', async () => {
    const user = await server.createUser('oldplan@example.com');
    planAmounts.set('plan_M', 2900);
    const res = await handleSubscribe(deps(), user, { plan: 'monthly' });
    expect(res.status).toBe(409);
    expect(String(res.body.error)).toContain('pay once');
    planAmounts.delete('plan_M');
    // Paying once does not need a Razorpay plan and uses the server price.
    expect((await handleOrder(deps(), user, { plan: 'monthly' })).body.amount).toBe(14900);
  });

  it('a renewing member must turn renewal off before changing; then both ways are open', async () => {
    const user = await server.createUser('switch@example.com');
    const first = (await handleSubscribe(deps(), user, { plan: 'monthly' })).body
      .subscription_id as string;
    await activate(first, 30, 'evt_sw1');
    expect((await handleSubscribe(deps(), user, { plan: 'yearly' })).status).toBe(409);
    expect((await handleOrder(deps(), user, { plan: 'yearly' })).status).toBe(409);

    expect((await handleCancel(deps(), user)).status).toBe(200);
    const paidUntil = new Date((await mine(user)).pro_expires_at as string).getTime();

    // Autopay again: it starts when the paid month runs out, and adds nothing until then.
    const again = await handleSubscribe(deps(), user, { plan: 'yearly' });
    expect(again.status).toBe(200);
    const sub = subs.get(again.body.subscription_id as string)!;
    expect(sub.start_at! * 1000).toBeGreaterThan(paidUntil - 2000);
    expect(sub.start_at! * 1000).toBeLessThan(paidUntil + 2000);
    sub.status = 'authenticated';
    const verified = await verifySub(user, sub.id, 'pay_sw2');
    expect(verified.status).toBe(200);
    const now = await mine(user);
    expect(new Date(now.pro_expires_at as string).getTime()).toBe(paidUntil);
    expect(now.billing_status).toBe('authenticated');
    expect(now.cancel_at_period_end).toBe(false);

    // The first real charge, at the start date, runs the year from there.
    Object.assign(sub, {
      status: 'active',
      current_end: Math.floor((paidUntil + 365 * DAY) / 1000),
    });
    await webhook('subscription.charged', sub, 'evt_sw3');
    expect(near((await mine(user)).pro_expires_at, paidUntil + 365 * DAY)).toBe(true);
  });

  it('paid once, then more: pay once adds on top, and autopay starts when the paid time ends', async () => {
    const user = await server.createUser('extend@example.com');
    await payOnce(user, 'monthly', 'pay_e1');
    await payOnce(user, 'quarterly', 'pay_e2');
    const s = await mine(user);
    expect(s.billing_kind).toBe('once');
    const paidUntil = new Date(s.pro_expires_at as string).getTime();
    expect(paidUntil).toBeGreaterThan(Date.now() + 118 * DAY);

    const auto = await handleSubscribe(deps(), user, { plan: 'monthly' });
    expect(auto.status).toBe(200);
    expect(new Date(auto.body.starts_at as string).getTime()).toBeGreaterThan(paidUntil - 2000);
    // And a member whose autopay is waiting to start can still not double up.
    subs.get(auto.body.subscription_id as string)!.status = 'authenticated';
    await verifySub(user, auto.body.subscription_id as string, 'pay_e3');
    expect((await handleOrder(deps(), user, { plan: 'monthly' })).status).toBe(409);
  });

  it('a renewal stuck on a failed payment is cleared, so the person can pay again either way', async () => {
    const user = await server.createUser('stuck@example.com');
    const first = (await handleSubscribe(deps(), user, { plan: 'monthly' })).body
      .subscription_id as string;
    await activate(first, 30, 'evt_st1');
    const paidUntil = (await mine(user)).pro_expires_at;
    subs.get(first)!.status = 'halted';
    await webhook('subscription.halted', subs.get(first)!, 'evt_st2');
    expect((await mine(user)).billing_status).toBe('halted');

    const order = await handleOrder(deps(), user, { plan: 'monthly' });
    expect(order.status).toBe(200);
    expect(cancelledNow).toContain(first);
    const s = await mine(user);
    expect(s.billing_status).toBe('cancelled');
    // Clearing it takes nothing away.
    expect(s.pro_expires_at).toBe(paidUntil);
  });

  it('coupons: 10% off one payment, checked on the server, one per account', async () => {
    await server.pg.exec(`
      insert into public.coupons (code, note) values ('GYM10', 'test');
      insert into public.coupons (code, percent, max_uses) values ('ONCE20', 20, 1);
      insert into public.coupons (code, active) values ('OFF10', false);
      insert into public.coupons (code, expires_at) values ('OLD10', now() - interval '1 day');
    `);
    const user = await server.createUser('coupon@example.com');
    const check = async (u: string, code: string) =>
      (
        await server.asUser(u, (tx) =>
          tx.query<{ c: { ok: boolean; percent?: number; reason?: string } }>(
            'select public.check_coupon($1) as c',
            [code],
          ),
        )
      ).rows[0]!.c;
    expect(await check(user, ' gym10 ')).toMatchObject({ ok: true, percent: 10, code: 'GYM10' });
    expect((await check(user, 'NOPE')).reason).toBe('unknown');
    expect((await check(user, 'OFF10')).reason).toBe('unknown');
    expect((await check(user, 'OLD10')).reason).toBe('ended');

    // A bad code stops the payment instead of charging full price quietly.
    expect((await handleOrder(deps(), user, { plan: 'yearly', coupon: 'NOPE' })).status).toBe(400);
    expect(
      (await handleOrder(deps(), user, { plan: 'coach_monthly', coupon: 'GYM10' })).status,
    ).toBe(400);

    // Starting a payment does not use the code up; paying does.
    const abandoned = await handleOrder(deps(), user, { plan: 'yearly', coupon: 'gym10' });
    expect(abandoned.body.amount).toBe(134900);
    expect((await check(user, 'GYM10')).ok).toBe(true);
    const paid = await payOnce(user, 'yearly', 'pay_c1', 'GYM10');
    expect(paid.body.amount).toBe(134900);
    expect(near((await mine(user)).pro_expires_at, Date.now() + 365 * DAY)).toBe(true);
    const uses = await server.pg.query<{ code: string; discount_inr: string }>(
      'select code, discount_inr from public.coupon_uses where user_id = $1',
      [user],
    );
    expect(uses.rows).toEqual([{ code: 'GYM10', discount_inr: '150.00' }]);
    expect((await check(user, 'ONCE20')).reason).toBe('already_used');
    expect((await handleOrder(deps(), user, { plan: 'monthly', coupon: 'ONCE20' })).status).toBe(
      400,
    );
    // Without a code they still pay the normal price.
    expect((await handleOrder(deps(), user, { plan: 'monthly' })).body.amount).toBe(14900);

    // A code with a limit runs out.
    const a = await server.createUser('coupon-a@example.com');
    const b = await server.createUser('coupon-b@example.com');
    expect((await payOnce(a, 'monthly', 'pay_c2', 'ONCE20')).body.amount).toBe(11900);
    expect((await check(b, 'ONCE20')).reason).toBe('used_up');
  });

  it('coupons on autopay: the first period is paid up front at the lower price, then the plan runs', async () => {
    const user = await server.createUser('coupon-auto@example.com');
    const started = await handleSubscribe(deps(), user, { plan: 'quarterly', coupon: 'GYM10' });
    expect(started.status).toBe(200);
    expect(started.body.first_charge_paise).toBe(35900);
    const sub = subs.get(started.body.subscription_id as string)!;
    expect(sub.upfront).toBe(35900);
    const start = sub.start_at! * 1000;
    expect(near(start, Date.now() + 91 * DAY, 3 * DAY)).toBe(true);
    expect(sub.notes.coupon).toBe('GYM10');

    // Nothing is given, and the code is not used, until the payment is confirmed.
    expect((await mine(user)).pro_expires_at).toBeNull();
    sub.status = 'authenticated';
    // The webhook alone is enough (the person closed the window early)...
    await webhook('subscription.authenticated', sub, 'evt_ca1');
    let s = await mine(user);
    expect(new Date(s.pro_expires_at as string).getTime()).toBe(start);
    // ...and the checkout answer on top changes nothing.
    await verifySub(user, sub.id, 'pay_ca1');
    s = await mine(user);
    expect(new Date(s.pro_expires_at as string).getTime()).toBe(start);
    const uses = await server.pg.query<{ code: string; discount_inr: string; payment_ref: string }>(
      'select code, discount_inr, payment_ref from public.coupon_uses where user_id = $1',
      [user],
    );
    expect(uses.rows).toEqual([{ code: 'GYM10', discount_inr: '40.00', payment_ref: sub.id }]);

    // The first normal charge, three months in, carries on at the full price.
    Object.assign(sub, { status: 'active', current_end: Math.floor((start + 91 * DAY) / 1000) });
    await webhook('subscription.charged', sub, 'evt_ca2');
    expect(near((await mine(user)).pro_expires_at, start + 91 * DAY)).toBe(true);
  });

  it('keeps coupons closed to the app', async () => {
    const user = await server.createUser('coupon-snoop@example.com');
    for (const sql of [
      'select * from public.coupons',
      'select * from public.coupon_uses',
      `insert into public.coupons (code) values ('FREE50')`,
      `select public.coupon_status('${user}', 'GYM10')`,
      `select public.billing_coupon_redeem('${user}', 'GYM10', 'x', 10)`,
      `select public.billing_order_create('${user}', 'monthly', 'order_y', 1, 'GYM10', 148)`,
    ]) {
      await expect(
        server.asUser(user, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow();
    }
  });

  it('members on an old price keep what they paid for, stop renewing, and move to the new prices', async () => {
    const user = await server.createUser('legacy@example.com');
    const other = await server.createUser('current@example.com');
    const oldSub = (await handleSubscribe(deps(), user, { plan: 'monthly' })).body
      .subscription_id as string;
    await activate(oldSub, 20, 'evt_lg1');
    const otherSub = (await handleSubscribe(deps(), other, { plan: 'monthly' })).body
      .subscription_id as string;
    await activate(otherSub, 20, 'evt_lg2');
    // What the prices migration does to subscriptions that were running when prices changed.
    await server.pg.query(
      'update public.subscriptions set legacy_price = true where user_id = $1',
      [user],
    );
    const paidUntil = (await mine(user)).pro_expires_at;
    expect((await mine(user)).legacy_price).toBe(true);

    const out = await handleRetireLegacy(deps());
    expect(out.body).toMatchObject({ found: 1, stopped: 1, failed: [] });
    let s = await mine(user);
    expect(s.cancel_at_period_end).toBe(true);
    expect(s.pro_expires_at).toBe(paidUntil);
    // Nobody at today's price is touched, and a second call finds nothing left.
    expect((await mine(other)).cancel_at_period_end).toBe(false);
    expect((await handleRetireLegacy(deps())).body).toMatchObject({ found: 0, stopped: 0 });

    // They pick a plan at the new price, to start when the paid time ends; the mark comes off.
    const next = await handleSubscribe(deps(), user, { plan: 'yearly' });
    expect(next.status).toBe(200);
    expect(next.body.starts_at).toBeTruthy();
    s = await mine(user);
    expect(s.legacy_price).toBe(false);
    expect(s.pro_expires_at).toBe(paidUntil);
  });

  it('an old-price plan that was missed stops after the renewal that reveals it', async () => {
    const user = await server.createUser('legacy-late@example.com');
    const subId = (await handleSubscribe(deps(), user, { plan: 'monthly' })).body
      .subscription_id as string;
    await activate(subId, 2, 'evt_ll1');
    await server.pg.query(
      'update public.subscriptions set legacy_price = true where user_id = $1',
      [user],
    );
    Object.assign(subs.get(subId)!, { current_end: Math.floor((Date.now() + 32 * DAY) / 1000) });
    await webhook('subscription.charged', subs.get(subId)!, 'evt_ll2');
    const s = await mine(user);
    expect(near(s.pro_expires_at, Date.now() + 32 * DAY)).toBe(true);
    expect(s.cancel_at_period_end).toBe(true);
  });

  it('the first code exists, and the owner can see how each code is doing', async () => {
    const user = await server.createUser('rishi@example.com');
    expect((await payOnce(user, 'quarterly', 'pay_r1', 'rishi10')).body.amount).toBe(35900);
    const report = await server.pg.query<{
      code: string;
      times_used: number;
      discount_given_inr: string;
    }>(
      `select code, times_used, discount_given_inr from public.coupon_report where code in ('RISHI10', 'OFF10') order by code`,
    );
    expect(report.rows).toEqual([
      { code: 'OFF10', times_used: 0, discount_given_inr: '0.00' },
      { code: 'RISHI10', times_used: 1, discount_given_inr: '40.00' },
    ]);
    await expect(
      server.asUser(user, (tx) => tx.query('select * from public.coupon_report')),
    ).rejects.toThrow();
  });
  it('early members get a code of their own: 15% off one payment, typed, and nobody else can use it', async () => {
    const early = await server.createUser('early15@example.com');
    const later = await server.createUser('later-member@example.com');
    await server.pg.query(
      'update public.subscriptions set early_member = true where user_id = $1',
      [early],
    );
    const check = async (u: string, code: string) =>
      (
        await server.asUser(u, (tx) =>
          tx.query<{ c: { ok: boolean; percent?: number; reason?: string } }>(
            'select public.check_coupon($1) as c',
            [code],
          ),
        )
      ).rows[0]!.c;
    expect(await check(early, 'early15')).toMatchObject({ ok: true, percent: 15 });
    expect((await check(later, 'EARLY15')).reason).toBe('early_only');
    const refused = await handleOrder(deps(), later, { plan: 'monthly', coupon: 'EARLY15' });
    expect(refused.status).toBe(400);
    expect(String(refused.body.error)).toContain('before the new prices');

    // The app is told the code only for the early member, and nothing comes off without typing it.
    expect(await mine(early)).toMatchObject({ early_code: 'EARLY15', early_percent: 15 });
    expect((await mine(later)).early_code).toBeNull();
    expect((await handleOrder(deps(), early, { plan: 'monthly' })).body.amount).toBe(14900);

    // 15% off 149 is 127 (whole rupees), once. Then the code is gone for them.
    expect((await payOnce(early, 'monthly', 'pay_early15', 'EARLY15')).body.amount).toBe(12700);
    expect((await mine(early)).early_code).toBeNull();
    expect((await check(early, 'EARLY15')).reason).toBe('already_used');
    expect((await handleOrder(deps(), early, { plan: 'monthly' })).body.amount).toBe(14900);

    // An account cannot mark itself.
    await expect(
      server.asUser(later, (tx) =>
        tx.query('update public.subscriptions set early_member = true where user_id = $1', [later]),
      ),
    ).rejects.toThrow();
  });
});
