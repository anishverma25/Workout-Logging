import { REGULAR_PRICE_INR, regularPrice } from './billing';

describe('early bird prices', () => {
  it('crosses out the regular price while the price is below it', () => {
    expect(regularPrice({ id: 'monthly', priceInr: 29 })).toBe(59);
    expect(regularPrice({ id: 'quarterly', priceInr: 69 })).toBe(149);
    expect(regularPrice({ id: 'yearly', priceInr: 249 })).toBe(499);
  });

  it('crosses out nothing once the price reaches the regular price', () => {
    for (const id of ['monthly', 'quarterly', 'yearly'] as const) {
      expect(regularPrice({ id, priceInr: REGULAR_PRICE_INR[id] })).toBeNull();
      expect(regularPrice({ id, priceInr: REGULAR_PRICE_INR[id] + 10 })).toBeNull();
    }
  });
});
