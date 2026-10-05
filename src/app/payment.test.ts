import { accountRef, formatInr, readPaymentConfig, upiLink } from './payment';

const valid = {
  VITE_UPI_ID: 'owner@okbank',
  VITE_UPI_PAYEE_NAME: 'Owner Name',
  VITE_PRO_PRICE_INR: '149',
  VITE_PRO_PERIOD_DAYS: '30',
};

describe('payment config', () => {
  it('stays closed unless every detail is configured and valid', () => {
    expect(readPaymentConfig({})).toBeNull();
    expect(readPaymentConfig({ ...valid, VITE_UPI_ID: 'not-a-upi-id' })).toBeNull();
    expect(readPaymentConfig({ ...valid, VITE_PRO_PRICE_INR: '0' })).toBeNull();
    expect(readPaymentConfig({ ...valid, VITE_PRO_PRICE_INR: 'free' })).toBeNull();
    expect(readPaymentConfig({ ...valid, VITE_PRO_PERIOD_DAYS: '1.5' })).toBeNull();
    expect(readPaymentConfig({ ...valid, VITE_UPI_PAYEE_NAME: ' ' })).toBeNull();
    expect(readPaymentConfig(valid)).toEqual({
      upiId: 'owner@okbank',
      payeeName: 'Owner Name',
      priceInr: 149,
      periodDays: 30,
    });
  });

  it('builds a standard UPI link with a matching reference and nothing secret', () => {
    const config = readPaymentConfig(valid)!;
    const ref = accountRef('3f2b9c1a-0000-4000-8000-000000000000');
    expect(ref).toBe('3F2B9C1A');
    const link = new URL(upiLink(config, ref));
    expect(link.protocol).toBe('upi:');
    expect(Object.fromEntries(link.searchParams)).toEqual({
      pa: 'owner@okbank',
      pn: 'Owner Name',
      am: '149.00',
      cu: 'INR',
      tn: 'Overload Pro 3F2B9C1A',
    });
  });

  it('formats rupees', () => {
    expect(formatInr(149)).toBe('₹149');
  });
});
