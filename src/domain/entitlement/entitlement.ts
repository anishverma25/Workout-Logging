import { z } from 'zod';

/**
 * Who gets what. The single place access is decided: every Pro gate in the app calls
 * `hasFeature`, and nothing else reads plan data.
 *
 * Inputs come from the server (`get_my_subscription`): timestamps set by the database and the
 * server's own clock, so changing the device clock, local storage or the URL changes nothing.
 */

export const TRIAL_HOURS = 168;

const ts = z
  .string()
  .nullable()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), 'Invalid timestamp');

export const SubscriptionSnapshot = z.object({
  status: z.enum(['trialing', 'payment_pending', 'active', 'expired', 'revoked']),
  trial_started_at: ts,
  trial_expires_at: ts,
  pro_started_at: ts,
  pro_expires_at: ts,
  payment_reference: z.string().nullable(),
  payment_submitted_at: ts,
  updated_at: ts,
  server_now: ts,
});
export type SubscriptionSnapshot = z.infer<typeof SubscriptionSnapshot>;

export type Plan = 'guest' | 'free' | 'trial' | 'pro';

export interface Entitlement {
  plan: Plan;
  /** Pro features are available (during the trial or with Pro). */
  pro: boolean;
  trialEndsAt: Date | null;
  trialEnded: boolean;
  proEndsAt: Date | null;
  /** Had Pro before, and it has run out. */
  proEnded: boolean;
  /** A UPI reference was submitted and is waiting for the administrator. */
  paymentPending: boolean;
  paymentReference: string | null;
  /** Time left in the current trial or Pro period. */
  remainingMs: number | null;
}

const GUEST: Entitlement = {
  plan: 'guest',
  pro: false,
  trialEndsAt: null,
  trialEnded: false,
  proEndsAt: null,
  proEnded: false,
  paymentPending: false,
  paymentReference: null,
  remainingMs: null,
};

/** `now` must already be on the server's clock (see `serverNow`). */
export function resolveEntitlement(sub: SubscriptionSnapshot | null, now: Date): Entitlement {
  if (!sub) return GUEST;
  const t = now.getTime();
  const revoked = sub.status === 'revoked';
  const proStarted = !sub.pro_started_at || sub.pro_started_at.getTime() <= t;
  const proActive =
    !revoked && !!sub.pro_expires_at && proStarted && t < sub.pro_expires_at.getTime();
  const trialActive = !!sub.trial_expires_at && t < sub.trial_expires_at.getTime();
  const plan: Plan = proActive ? 'pro' : trialActive ? 'trial' : 'free';
  const endsAt =
    plan === 'pro' ? sub.pro_expires_at : plan === 'trial' ? sub.trial_expires_at : null;
  return {
    plan,
    pro: plan === 'pro' || plan === 'trial',
    trialEndsAt: sub.trial_expires_at,
    trialEnded: !trialActive,
    proEndsAt: sub.pro_expires_at,
    proEnded: !proActive && !!sub.pro_expires_at && sub.pro_expires_at.getTime() <= t,
    paymentPending: sub.status === 'payment_pending' && !proActive,
    paymentReference: sub.payment_reference,
    remainingMs: endsAt ? Math.max(0, endsAt.getTime() - t) : null,
  };
}

/**
 * The server's current time, estimated from the last response: the device clock may be wrong
 * or changed on purpose, but the time elapsed since that response is still measured locally.
 */
export function serverNow(clockOffsetMs: number, deviceNow: number = Date.now()): Date {
  return new Date(deviceNow + clockOffsetMs);
}

export type ProFeature = 'long_range' | 'muscle_balance' | 'progression';

export const PRO_FEATURES: Record<ProFeature, { title: string; description: string }> = {
  long_range: {
    title: '90-day and all-time trends',
    description: 'See strength, volume and consistency across months, not just weeks.',
  },
  muscle_balance: {
    title: 'Sets per muscle group',
    description: 'Weekly hard sets for every muscle, to spot what is under or over trained.',
  },
  progression: {
    title: 'Progression suggestions',
    description: 'When you hit the top of your rep range at the right effort, the app says so.',
  },
};

/** Always free, during and after the trial. History is never locked. */
export const FREE_FEATURES = [
  'Unlimited workout logging, routines and custom exercises',
  'Your full workout history and every personal record',
  'Body weight tracking',
  'Progress for the last 7 and 30 days, with insights',
  'Backup and sync across your devices',
];

export function hasFeature(entitlement: Entitlement, _feature: ProFeature): boolean {
  // Every Pro feature is included in both the trial and Pro.
  return entitlement.pro;
}

/** "3 days 4 hours", "5 hours 10 minutes", "12 minutes". */
export function formatRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (days > 0)
    return hours > 0 ? `${unit(days, 'day')} ${unit(hours, 'hour')}` : unit(days, 'day');
  if (hours > 0)
    return mins > 0 ? `${unit(hours, 'hour')} ${unit(mins, 'minute')}` : unit(hours, 'hour');
  return unit(Math.max(1, mins), 'minute');
}
