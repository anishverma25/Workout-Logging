import type { SubscriptionSnapshot } from '@/domain/entitlement/entitlement';

/**
 * Development-only access states, for checking each screen without waiting a week.
 * `import.meta.env.DEV` is a build-time constant: in production builds every branch below is
 * removed, and `scripts/verify-build.mjs` fails the build if any trace of it remains.
 */

export type DevEntitlementState =
  'real' | 'founding' | 'trial' | 'trial_expired' | 'pro' | 'pro_expired';

export const DEV_STATES: { value: DevEntitlementState; label: string }[] = [
  { value: 'real', label: 'Real' },
  { value: 'founding', label: 'Early access' },
  { value: 'trial', label: 'Active trial' },
  { value: 'trial_expired', label: 'Expired trial' },
  { value: 'pro', label: 'Active Pro' },
  { value: 'pro_expired', label: 'Expired Pro' },
];

const listeners = new Set<() => void>();

export function getDevEntitlement(): DevEntitlementState {
  if (!import.meta.env.DEV) return 'real';
  try {
    return (sessionStorage.getItem('overload.dev.entitlement') as DevEntitlementState) ?? 'real';
  } catch {
    return 'real';
  }
}

export function setDevEntitlement(value: DevEntitlementState) {
  if (!import.meta.env.DEV) return;
  try {
    if (value === 'real') sessionStorage.removeItem('overload.dev.entitlement');
    else sessionStorage.setItem('overload.dev.entitlement', value);
  } catch {
    // Storage unavailable: the override simply does not apply.
  }
  listeners.forEach((l) => l());
}

export function onDevEntitlementChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A made-up snapshot for the chosen state, relative to `now`. Development only. */
export function devSnapshot(state: DevEntitlementState, now: Date): SubscriptionSnapshot | null {
  if (!import.meta.env.DEV || state === 'real') return null;
  const h = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
  const trialStart = state === 'trial' ? h(-30) : h(-400);
  const base: SubscriptionSnapshot = {
    status: 'trialing',
    trial_started_at: trialStart,
    trial_expires_at: new Date(trialStart.getTime() + 168 * 3_600_000),
    pro_started_at: null,
    pro_expires_at: null,
    payment_reference: null,
    payment_submitted_at: null,
    updated_at: now,
    server_now: now,
    early_access: false,
    founding_member: false,
  };
  if (state === 'founding') return { ...base, early_access: true, founding_member: true };
  if (state === 'trial') return base;
  if (state === 'trial_expired') return { ...base, status: 'expired' };
  if (state === 'pro')
    return { ...base, status: 'active', pro_started_at: h(-48), pro_expires_at: h(24 * 28) };
  return { ...base, status: 'expired', pro_started_at: h(-24 * 40), pro_expires_at: h(-24 * 10) };
}
