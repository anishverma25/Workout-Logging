import { describe, expect, it } from 'vitest';
import { discountedPaise } from '../../supabase/functions/_shared/billing';
import { failureReason, withCoupon } from './billing';

describe('coupon prices', () => {
  it('shows the same first payment the server will charge', () => {
    const coupon = { code: 'GYM10', percent: 10 };
    for (const price of [149, 399, 1499, 999]) {
      expect(withCoupon(price, coupon) * 100).toBe(discountedPaise(price, 10));
    }
    expect(withCoupon(1499, coupon)).toBe(1349);
    expect(withCoupon(149, null)).toBe(149);
  });
});

describe('failed payments', () => {
  it("passes on Razorpay's own reason, and falls back to plain words", () => {
    expect(
      failureReason({ error: { description: 'Payment was declined by your UPI app' } }),
    ).toBe('Payment was declined by your UPI app.');
    expect(failureReason({ error: { description: 'Your bank declined it.' } })).toBe(
      'Your bank declined it.',
    );
    expect(failureReason({})).toBe('The payment did not go through.');
    expect(failureReason(null)).toBe('The payment did not go through.');
    expect(failureReason({ error: { description: 'x'.repeat(500) } })).toBe(
      'The payment did not go through.',
    );
  });
});
