/**
 * Razorpay subscriptions for Overload Pro: the server side, shared by the `billing` Edge
 * Function (Deno, deployed) and the local fake Supabase used by end-to-end tests (Node). It has
 * no imports, so it runs unchanged in both: Web Crypto, fetch and plain objects only.
 *
 * Trust rules:
 * - The app never decides access. Pro is granted only after a Razorpay signature checks out
 *   against a secret held here, and the period end comes from Razorpay itself.
 * - The checkout signature is checked against the subscription id stored on the server for that
 *   account, never the one the browser sends back.
 * - Webhooks are checked with the webhook secret and applied once per event id.
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

const PLAN_IDS = ['monthly', 'quarterly', 'yearly'] as const;
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
  current_subscription_id: string | null;
  current_status: string | null;
  current_months: number | null;
  cancel_at_period_end: boolean;
  pro_expires_at: string | null;
}

async function checkoutInfo(
  deps: BillingDeps,
  userId: string,
  plan: PlanId | null,
): Promise<CheckoutInfo | null> {
  return ((await deps.rpc('billing_checkout_info', { p_user: userId, p_plan: plan })) ??
    null) as CheckoutInfo | null;
}

/** Creates a Razorpay subscription for the chosen plan and returns what Checkout needs. */
export async function handleSubscribe(
  deps: BillingDeps,
  userId: string,
  body: unknown,
): Promise<BillingResponse> {
  const plan = (body as { plan?: unknown } | null)?.plan;
  if (typeof plan !== 'string' || !PLAN_IDS.includes(plan as PlanId)) {
    return fail(400, 'Choose a plan.');
  }
  const info = await checkoutInfo(deps, userId, plan as PlanId);
  if (!info) return fail(409, 'Your account is still being set up. Try again in a minute.');
  if (!info.plan_exists) return fail(400, 'That plan is not available.');
  if (!info.razorpay_plan_id || !info.total_count) return fail(409, 'This plan is not open yet.');
  const live =
    info.current_subscription_id &&
    info.current_status &&
    info.current_status !== 'created' &&
    LIVE.has(info.current_status);
  if (live && !info.cancel_at_period_end) {
    return fail(409, 'You already have a Pro plan. Cancel it first to change plans.');
  }
  if (live && info.cancel_at_period_end) {
    return fail(409, 'Your plan ends soon. You can choose a plan again once it ends.');
  }
  const created = asSubscription(
    await deps.razorpay('POST', '/subscriptions', {
      plan_id: info.razorpay_plan_id,
      total_count: info.total_count,
      quantity: 1,
      customer_notify: 1,
      notes: { user_id: userId, plan },
    }),
  );
  if (!created) return fail(502, 'Could not start the payment. Try again.');
  await deps.rpc('billing_attach', {
    p_user: userId,
    p_plan: plan,
    p_subscription: created.id,
  });
  return ok({ subscription_id: created.id, key_id: deps.config.keyId });
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
  const status = STATUSES.has(sub.status) ? sub.status : 'active';
  const end = periodEnd(sub, info.current_months ?? 1, deps.now?.() ?? new Date());
  await deps.rpc('billing_activate', {
    p_subscription: stored,
    p_period_end: end.toISOString(),
    p_status: status === 'created' ? 'authenticated' : status,
  });
  return ok({ active: true, pro_expires_at: end.toISOString() });
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

const MONTHS_FALLBACK: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

export async function handleWebhook(
  deps: BillingDeps,
  rawBody: string,
  signature: string | null,
  eventId: string | null,
): Promise<BillingResponse> {
  if (!signature || !(await webhookSignatureValid(deps.config.webhookSecret, rawBody, signature))) {
    return fail(401, 'Bad signature');
  }
  let payload: { event?: string; payload?: { subscription?: { entity?: unknown } } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail(400, 'Bad body');
  }
  const event = payload.event ?? '';
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
      return ok({ applied: event });
    }
    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.halted':
    case 'subscription.pending':
    case 'subscription.authenticated':
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
