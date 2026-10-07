import {
  formatRemaining,
  hasFeature,
  resolveEntitlement,
  serverNow,
  SubscriptionSnapshot,
} from './entitlement';

const H = 3_600_000;
const start = new Date('2026-09-01T10:00:00Z');
const at = (hours: number) => new Date(start.getTime() + hours * H);

function sub(overrides: Partial<Record<keyof SubscriptionSnapshot, unknown>> = {}) {
  return SubscriptionSnapshot.parse({
    status: 'trialing',
    trial_started_at: start.toISOString(),
    trial_expires_at: at(168).toISOString(),
    pro_started_at: null,
    pro_expires_at: null,
    payment_reference: null,
    payment_submitted_at: null,
    updated_at: start.toISOString(),
    server_now: start.toISOString(),
    ...overrides,
  });
}

describe('resolveEntitlement', () => {
  it('gives no Pro features without an account', () => {
    const e = resolveEntitlement(null, start);
    expect(e.plan).toBe('guest');
    expect(hasFeature(e, 'long_range')).toBe(false);
  });

  it('includes Pro features for exactly 168 hours of trial', () => {
    expect(resolveEntitlement(sub(), at(0)).plan).toBe('trial');
    const last = resolveEntitlement(sub(), new Date(at(168).getTime() - 1));
    expect(last.plan).toBe('trial');
    expect(last.remainingMs).toBe(1);
    const after = resolveEntitlement(sub(), at(168));
    expect(after.plan).toBe('free');
    expect(after.trialEnded).toBe(true);
    expect(hasFeature(after, 'muscle_balance')).toBe(false);
  });

  it('gives Pro while the paid period runs, then falls back to free', () => {
    const paid = sub({
      status: 'active',
      pro_started_at: at(200).toISOString(),
      pro_expires_at: at(200 + 720).toISOString(),
    });
    expect(resolveEntitlement(paid, at(199)).plan).toBe('free');
    expect(resolveEntitlement(paid, at(300))).toMatchObject({ plan: 'pro', pro: true });
    const ended = resolveEntitlement(paid, at(921));
    expect(ended).toMatchObject({ plan: 'free', pro: false, proEnded: true });
  });

  it('Pro bought during the trial wins over the trial', () => {
    const paid = sub({
      status: 'active',
      pro_started_at: at(10).toISOString(),
      pro_expires_at: at(1000).toISOString(),
    });
    expect(resolveEntitlement(paid, at(20)).plan).toBe('pro');
  });

  it('a revoked subscription never grants Pro', () => {
    const revoked = sub({
      status: 'revoked',
      pro_started_at: at(0).toISOString(),
      pro_expires_at: at(1000).toISOString(),
    });
    expect(resolveEntitlement(revoked, at(500)).plan).toBe('free');
  });

  it('reports a pending payment until Pro is granted', () => {
    const pending = sub({ status: 'payment_pending', payment_reference: 'UTR1234567' });
    expect(resolveEntitlement(pending, at(200))).toMatchObject({
      plan: 'free',
      paymentPending: true,
      paymentReference: 'UTR1234567',
    });
  });

  it('early access gives every Pro feature with no clock, and marks founding members', () => {
    const e = resolveEntitlement(sub({ early_access: true, founding_member: true }), at(500));
    expect(e).toMatchObject({ plan: 'founding', pro: true, remainingMs: null, trialEnded: false });
    expect(e.foundingMember).toBe(true);
    expect(hasFeature(e, 'recaps')).toBe(true);
    // A revoked account does not get it.
    expect(resolveEntitlement(sub({ early_access: true, status: 'revoked' }), at(500)).pro).toBe(
      false,
    );
    // After it ends, the normal rules apply and the founding mark stays.
    const ended = resolveEntitlement(sub({ early_access: false, founding_member: true }), at(500));
    expect(ended).toMatchObject({ plan: 'free', pro: false, foundingMember: true });
    // Answers from before this release (no field) mean no early access.
    expect(resolveEntitlement(sub(), at(0)).plan).toBe('trial');
  });

  it('rejects malformed server data instead of guessing', () => {
    expect(() => sub({ status: 'gold' })).toThrow();
    expect(() => sub({ trial_expires_at: 'not a date' })).toThrow();
  });
});

describe('serverNow', () => {
  it('uses the server clock even when the device clock is far ahead', () => {
    // Device says a year later, but the offset measured at the last response corrects it.
    const deviceNow = Date.parse('2027-09-01T10:00:00Z');
    const offset = start.getTime() - deviceNow;
    expect(serverNow(offset, deviceNow).toISOString()).toBe(start.toISOString());
    expect(serverNow(offset, deviceNow + H).getTime()).toBe(at(1).getTime());
  });
});

describe('formatRemaining', () => {
  it('reads naturally', () => {
    expect(formatRemaining(168 * H)).toBe('7 days');
    expect(formatRemaining(73 * H)).toBe('3 days 1 hour');
    expect(formatRemaining(5 * H + 10 * 60_000)).toBe('5 hours 10 minutes');
    expect(formatRemaining(30_000)).toBe('1 minute');
  });
});
