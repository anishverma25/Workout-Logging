import { useEffect, useState } from 'react';
import { supabase } from '@/data/sync/supabase';
import { refreshEntitlement } from './entitlement';

/**
 * Pro plans and Razorpay Checkout. The app only starts a payment and shows Razorpay's own
 * checkout; the server creates the subscription, checks the payment signature and turns Pro on.
 * Nothing here can grant access, and prices come from the server's billing_plans table.
 */

export interface BillingPlan {
  id: 'monthly' | 'quarterly' | 'yearly';
  label: string;
  months: number;
  priceInr: number;
  /** Connected to a Razorpay plan, so it can be bought. */
  available: boolean;
}

export class BillingError extends Error {}

let cached: BillingPlan[] | null = null;

async function fetchPlans(): Promise<BillingPlan[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_billing_plans');
  if (error || !Array.isArray(data)) return cached ?? [];
  cached = (data as Record<string, unknown>[])
    .filter((p) => p.id === 'monthly' || p.id === 'quarterly' || p.id === 'yearly')
    .map((p) => ({
      id: p.id as BillingPlan['id'],
      label: String(p.label),
      months: Number(p.months),
      priceInr: Number(p.price_inr),
      available: p.available === true,
    }));
  return cached;
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
// Checkout
// ---------------------------------------------------------------------------------------------

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
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
  route: 'subscribe' | 'verify' | 'cancel',
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
  plan: BillingPlan['id'],
  prefill: { email?: string | null; name?: string | null },
): Promise<'paid' | 'closed'> {
  const [{ subscription_id, key_id }] = await Promise.all([
    call<{ subscription_id: string; key_id: string }>('subscribe', { plan }),
    loadCheckout(),
  ]);
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new BillingError('Could not load the payment window. Try again.');
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: key_id,
      subscription_id,
      name: 'Overload Pro',
      description: 'Pro plan',
      prefill: { email: prefill.email ?? undefined, name: prefill.name ?? undefined },
      theme: { color: themeColor() },
      handler: (response: RazorpayResponse) => {
        call('verify', { ...response })
          .then(() => refreshEntitlement())
          .then(() => resolve('paid'))
          .catch(reject);
      },
      modal: { ondismiss: () => resolve('closed'), confirm_close: true },
    });
    checkout.on('payment.failed', () => {
      // Razorpay shows the failure and lets the person retry inside the window.
    });
    checkout.open();
  });
}

/** Turns renewal off. Pro stays on until the end of the period already paid for. */
export async function cancelPlan(): Promise<void> {
  await call('cancel', {});
  await refreshEntitlement();
}
