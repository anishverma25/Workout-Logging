import { applyStated, parseStated, type FoodItem } from '../../supabase/functions/_shared/coach.ts';

const item = (over: Partial<FoodItem>): FoodItem => ({
  name: 'Paneer',
  portion: '100 g',
  grams: 100,
  kcal: 265,
  proteinG: 18,
  carbsG: 3,
  fatG: 21,
  fibreG: 0,
  diet: 'veg',
  basis: 'estimate',
  ref: 'typical',
  ...over,
});

describe('numbers the person typed', () => {
  it('reads weights, calories and macros food by food', () => {
    const s = parseStated('200 g paneer with 36g protein, whey 1 scoop 120 kcal 24 g protein');
    expect(s[0]).toMatchObject({ grams: 200, proteinG: 36 });
    expect(s[0]!.words).toContain('paneer');
    expect(s[1]).toMatchObject({ kcal: 120, proteinG: 24 });
    expect(s[1]!.words).toContain('whey');
  });

  it('reads "protein 24g", "calories: 300", kg and ml', () => {
    expect(parseStated('chicken 0.25 kg protein 60g')[0]).toMatchObject({
      grams: 250,
      proteinG: 60,
    });
    expect(parseStated('milk 300 ml calories: 180')[0]).toMatchObject({ grams: 300, kcal: 180 });
  });

  it('their weight scales the food and their protein replaces the AI’s', () => {
    const [out] = applyStated([item({})], parseStated('200 g paneer, 36 g protein'));
    // "200 g paneer, 36 g protein" is split in two; the protein still lands on the paneer.
    expect(out!.grams).toBe(200);
    expect(out!.kcal).toBe(530);
    expect(out!.proteinG).toBe(36);
    expect(out!.basis).toBe('yours');
  });

  it('their calories stand and the other macros shrink to fit', () => {
    const whey = item({
      name: 'Whey protein',
      grams: 30,
      kcal: 150,
      proteinG: 22,
      carbsG: 8,
      fatG: 4,
    });
    const [out] = applyStated([whey], parseStated('whey 1 scoop 120 kcal 24g protein'));
    expect(out!.kcal).toBe(120);
    expect(out!.proteinG).toBe(24);
    expect(4 * out!.proteinG + 4 * out!.carbsG + 9 * out!.fatG).toBeLessThanOrEqual(121);
  });

  it('matches each set of numbers to the right food by name', () => {
    const items = [
      item({ name: 'Roti', grams: 80, kcal: 240, proteinG: 8, carbsG: 46, fatG: 2 }),
      item({ name: 'Paneer bhurji' }),
    ];
    const out = applyStated(items, parseStated('2 roti, paneer bhurji 150 g 25 g protein'));
    expect(out[0]!.basis).toBe('estimate');
    expect(out[1]).toMatchObject({ grams: 150, proteinG: 25, basis: 'yours' });
  });

  it('leaves the AI’s foods alone when nothing was typed', () => {
    const items = [item({})];
    expect(applyStated(items, parseStated('paneer bhurji and 2 rotis'))).toBe(items);
  });
});
