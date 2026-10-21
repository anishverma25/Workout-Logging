import { FOOD_BY_ID, FOODS, STARTER_FOODS } from '@/data/library/foods';
import { INGREDIENTS } from '@/data/library/ingredients';
import { atwaterKcal, portionNutrients, unitGrams, type Food } from './calc';

/**
 * Accuracy checks every food must pass (science topic `food-values`). A wrong recipe fails the
 * build instead of reaching anyone's log.
 */

const grams = (f: Food, unit = f.units[0]!) => unitGrams(f, unit, 'medium')!;

describe('the food library', () => {
  it('has unique ids and every unit can be measured', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    expect(FOODS.length).toBeGreaterThanOrEqual(120);
    for (const f of FOODS)
      for (const u of f.units) expect(unitGrams(f, u, 'medium'), `${f.id} ${u}`).toBeGreaterThan(0);
  });

  it('every ingredient keeps its energy consistent with its protein, carbs and fat', () => {
    for (const [id, ing] of Object.entries(INGREDIENTS)) {
      // Vegetables under 50 kcal use low USDA factors (fibre, fungi), so they are left out.
      if (ing.kcal < 50) continue;
      const ratio = atwaterKcal(ing) / ing.kcal;
      // USDA uses food-specific energy factors, so plain 4-4-9 lands within about 20%.
      expect(ratio, id).toBeGreaterThan(0.8);
      expect(ratio, id).toBeLessThan(1.2);
    }
  });

  it('every dish: energy adds up within 12% of protein, carbs and fat', () => {
    for (const f of FOODS) {
      if (f.per100.kcal < 20) continue;
      const ratio = atwaterKcal(f.per100) / f.per100.kcal;
      // Pack labels round their figures and count fibre and sugar alcohols at less energy, so
      // they are checked a little more loosely; the label is kept as printed.
      const slack = f.source === 'label' ? 0.2 : 0.12;
      expect(ratio, f.id).toBeGreaterThan(1 - slack);
      expect(ratio, f.id).toBeLessThan(1 + slack);
    }
  });

  it('portions are realistic', () => {
    const katori = (id: string) => grams(FOOD_BY_ID.get(id)!, 'katori');
    const piece = (id: string) => FOOD_BY_ID.get(id)!.pieceG!;
    for (const id of ['dal-tadka', 'rajma', 'chole', 'chicken-curry', 'sambar']) {
      expect(katori(id)).toBeGreaterThanOrEqual(120);
      expect(katori(id)).toBeLessThanOrEqual(250);
    }
    expect(piece('roti')).toBeGreaterThan(30);
    expect(piece('roti')).toBeLessThan(60);
    expect(piece('phulka')).toBeLessThan(piece('roti'));
    expect(piece('idli')).toBeGreaterThan(30);
    expect(piece('idli')).toBeLessThan(60);
    expect(piece('dosa')).toBeGreaterThan(50);
    expect(piece('dosa')).toBeLessThan(120);
    for (const f of FOODS) {
      const kcal = portionNutrients(f, grams(f) * f.defaultAmount).kcal;
      // Black coffee and green tea really are close to nothing.
      if (f.per100.kcal >= 5) expect(kcal, f.id).toBeGreaterThan(5);
      expect(kcal, f.id).toBeLessThan(800);
    }
  });

  it('a roti is its atta: 30 g of whole wheat flour, about 100 kcal', () => {
    const roti = FOOD_BY_ID.get('roti')!;
    const kcal = portionNutrients(roti, roti.pieceG!).kcal;
    expect(kcal).toBeCloseTo((INGREDIENTS.atta.kcal * 30) / 100, 0);
  });

  it('matches USDA cooked references where they exist', () => {
    // USDA SR28 20545, white rice boiled: 130 kcal, 2.7 g protein per 100 g.
    const rice = FOOD_BY_ID.get('rice')!.per100;
    expect(rice.kcal / 130).toBeGreaterThan(0.95);
    expect(rice.kcal / 130).toBeLessThan(1.05);
    // USDA SR28 05013 broiler meat roasted: 190 kcal, 28.9 g protein per 100 g.
    const chicken = FOOD_BY_ID.get('chicken-plain')!.per100;
    expect(chicken.kcal / 190).toBeGreaterThan(0.9);
    expect(chicken.kcal / 190).toBeLessThan(1.1);
    expect(chicken.proteinG / 28.9).toBeGreaterThan(0.9);
  });

  it('oil levels go light below normal below rich, for every dish with cooking fat', () => {
    for (const f of FOODS.filter((x) => x.fatPer100)) {
      const g = grams(f);
      const [light, normal, rich] = (['light', 'normal', 'rich'] as const).map(
        (o) => portionNutrients(f, g, o).kcal,
      );
      expect(light, f.id).toBeLessThan(normal!);
      expect(normal, f.id).toBeLessThan(rich!);
      expect(portionNutrients(f, g, 'light').proteinG).toBeCloseTo(
        portionNutrients(f, g).proteinG,
        1,
      );
    }
  });

  it('diet labels follow the ingredients', () => {
    expect(FOOD_BY_ID.get('dal-tadka')!.diet).toBe('veg');
    expect(FOOD_BY_ID.get('dal-tadka')!.jain).toBe(false);
    expect(FOOD_BY_ID.get('idli')!.jain).toBe(true);
    expect(FOOD_BY_ID.get('omelette')!.diet).toBe('egg');
    expect(FOOD_BY_ID.get('chicken-biryani')!.diet).toBe('nonveg');
  });

  it('starter foods exist', () => {
    for (const ids of Object.values(STARTER_FOODS))
      for (const id of ids) expect(FOOD_BY_ID.has(id), id).toBe(true);
  });
});
