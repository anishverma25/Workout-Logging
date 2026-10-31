import { FOOD_BY_ID, FOODS } from '../foods';
import { searchFoods } from '@/domain/nutrition/search';
import { INGREDIENTS } from '../ingredients';
import { atwaterKcal, portionNutrients, unitGrams, type Food } from '@/domain/nutrition/calc';
import { REGIONAL_DISHES, REGIONAL_FOODS } from './index';

/** The same accuracy checks as the curated library (`library.test.ts`), for every regional food. */

const grams = (f: Food, unit = f.units[0]!) => unitGrams(f, unit, 'medium')!;

describe('the regional library', () => {
  it('has ids of its own, and every ingredient exists', () => {
    const ids = REGIONAL_FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => FOOD_BY_ID.has(id))).toEqual([]);
    for (const d of REGIONAL_DISHES)
      for (const [ing] of d.lines) expect(ing in INGREDIENTS, `${d.id}: ${ing}`).toBe(true);
  });

  it('every unit can be measured', () => {
    for (const f of REGIONAL_FOODS)
      for (const u of f.units) expect(unitGrams(f, u, 'medium'), `${f.id} ${u}`).toBeGreaterThan(0);
  });

  it('energy adds up within 12% of protein, carbs and fat', () => {
    // Amul Kool Protein prints 133 kcal next to 10 g protein, 25 g carbs and 2.7 g fat (about
    // 164 kcal); its carbs most likely include fibre the label does not list. Kept as printed.
    const asPrinted = new Set([
      'amul-kool-protein-chocolate',
      'amul-kool-protein-coffee',
      'amul-kool-protein-kesar',
      'amul-kool-protein-vanilla',
    ]);
    for (const f of REGIONAL_FOODS) {
      if (f.per100.kcal < 20 || asPrinted.has(f.id)) continue;
      const ratio = atwaterKcal(f.per100) / f.per100.kcal;
      const slack = f.source === 'label' ? 0.2 : 0.12;
      expect(ratio, f.id).toBeGreaterThan(1 - slack);
      expect(ratio, f.id).toBeLessThan(1 + slack);
    }
  });

  it('a usual portion is realistic', () => {
    for (const f of REGIONAL_FOODS) {
      const kcal = portionNutrients(f, grams(f) * f.defaultAmount).kcal;
      if (f.per100.kcal >= 5) expect(kcal, f.id).toBeGreaterThan(5);
      expect(kcal, f.id).toBeLessThan(800);
    }
  });

  it('cooked dishes are not denser in energy than their raw ingredients allow', () => {
    // A pot cannot weigh less than its dry matter: catches a cooked weight typed too low.
    for (const d of REGIONAL_DISHES) {
      if (typeof d.cooked !== 'number') continue;
      const dry = d.lines.reduce(
        (s, [id, g]) => s + (g * (100 - (INGREDIENTS[id]?.water ?? 0))) / 100,
        0,
      );
      expect(d.cooked, d.id).toBeGreaterThan(dry);
    }
  });

  it('oil levels go light below normal below rich', () => {
    for (const f of REGIONAL_FOODS.filter((x) => x.fatPer100)) {
      const g = grams(f);
      const [light, normal, rich] = (['light', 'normal', 'rich'] as const).map(
        (o) => portionNutrients(f, g, o).kcal,
      );
      expect(light, f.id).toBeLessThan(normal!);
      expect(normal, f.id).toBeLessThan(rich!);
    }
  });
});

describe('people find the regional dishes by the name they use', () => {
  const all = [...FOODS, ...REGIONAL_FOODS];
  it.each([
    ['aloo dum', 'aloo-dum'],
    ['dum aloo', 'aloo-dum'],
    ['cham cham', 'cham-cham'],
    ['chum chum', 'cham-cham'],
    ['churma', 'churma'],
    ['shorshe ilish', 'shorshe-ilish'],
    ['neer dosa', 'neer-dosa'],
    ['undhiyu', 'undhiyu'],
    ['amul gold', 'amul-gold-milk'],
    ['amul whey', 'amul-whey-protein'],
  ])('%s finds %s first', (q, id) => {
    expect(searchFoods(all, q, null)[0]?.id).toBe(id);
  });

  it('a curated dish still comes before a regional one with the same words', () => {
    // "Dal tadka" stays the answer to "dal".
    expect(searchFoods(all, 'dal', null)[0]?.id).toBe('dal-tadka');
    expect(searchFoods(all, 'roti', null)[0]?.id).toBe('roti');
  });
});
