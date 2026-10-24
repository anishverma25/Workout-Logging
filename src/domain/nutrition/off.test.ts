import { isBarcode, labelFromOff } from './off';

describe('Open Food Facts products', () => {
  it('maps per 100 g and per serving values, brand and serving size', () => {
    const r = labelFromOff({
      status: 1,
      product: {
        product_name: 'Classic Peanut Butter',
        brands: 'Pintola, Das Foodtech',
        serving_size: '32 g',
        serving_quantity: '32',
        nutriments: {
          'energy-kcal_100g': 623,
          proteins_100g: 30,
          carbohydrates_100g: 14,
          fat_100g: 50,
          fiber_100g: 8,
          'energy-kcal_serving': 199,
          proteins_serving: 9.6,
        },
      },
    });
    expect(r).toMatchObject({
      product: 'Classic Peanut Butter',
      brand: 'Pintola',
      servingG: 32,
      servingText: '32 g',
      per100: { kcal: 623, proteinG: 30, fatG: 50, fibreG: 8 },
      perServing: { kcal: 199, proteinG: 9.6 },
    });
  });

  it('works out kcal from kJ when only kJ is given', () => {
    const r = labelFromOff({
      status: 1,
      product: { product_name: 'Biscuit', nutriments: { energy_100g: 2000, proteins_100g: 7 } },
    });
    expect(r?.per100?.kcal).toBe(478);
  });

  it('gives nothing for unknown products or products without energy', () => {
    expect(labelFromOff({ status: 0 })).toBeNull();
    expect(labelFromOff({ status: 1, product: { product_name: 'X', nutriments: {} } })).toBeNull();
  });

  it('knows a barcode when it sees one', () => {
    expect(isBarcode('8906123456789')).toBe(true);
    expect(isBarcode('12345')).toBe(false);
    expect(isBarcode('89061a3456789')).toBe(false);
  });
});
