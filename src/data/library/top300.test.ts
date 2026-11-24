import { FOOD_BY_ID } from './foods';
import { loadMoreFoods } from './moreFoods';
import rows from './top300.json';
import { measurePortion } from '@/data/repositories/food';
import type { Food } from '@/domain/nutrition/calc';
import { portionText } from '@/domain/nutrition/calc';
import type { Top300Row } from './top300';

let added: Food[] = [];
beforeAll(async () => {
  const more = await loadMoreFoods();
  added = more.filter((f) => f.id.startsWith('t300-'));
});

describe('top 300 Indian foods by serving', () => {
  it('adds only foods the library does not have, each once', () => {
    const all = rows as unknown as Top300Row[];
    expect(added.length).toBeGreaterThan(0);
    expect(added.length).toBeLessThan(all.length);
    expect(new Set(added.map((f) => f.id)).size).toBe(added.length);
    for (const f of added) expect(FOOD_BY_ID.has(f.id)).toBe(false);
  });

  it('logs by the natural serving with its numbers exactly', () => {
    for (const r of rows as unknown as Top300Row[]) {
      const f = added.find((x) => x.id === r.id);
      if (!f) continue;
      const n = measurePortion({
        food: f,
        amount: f.defaultAmount,
        unit: 'piece',
        size: null,
        oilLevel: null,
      }).nutrients;
      expect(Math.abs(n.kcal - r.kcal), r.name).toBeLessThanOrEqual(0.5);
      expect(portionText(f.defaultAmount, 'piece', null, f).length).toBeGreaterThan(2);
    }
  });

  it('recipe estimates say so', () => {
    const est = added.find((f) => f.check?.kind === 'estimate');
    if (est) expect(est.check!.note).toMatch(/standard recipe/);
  });
});
