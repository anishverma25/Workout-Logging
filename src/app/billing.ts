import { useEffect, useState } from 'react';
import { supabase } from '@/data/sync/supabase';
import { refreshEntitlement } from './entitlement';

/**
 * Pro plans and Razorpay Checkout. The app only starts a payment and shows Razorpay's own
 * checkout; the server creates the subscription, checks the payment signature and turns Pro on.
 * Nothing here can grant access, and prices come from the server's billing_plans table.
 */

export type ProPlanId = 'monthly' | 'quarterly' | 'yearly';
export type CoachingPlanId = 'coach_monthly';

export interface BillingPlan {
  id: ProPlanId;
  label: string;
  months: number;
  priceInr: number;
  /** Price of one payment with no renewal. */
  oncePriceInr: number;
  /** Connected to a Razorpay plan, so it can be bought. */
  available: boolean;
}

export class BillingError extends Error {}

/** The 1:1 coaching plan: a month of coaching with Pro included (November 2026). */
export interface CoachingPlan extends Omit<BillingPlan, 'id'> {
  id: CoachingPlanId;
}

let cached: BillingPlan[] | null = null;
let cachedCoaching: CoachingPlan | null = null;
let inflight: Promise<BillingPlan[]> | null = null;

const toPlan = (p: Record<string, unknown>) => ({
  label: String(p.label),
  months: Number(p.months),
  priceInr: Number(p.price_inr),
  oncePriceInr: Number(p.once_price_inr ?? p.price_inr),
  available: p.available === true,
});

async function load(): Promise<BillingPlan[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_billing_plans');
  if (error || !Array.isArray(data)) return cached ?? [];
  const rows = data as Record<string, unknown>[];
  // Only the known Pro plans go on the Pro page; servers before coaching have no `kind`.
  cached = rows
    .filter((p) => p.id === 'monthly' || p.id === 'quarterly' || p.id === 'yearly')
    .map((p) => ({ id: p.id as ProPlanId, ...toPlan(p) }));
  const coach = rows.find((p) => p.id === 'coach_monthly' && Number(p.price_inr) > 0);
  cachedCoaching = coach ? { id: 'coach_monthly', ...toPlan(coach) } : null;
  return cached;
}

function fetchPlans(): Promise<BillingPlan[]> {
  inflight ??= load().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** The plans, or null while loading. Empty when accounts are off or the server is unreachable. */
export function usePlans(): BillingPlan[] | null {
  const [plans, setPlans] = useState<BillingPlan[] | null>(cached);
  useEffect(() => {
    let live = true;
    void fetchPlans().then((p) => {
      if (live) setPlans(p);
    });
    return () => {
      live = false;
    };
  }, []);
  return plans;
}

/**
 * The coaching plan: undefined while loading, null when the server has none (an older server,
 * or accounts are off).
 */
export function useCoachingPlan(): CoachingPlan | null | undefined {
  const [plan, setPlan] = useState<CoachingPlan | null | undefined>(
    cached ? cachedCoaching : undefined,
  );
  useEffect(() => {
    let live = true;
    void fetchPlans().then(() => {
      if (live) setPlan(cachedCoaching);
    });
    return () => {
      live = false;
    };
  }, []);
  return plan;
}

/** Price per month, for comparing plans honestly. */
export const perMonth = (p: BillingPlan) => p.priceInr / p.months;

/** Percent saved per month against the monthly plan, rounded down. Null when there is none. */
export function savingPercent(plan: BillingPlan, plans: BillingPlan[]): number | null {
  const monthly = plans.find((p) => p.id === 'monthly');
  if (!monthly || plan.id === 'monthly') return null;
  const pct = Math.floor((1 - perMonth(plan) / perMonth(monthly)) * 100);
  return pct > 0 ? pct : null;
}

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------------------------
// Coupon codes
// ---------------------------------------------------------------------------------------------

export interface Coupon {
  code: string;
  percent: number;
}

const COUPON_REASONS: Record<string, string> = {
  unknown: 'That code is not valid. Check the spelling.',
  ended: 'That code has ended.',
  used_up: 'That code has been used up.',
  already_used: 'A code has already been used on this account. Each account gets one.',
};

/**
 * Asks the server whether a code works for this account. This only shows the lower price; the
 * server checks the code again when the payment starts and decides what is charged.
 */
export async function checkCoupon(code: string): Promise<Coupon> {
  if (!supabase) throw new BillingError('Accounts are not set up in this version of the app.');
  const { data, error } = await supabase.rpc('check_coupon', { p_code: code });
  if (error) throw new BillingError('Could not check the code. Try again.');
  const r = (data ?? {}) as { ok?: boolean; code?: string; percent?: number; reason?: string };
  if (!r.ok || typeof r.code !== 'string' || typeof r.percent !== 'number') {
    throw new BillingError(COUPON_REASONS[r.reason ?? 'unknown'] ?? COUPON_REASONS.unknown!);
  }
  return { code: r.code, percent: r.percent };
}

export interface TrialOffer {
  percent: number;
  endsAt: Date;
}

/** The 48 hour offer after the trial ends, when open for this account (migration 0027). */
export async function getTrialOffer(): Promise<TrialOffer | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_trial_offer');
    if (error || !data) return null;
    const d = data as { percent?: unknown; ends_at?: unknown };
    if (typeof d.percent !== 'number' || typeof d.ends_at !== 'string') return null;
    const endsAt = new Date(d.ends_at);
    return endsAt.getTime() > Date.now() ? { percent: d.percent, endsAt } : null;
  } catch {
    return null;
  }
}

/** The price after a coupon, in whole rupees: the same rounding the server uses. */
export const withCoupon = (priceInr: number, coupon: Coupon | null): number =>
  coupon ? Math.round((priceInr * (100 - coupon.percent)) / 100) : priceInr;

// ---------------------------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------------------------

/** The window was closed after a payment attempt failed; `reason` is Razorpay's own wording. */
export interface CheckoutClosed {
  result: 'closed';
  failed: string | null;
}
export type CheckoutResult = { result: 'paid' } | CheckoutClosed;

/** Razorpay's reason for a failed attempt, in words a person can act on. */
export function failureReason(event: unknown): string {
  const err = (event as { error?: { description?: unknown; reason?: unknown } } | null)?.error;
  const text = typeof err?.description === 'string' ? err.description.trim() : '';
  if (text && text.length <= 200) return text.endsWith('.') ? text : `${text}.`;
  return 'The payment did not go through.';
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (e: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new BillingError('Could not load the payment window. Check your connection.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

async function call<T>(
  route: 'subscribe' | 'order' | 'verify' | 'cancel',
  body: Record<string, unknown>,
): Promise<T> {
  if (!supabase) throw new BillingError('Accounts are not set up in this version of the app.');
  const { data, error } = await supabase.functions.invoke(`billing/${route}`, { body });
  if (error) {
    let message = 'Something went wrong. Try again.';
    try {
      const ctx = (error as { context?: Response }).context;
      const json = ctx ? ((await ctx.json()) as { error?: string }) : null;
      if (json?.error) message = json.error;
    } catch {
      // Keep the general message.
    }
    throw new BillingError(message);
  }
  return data as T;
}

/** The lime the checkout window uses, read from the theme tokens. */
const themeColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--lime').trim() || undefined;

/**
 * Opens Razorpay Checkout for a plan. Resolves 'paid' once the server has confirmed the
 * payment and Pro is on, 'closed' if the person closes the window.
 */
export async function startCheckout(
  plan: ProPlanId | CoachingPlanId,
  prefill: { email?: string | null; name?: string | null },
  mode: 'subscribe' | 'once' = 'subscribe',
  coupon: string | null = null,
): Promise<CheckoutResult> {
  const body = coupon ? { plan, coupon } : { plan };
  const [started] = await Promise.all([
    mode === 'once'
      ? call<{ order_id: string; amount: number; key_id: string }>('order', body)
      : call<{ subscription_id: string; key_id: string }>('subscribe', body),
    loadCheckout(),
  ]);
  const { key_id } = started;
  // A subscription opens Checkout with its id; a single payment with its order and amount.
  const target =
    'order_id' in started
      ? { order_id: started.order_id, amount: started.amount, currency: 'INR' }
      : { subscription_id: started.subscription_id };
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new BillingError('Could not load the payment window. Try again.');
  return new Promise((resolve, reject) => {
    let failed: string | null = null;
    const checkout = new Razorpay({
      key: key_id,
      ...target,
      name: plan === 'coach_monthly' ? 'Macrotrophy 1:1 coaching' : 'Macrotrophy Pro',
      description:
        plan === 'coach_monthly'
          ? mode === 'once'
            ? 'One month of coaching with Pro'
            : 'Monthly coaching with Pro'
          : mode === 'once'
            ? 'Pro, paid once'
            : 'Pro plan',
      prefill: { email: prefill.email ?? undefined, name: prefill.name ?? undefined },
      theme: { color: themeColor() },
      handler: (response: RazorpayResponse) => {
        call('verify', { ...response })
          .then(() => refreshEntitlement())
          .then(() => resolve({ result: 'paid' }))
          .catch(reject);
      },
      modal: { ondismiss: () => resolve({ result: 'closed', failed }), confirm_close: true },
    });
    checkout.on('payment.failed', (event) => {
      // Razorpay shows the failure and lets the person retry inside the window. If they close
      // it instead, the page says why it failed and offers the other way to pay.
      failed = failureReason(event);
    });
    checkout.open();
  });
}

/** Turns renewal off. Pro stays on until the end of the period already paid for. */
export async function cancelPlan(): Promise<void> {
  await call('cancel', {});
  await refreshEntitlement();
}
