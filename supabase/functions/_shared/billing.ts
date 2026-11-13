/**
 * Razorpay subscriptions for Macrotrophy Pro: the server side, shared by the `billing` Edge
 * Function (Deno, deployed) and the local fake Supabase used by end-to-end tests (Node). It has
 * no imports, so it runs unchanged in both: Web Crypto, fetch and plain objects only.
 *
 * Trust rules:
 * - The app never decides access. Pro is granted only after a Razorpay signature checks out
 *   against a secret held here, and the period end comes from Razorpay itself.
 * - The checkout signature is checked against the subscription id stored on the server for that
 *   account, never the one the browser sends back.
 * - Webhooks are checked with the webhook secret and applied once per event id.
 * - Pay once: the server creates the Razorpay order for a price it holds, the checkout signature
 *   is checked against the order stored for that account, and a paid order adds Pro time once,
 *   whether the checkout response or the `order.paid` webhook arrives first.
 */

export interface BillingConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export interface BillingDeps {
  config: BillingConfig;
  /** Calls the Razorpay REST API (https://api.razorpay.com/v1) with the key pair. */
  razorpay: (method: 'GET' | 'POST', path: string, body?: unknown) => Promise<unknown>;
  /** Runs a billing_* SQL function as the service role. */
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  now?: () => Date;
}

export interface BillingResponse {
  status: number;
  body: Record<string, unknown>;
}

/** Pro plans, and the 1:1 coaching plan (which includes Pro for its month). */
const PLAN_IDS = ['monthly', 'quarterly', 'yearly', 'coach_monthly'] as const;
type PlanId = (typeof PLAN_IDS)[number];

const ok = (body: Record<string, unknown>): BillingResponse => ({ status: 200, body });
const fail = (status: number, message: string): BillingResponse => ({
  status,
  body: { error: message },
});

// ---------------------------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------------------------

const encoder = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares in constant time for equal lengths. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checkout success: HMAC-SHA256 of "payment_id|subscription_id" with the key secret. */
export async function checkoutSignatureValid(
  keySecret: string,
  paymentId: string,
  subscriptionId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(keySecret, `${paymentId}|${subscriptionId}`);
  return safeEqual(expected, signature);
}

/** One-time checkout success: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export async function orderSignatureValid(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
  return safeEqual(expected, signature);
}

/** Webhook: HMAC-SHA256 of the raw request body with the webhook secret. */
export async function webhookSignatureValid(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return safeEqual(expected, signature);
}

// ---------------------------------------------------------------------------------------------
// Razorpay objects
// ---------------------------------------------------------------------------------------------

interface RazorpaySubscription {
  id: string;
  status: string;
  current_end?: number | null;
  notes?: Record<string, string> | null;
}

const STATUSES = new Set([
  'created',
  'authenticated',
  'active',
  'pending',
  'halted',
  'cancelled',
  'completed',
  'expired',
]);

function asSubscription(value: unknown): RazorpaySubscription | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.status !== 'string') return null;
  return {
    id: v.id,
    status: v.status,
    current_end: typeof v.current_end === 'number' ? v.current_end : null,
    notes: (v.notes as Record<string, string> | null) ?? null,
  };
}

/** The end of the paid period: Razorpay's current_end, else now plus the plan's months. */
export function periodEnd(sub: RazorpaySubscription, months: number, now: Date): Date {
  if (sub.current_end && sub.current_end * 1000 > now.getTime()) {
    return new Date(sub.current_end * 1000);
  }
  const end = new Date(now);
  end.setMonth(end.getMonth() + months);
  return end;
}

const LIVE = new Set(['created', 'authenticated', 'active', 'pending']);

// ---------------------------------------------------------------------------------------------
// Requests from the signed-in app
// ---------------------------------------------------------------------------------------------

interface CheckoutInfo {
  plan_exists: boolean;
  razorpay_plan_id: string | null;
  total_count: number | null;
  months: number | null;
  /** Renewing price. Servers before migration 0024 leave it out. */
  price_inr?: number | null;
  plan_kind?: 'pro' | 'coaching' | null;
  once_price_inr: number | null;
  current_subscription_id: string | null;
  current_status: string | null;
  current_months: number | null;
  current_kind?: 'subscription' | 'once' | null;
  cancel_at_period_end: boolean;
  pro_expires_at: string | null;
}

/** Razorpay is still trying to take a renewal; nothing else can start until that is settled. */
const STUCK = new Set(['pending', 'halted']);

/** A subscription that will charge again by itself. A plan paid once since then does not count. */
function renewing(info: CheckoutInfo): boolean {
  return (
    !!info.current_subscription_id &&
    info.current_kind !== 'once' &&
    (info.current_status === 'active' || info.current_status === 'authenticated') &&
    !info.cancel_at_period_end
  );
}

/**
 * A subscription stuck on a failed renewal (pending or halted) is cancelled at once, so the person
 * can pay again, either way. Pro already paid for stays until its end date.
 */
async function settleStuck(
  deps: BillingDeps,
  userId: string,
  plan: PlanId,
  info: CheckoutInfo,
): Promise<CheckoutInfo | null> {
  const stored = info.current_subscription_id;
  if (!stored || !info.current_status || !STUCK.has(info.current_status)) return info;
  if (info.current_kind === 'once') return info;
  await deps.razorpay('POST', `/subscriptions/${stored}/cancel`, { cancel_at_cycle_end: 0 });
  await deps.rpc('billing_set_status', {
    p_subscription: stored,
    p_status: 'cancelled',
    p_cancel_at_period_end: true,
  });
  return checkoutInfo(deps, userId, plan);
}

// ---------------------------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------------------------

/** What lowers a payment: a code the person typed, or a thank-you credit they hold. */
interface Coupon {
  /** The coupon code; null for a credit. */
  code: string | null;
  percent: number;
  /** A thank-you credit for a food they added to the shared library (migration 0025). */
  credit?: string;
}

/** The thank-you credit open for this account today, if any. Servers before 0025 have none. */
async function creditFor(
  deps: BillingDeps,
  userId: string,
  info: CheckoutInfo,
): Promise<Coupon | null> {
  if (info.plan_kind && info.plan_kind !== 'pro') return null;
  try {
    const c = (await deps.rpc('billing_credit', { p_user: userId })) as {
      id?: string;
      percent?: number;
    } | null;
    if (!c || typeof c.id !== 'string' || typeof c.percent !== 'number') return null;
    return { code: null, percent: c.percent, credit: c.id };
  } catch {
    return null;
  }
}

const COUPON_REASONS: Record<string, string> = {
  unknown: 'That code is not valid. Check the spelling.',
  ended: 'That code has ended.',
  used_up: 'That code has been used up.',
  already_used: 'A code has already been used on this account. Each account gets one.',
  early_only: 'That code is for members who joined before the new prices.',
};

/** The coupon in the request, checked on the server: null for none, or an error response. */
async function couponFrom(
  deps: BillingDeps,
  userId: string,
  body: unknown,
  info: CheckoutInfo,
): Promise<Coupon | null | BillingResponse> {
  const raw = (body as { coupon?: unknown } | null)?.coupon;
  // No code typed: only a food thank-you credit applies by itself.
  if (raw === undefined || raw === null || raw === '') return creditFor(deps, userId, info);
  if (typeof raw !== 'string' || raw.length > 40) return fail(400, COUPON_REASONS.unknown!);
  if (info.plan_kind && info.plan_kind !== 'pro') return fail(400, 'Codes work on Pro plans.');
  const status = (await deps.rpc('coupon_status', { p_user: userId, p_code: raw })) as {
    ok?: boolean;
    code?: string;
    percent?: number;
    reason?: string;
  } | null;
  if (!status?.ok || typeof status.code !== 'string' || typeof status.percent !== 'number') {
    return fail(400, COUPON_REASONS[status?.reason ?? 'unknown'] ?? COUPON_REASONS.unknown!);
  }
  return { code: status.code, percent: status.percent };
}

/** The price after the coupon, in paise, rounded to whole rupees. */
export function discountedPaise(priceInr: number, percent: number): number {
  return Math.round((priceInr * (100 - percent)) / 100) * 100;
}

const isResponse = (v: unknown): v is BillingResponse =>
  !!v && typeof v === 'object' && 'status' in v && 'body' in v;

/** How far ahead a renewing plan may start: only when paid Pro time is left. */
const START_LATER_MIN_MS = 60 * 60 * 1000;

async function checkoutInfo(
  deps: BillingDeps,
  userId: string,
  plan: PlanId | null,
): Promise<CheckoutInfo | null> {
  return ((await deps.rpc('billing_checkout_info', { p_user: userId, p_plan: plan })) ??
    null) as CheckoutInfo | null;
}

/**
 * Creates a Razorpay subscription for the chosen plan and returns what Checkout needs.
 *
 * - Someone with Pro time left (paid once, or a plan set to end) starts the new plan when that
 *   time runs out, so nothing is paid twice.
 * - A coupon takes its percent off the first period, charged up front as an add-on; the plan's
 *   own charges then start after that period.
 * - The Razorpay plan's amount must match the price on the server, so a plan left over from old
 *   prices can never charge the wrong amount.
 */
export async function handleSubscribe(
  deps: BillingDeps,
  userId: string,
  body: unknown,
): Promise<BillingResponse> {
  const plan = (body as { plan?: unknown } | null)?.plan;
  if (typeof plan !== 'string' || !PLAN_IDS.includes(plan as PlanId)) {
    return fail(400, 'Choose a plan.');
  }
  let info = await checkoutInfo(deps, userId, plan as PlanId);
  if (!info) return fail(409, 'Your account is still being set up. Try again in a minute.');
  if (!info.plan_exists) return fail(400, 'That plan is not available.');
  if (!info.razorpay_plan_id || !info.total_count) {
    return fail(409, 'Autopay for this plan opens soon. You can pay once now.');
  }
  info = await settleStuck(deps, userId, plan as PlanId, info);
  if (!info) return fail(409, 'Your account is still being set up. Try again in a minute.');
  if (renewing(info)) {
    return fail(
      409,
      'Your Pro already renews by itself. To change plan or pay once, turn renewal off first; the time you paid for stays.',
    );
  }
  const coupon = await couponFrom(deps, userId, body, info);
  if (isResponse(coupon)) return coupon;

  const price = Number(info.price_inr ?? 0);
  if (price > 0) {
    const rzPlan = (await deps.razorpay('GET', `/plans/${info.razorpay_plan_id}`)) as {
      item?: { amount?: unknown };
    } | null;
    const amount = Number(rzPlan?.item?.amount);
    if (!Number.isFinite(amount)) {
      return fail(502, 'Could not reach Razorpay. Try again, or pay once.');
    }
    if (amount !== Math.round(price * 100)) {
      return fail(409, 'Autopay for this plan opens soon. You can pay once now.');
    }
  } else if (coupon) {
    return fail(409, 'Codes work once this plan is updated. Try again soon.');
  }

  const now = deps.now?.() ?? new Date();
  const months = info.months ?? 1;
  const expires = info.pro_expires_at ? new Date(info.pro_expires_at) : null;
  // Pro time already paid for: the plan starts when it runs out (Pro plans only; coaching
  // starts today).
  const paidLeft =
    info.plan_kind !== 'coaching' &&
    expires !== null &&
    expires.getTime() > now.getTime() + START_LATER_MIN_MS;
  const base = paidLeft ? expires! : now;
  let startAt: Date | null = paidLeft ? base : null;
  const notes: Record<string, string> = { user_id: userId, plan };
  const extra: Record<string, unknown> = {};
  if (coupon) {
    const upfront = discountedPaise(price, coupon.percent);
    startAt = new Date(base);
    startAt.setMonth(startAt.getMonth() + months);
    extra.addons = [
      { item: { name: `First period, ${coupon.percent}% off`, amount: upfront, currency: 'INR' } },
    ];
    if (coupon.code) notes.coupon = coupon.code;
    if (coupon.credit) notes.credit = coupon.credit;
    notes.upfront = '1';
    notes.discount = String(Math.round(price * 100 - upfront) / 100);
  }
  if (startAt) notes.start_at = String(Math.floor(startAt.getTime() / 1000));
  const created = asSubscription(
    await deps.razorpay('POST', '/subscriptions', {
      plan_id: info.razorpay_plan_id,
      total_count: info.total_count,
      quantity: 1,
      customer_notify: 1,
      ...(startAt ? { start_at: Math.floor(startAt.getTime() / 1000) } : {}),
      ...extra,
      notes,
    }),
  );
  if (!created) return fail(502, 'Could not start the payment. Try again.');
  await deps.rpc('billing_attach', {
    p_user: userId,
    p_plan: plan,
    p_subscription: created.id,
  });
  return ok({
    subscription_id: created.id,
    key_id: deps.config.keyId,
    starts_at: startAt ? startAt.toISOString() : null,
    first_charge_paise: coupon ? discountedPaise(price, coupon.percent) : null,
  });
}

/**
 * Stops every autopay still running at an old price at the end of its paid period. The member
 * keeps everything they paid for and chooses a plan at today's prices to continue. Called once by
 * the owner after a price change, and safe to call again. Returns how many were stopped.
 */
export async function handleRetireLegacy(deps: BillingDeps): Promise<BillingResponse> {
  const ids = ((await deps.rpc('billing_legacy_renewing', {})) ?? []) as string[];
  let stopped = 0;
  const failed: string[] = [];
  for (const id of ids) {
    if (await retireLegacy(deps, id)) stopped += 1;
    else failed.push(id);
  }
  return ok({ found: ids.length, stopped, failed });
}

async function retireLegacy(deps: BillingDeps, id: string): Promise<boolean> {
  const sub = asSubscription(
    await deps.razorpay('POST', `/subscriptions/${id}/cancel`, { cancel_at_cycle_end: 1 }),
  );
  if (!sub) return false;
  await deps.rpc('billing_set_status', {
    p_subscription: id,
    p_status: STATUSES.has(sub.status) ? sub.status : 'active',
    p_cancel_at_period_end: true,
  });
  return true;
}

/** A subscription that starts later: when, and whether its first period was paid up front. */
function laterStart(
  sub: RazorpaySubscription,
  now: Date,
): {
  at: Date;
  upfront: boolean;
  coupon: string | null;
  credit: string | null;
  discount: number;
} | null {
  const at = Number(sub.notes?.start_at);
  if (!Number.isFinite(at) || at * 1000 <= now.getTime()) return null;
  if (sub.status !== 'created' && sub.status !== 'authenticated') return null;
  return {
    at: new Date(at * 1000),
    upfront: sub.notes?.upfront === '1',
    coupon: sub.notes?.coupon ?? null,
    credit: sub.notes?.credit ?? null,
    discount: Number(sub.notes?.discount ?? 0) || 0,
  };
}

/**
 * A subscription that starts later was authenticated: an up-front first period gives Pro until
 * the plan's own charges start, and its coupon is recorded. Without an up-front payment nothing
 * is added: the person still has the time they paid for.
 */
async function applyLaterStart(
  deps: BillingDeps,
  subscriptionId: string,
  userId: string,
  later: NonNullable<ReturnType<typeof laterStart>>,
): Promise<void> {
  if (later.upfront) {
    await deps.rpc('billing_activate', {
      p_subscription: subscriptionId,
      p_period_end: later.at.toISOString(),
      p_status: 'authenticated',
    });
    if (later.coupon) {
      await deps.rpc('billing_coupon_redeem', {
        p_user: userId,
        p_code: later.coupon,
        p_ref: subscriptionId,
        p_discount: later.discount,
      });
    }
    if (later.credit) {
      await deps.rpc('billing_credit_use', { p_credit: later.credit, p_ref: subscriptionId });
    }
  } else {
    await deps.rpc('billing_set_status', {
      p_subscription: subscriptionId,
      p_status: 'authenticated',
      p_cancel_at_period_end: false,
    });
  }
}

/** Checkout reported success: verify it, then turn Pro on straight away. */
export async function handleVerify(
  deps: BillingDeps,
  userId: string,
  body: unknown,
): Promise<BillingResponse> {
  const b = (body ?? {}) as Record<string, unknown>;
  const paymentId = b.razorpay_payment_id;
  const signature = b.razorpay_signature;
  if (typeof paymentId !== 'string' || typeof signature !== 'string') {
    return fail(400, 'The payment details are incomplete.');
  }
  if (typeof b.razorpay_order_id === 'string') {
    return verifyOrder(deps, userId, b.razorpay_order_id, paymentId, signature);
  }
  const info = await checkoutInfo(deps, userId, null);
  const stored = info?.current_subscription_id;
  if (!info || !stored) return fail(409, 'No payment was started for this account.');
  // Checked against the subscription stored for this account, not the one sent back.
  if (!(await checkoutSignatureValid(deps.config.keySecret, paymentId, stored, signature))) {
    return fail(400, 'The payment could not be confirmed.');
  }
  const sub = asSubscription(await deps.razorpay('GET', `/subscriptions/${stored}`));
  if (!sub)
    return fail(502, 'Could not reach Razorpay. Your payment is safe; Pro will start shortly.');
  const now = deps.now?.() ?? new Date();
  const later = laterStart(sub, now);
  if (later) {
    await applyLaterStart(deps, stored, userId, later);
    return ok({
      active: true,
      starts_at: later.at.toISOString(),
      pro_expires_at: later.upfront ? later.at.toISOString() : info.pro_expires_at,
    });
  }
  const status = STATUSES.has(sub.status) ? sub.status : 'active';
  const end = periodEnd(sub, info.current_months ?? 1, now);
  await deps.rpc('billing_activate', {
    p_subscription: stored,
    p_period_end: end.toISOString(),
    p_status: status === 'created' ? 'authenticated' : status,
  });
  return ok({ active: true, pro_expires_at: end.toISOString() });
}

/** Creates a one-time Razorpay order for the chosen plan: one payment, no mandate. */
export async function handleOrder(
  deps: BillingDeps,
  userId: string,
  body: unknown,
): Promise<BillingResponse> {
  const plan = (body as { plan?: unknown } | null)?.plan;
  if (typeof plan !== 'string' || !PLAN_IDS.includes(plan as PlanId)) {
    return fail(400, 'Choose a plan.');
  }
  let info = await checkoutInfo(deps, userId, plan as PlanId);
  if (!info) return fail(409, 'Your account is still being set up. Try again in a minute.');
  if (!info.plan_exists || !info.once_price_inr) return fail(400, 'That plan is not available.');
  info = await settleStuck(deps, userId, plan as PlanId, info);
  if (!info) return fail(409, 'Your account is still being set up. Try again in a minute.');
  if (renewing(info)) {
    return fail(
      409,
      'Your Pro already renews by itself. To pay once instead, turn renewal off first; the time you paid for stays.',
    );
  }
  const coupon = await couponFrom(deps, userId, body, info);
  if (isResponse(coupon)) return coupon;
  const full = Math.round(Number(info.once_price_inr) * 100);
  const paise = coupon ? discountedPaise(Number(info.once_price_inr), coupon.percent) : full;
  const receipt = `ov_${userId.replaceAll('-', '').slice(0, 12)}_${Date.now().toString(36)}`;
  const created = (await deps.razorpay('POST', '/orders', {
    amount: paise,
    currency: 'INR',
    receipt,
    notes: {
      user_id: userId,
      plan,
      kind: 'once',
      ...(coupon?.code ? { coupon: coupon.code } : {}),
      ...(coupon?.credit ? { credit: coupon.credit } : {}),
    },
  })) as { id?: unknown } | null;
  if (!created || typeof created.id !== 'string') {
    return fail(502, 'Could not start the payment. Try again.');
  }
  await deps.rpc(
    'billing_order_create',
    coupon?.code
      ? {
          p_user: userId,
          p_plan: plan,
          p_order: created.id,
          p_amount: paise / 100,
          p_coupon: coupon.code,
          p_discount: (full - paise) / 100,
        }
      : { p_user: userId, p_plan: plan, p_order: created.id, p_amount: paise / 100 },
  );
  if (coupon?.credit) {
    await deps.rpc('billing_order_credit', {
      p_order: created.id,
      p_credit: coupon.credit,
      p_discount: (full - paise) / 100,
    });
  }
  return ok({ order_id: created.id, amount: paise, key_id: deps.config.keyId });
}

async function verifyOrder(
  deps: BillingDeps,
  userId: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<BillingResponse> {
  // The order must be one this account created; the signature then covers that order.
  const order = await deps.rpc('billing_order_info', { p_user: userId, p_order: orderId });
  if (!order) return fail(409, 'No payment was started for this account.');
  if (!(await orderSignatureValid(deps.config.keySecret, orderId, paymentId, signature))) {
    return fail(400, 'The payment could not be confirmed.');
  }
  const done = (await deps.rpc('billing_order_paid', {
    p_order: orderId,
    p_payment: paymentId,
  })) as { pro_expires_at?: string } | null;
  if (!done) return fail(409, 'No payment was started for this account.');
  return ok({ active: true, pro_expires_at: done.pro_expires_at ?? null });
}

/** Stops renewal. Pro stays on until the end of the period already paid for. */
export async function handleCancel(deps: BillingDeps, userId: string): Promise<BillingResponse> {
  const info = await checkoutInfo(deps, userId, null);
  const stored = info?.current_subscription_id;
  if (!stored || !info?.current_status || !LIVE.has(info.current_status)) {
    return fail(409, 'There is no plan to cancel.');
  }
  if (info.current_status === 'created') {
    await deps.rpc('billing_set_status', {
      p_subscription: stored,
      p_status: 'cancelled',
      p_cancel_at_period_end: false,
    });
    return ok({ cancelled: true });
  }
  await deps.razorpay('POST', `/subscriptions/${stored}/cancel`, { cancel_at_cycle_end: 1 });
  await deps.rpc('billing_set_status', {
    p_subscription: stored,
    p_status: info.current_status,
    p_cancel_at_period_end: true,
  });
  return ok({ cancelled: true, pro_expires_at: info.pro_expires_at });
}

// ---------------------------------------------------------------------------------------------
// Webhooks from Razorpay
// ---------------------------------------------------------------------------------------------

const MONTHS_FALLBACK: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
  coach_monthly: 1,
};

export async function handleWebhook(
  deps: BillingDeps,
  rawBody: string,
  signature: string | null,
  eventId: string | null,
): Promise<BillingResponse> {
  if (!signature || !(await webhookSignatureValid(deps.config.webhookSecret, rawBody, signature))) {
    return fail(401, 'Bad signature');
  }
  let payload: {
    event?: string;
    payload?: {
      subscription?: { entity?: unknown };
      order?: { entity?: { id?: unknown } };
      payment?: { entity?: { id?: unknown } };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail(400, 'Bad body');
  }
  const event = payload.event ?? '';
  if (event === 'order.paid') {
    const orderId = payload.payload?.order?.entity?.id;
    const paymentId = payload.payload?.payment?.entity?.id;
    if (typeof orderId !== 'string' || typeof paymentId !== 'string') return ok({ ignored: true });
    if (eventId && !(await deps.rpc('billing_record_event', { p_id: eventId, p_event: event }))) {
      return ok({ duplicate: true });
    }
    // Unknown orders (subscription charges also send order.paid) come back null and are ignored.
    const done = await deps.rpc('billing_order_paid', { p_order: orderId, p_payment: paymentId });
    return ok(done ? { applied: event } : { ignored: true });
  }
  const sub = asSubscription(payload.payload?.subscription?.entity);
  if (!event.startsWith('subscription.') || !sub) return ok({ ignored: true });
  if (eventId && !(await deps.rpc('billing_record_event', { p_id: eventId, p_event: event }))) {
    return ok({ duplicate: true });
  }
  const status = STATUSES.has(sub.status) ? sub.status : null;
  switch (event) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const months = MONTHS_FALLBACK[sub.notes?.plan ?? ''] ?? 1;
      await deps.rpc('billing_activate', {
        p_subscription: sub.id,
        p_period_end: periodEnd(sub, months, deps.now?.() ?? new Date()).toISOString(),
        p_status: status ?? 'active',
      });
      // An old-price plan the owner's one-time call missed renews no further than this period.
      const legacy = ((await deps.rpc('billing_legacy_renewing', {})) ?? []) as string[];
      if (legacy.includes(sub.id)) await retireLegacy(deps, sub.id);
      return ok({ applied: event });
    }
    case 'subscription.authenticated': {
      const later = laterStart(sub, deps.now?.() ?? new Date());
      const user = sub.notes?.user_id;
      if (later && typeof user === 'string') {
        await applyLaterStart(deps, sub.id, user, later);
        return ok({ applied: event });
      }
      if (status) {
        await deps.rpc('billing_set_status', {
          p_subscription: sub.id,
          p_status: status,
          p_cancel_at_period_end: null,
        });
      }
      return ok({ applied: event });
    }
    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.halted':
    case 'subscription.pending':
    case 'subscription.paused':
    case 'subscription.resumed':
    case 'subscription.updated':
      if (status) {
        await deps.rpc('billing_set_status', {
          p_subscription: sub.id,
          p_status: status,
          p_cancel_at_period_end: event === 'subscription.cancelled' ? true : null,
        });
      }
      return ok({ applied: event });
    default:
      return ok({ ignored: true });
  }
}
