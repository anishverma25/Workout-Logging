import { describe, expect, it } from 'vitest';
import { atwaterKcal } from '@/domain/nutrition/calc';
import { searchFoods } from '@/domain/nutrition/search';
import { FOODS } from './foods';
import { __test, loadMoreFoods } from './moreFoods';

describe('the long tail of the food library', () => {
  it('loads USDA foods and Indian Nutrient Databank dishes', async () => {
    const more = await loadMoreFoods();
    expect(more.filter((f) => f.source === 'usda').length).toBeGreaterThan(8000);
    expect(more.filter((f) => f.source === 'indb').length).toBeGreaterThan(800);
    expect(new Set(more.map((f) => f.id)).size).toBe(more.length);
  });

  it('reads household measures as one piece', () => {
    expect(__test.measure(140, '1 cup, chopped or diced')).toEqual({
      g: 140,
      name: ['cup, chopped or diced', 'cups, chopped or diced'],
    });
    expect(__test.measure(28.35, '1 oz')).toEqual({ g: 28.4, name: ['oz', 'oz'] });
    expect(__test.measure(60, '0.5 cup')?.g).toBe(120);
    expect(__test.measure(null, null)).toBeNull();
  });

  it('marks meat, fish and egg foods for the diet filter', () => {
    expect(__test.usdaDiet('0500', 'Chicken, broilers or fryers, breast')).toBe('nonveg');
    expect(__test.usdaDiet('2100', 'Fast foods, hamburger')).toBe('veg');
    expect(__test.usdaDiet('2100', 'Fast foods, chicken tenders')).toBe('nonveg');
    expect(__test.usdaDiet('0100', 'Egg, whole, cooked, fried')).toBe('egg');
    expect(__test.usdaDiet('1100', 'Eggplant, raw')).toBe('veg');
  });

  it('keeps the curated library first in search', async () => {
    const all = [...FOODS, ...(await loadMoreFoods())];
    expect(searchFoods(all, 'chicken breast', null)[0]!.id).toBe('chicken-breast');
    expect(searchFoods(all, 'dal', null)[0]!.id).toBe('dal-tadka');
    expect(searchFoods(all, 'roti', null)[0]!.id).toBe('roti');
    // Foods only the long tail has are still found.
    expect(searchFoods(all, 'avocado', null).length).toBeGreaterThan(0);
    expect(searchFoods(all, 'chicken', 'veg')).toHaveLength(0);
  });

  it('every Indian Nutrient Databank dish adds up', async () => {
    for (const f of (await loadMoreFoods()).filter((x) => x.source === 'indb')) {
      if (f.per100.kcal < 20) continue;
      const ratio = atwaterKcal(f.per100) / f.per100.kcal;
      expect(ratio, f.name).toBeGreaterThan(0.8);
      expect(ratio, f.name).toBeLessThan(1.2);
    }
  });
});
