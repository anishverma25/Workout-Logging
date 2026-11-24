import { FOODS } from '@/data/library/foods';
import { loadMoreFoods } from '@/data/library/moreFoods';
import type { Food } from './calc';
import { EVERYDAY } from './everyday';
import { collapseVariants, groupResults, searchFoods } from './search';

/** Logging is quick: the words people type most show a short, simple list (owner, 24 Nov). */
let all: Food[] = [];
beforeAll(async () => {
  all = [...FOODS, ...(await loadMoreFoods())];
});
const first = (q: string, diet: Parameters<typeof searchFoods>[2] = null) =>
  groupResults(collapseVariants(searchFoods(all, q, diet, 150)), q).first;

describe('everyday picks', () => {
  it('every pick is a real food, at most eight a word', () => {
    const ids = new Set(all.map((f) => f.id));
    for (const [word, picks] of Object.entries(EVERYDAY)) {
      expect(picks.length, word).toBeLessThanOrEqual(8);
      for (const id of picks) expect(ids.has(id), `${word}: ${id}`).toBe(true);
    }
  });

  it('"rice" shows steamed rice, basmati and the daily rice dishes, nothing else', () => {
    const names = first('rice').map((f) => f.name);
    expect(names).toEqual([
      'Steamed rice',
      'Cooked basmati rice',
      'Brown rice, cooked',
      'Jeera rice',
      'Curd rice',
      'Veg fried rice',
      'Lemon rice',
      'Dal chawal',
    ]);
  });

  it('"white rice" is three plain choices, never the twenty USDA kinds', () => {
    const r = first('white rice');
    expect(r.map((f) => f.name)).toEqual([
      'Steamed rice',
      'White rice (raw)',
      'Cooked basmati rice',
    ]);
    expect(r.some((f) => f.source === 'usda')).toBe(false);
  });

  it('picks follow the diet: a vegetarian typing "egg" sees no egg picks', () => {
    for (const f of first('egg', 'veg')) expect(f.diet, f.name).toBe('veg');
    for (const f of first('chicken', 'veg')) expect(f.diet, f.name).toBe('veg');
  });

  it('the long tail is still there behind "Show more"', () => {
    const r = groupResults(collapseVariants(searchFoods(all, 'rice', null, 150)), 'rice');
    expect(r.more.some((f) => f.source === 'usda')).toBe(true);
    expect(r.more.length).toBeGreaterThan(20);
  });
});

describe('a short first list for any word', () => {
  const WORDS = ['idli', 'dosa', 'poha', 'upma', 'biryani', 'sandwich', 'pizza', 'burger', 'chips'];
  it('at most eight everyday foods and three packs, USDA only when little else matches', () => {
    for (const q of WORDS) {
      const r = first(q);
      expect(r.length, q).toBeLessThanOrEqual(11);
      expect(r.filter((f) => !f.brand).length, q).toBeLessThanOrEqual(8);
      expect(
        r.some((f) => f.source === 'usda'),
        q,
      ).toBe(false);
    }
  });

  it('a pack shows first only when its own name says the word', () => {
    // Plant proteins list "(Pea + Brown Rice)"; Pizza Hut's drinks carry "Pizza" in the brand.
    expect(first('brown rice').some((f) => /Plant Protein/.test(f.name))).toBe(false);
    expect(first('pizza').some((f) => /Pizza Hut (7 UP|Mirinda|Pepsi)/.test(f.name))).toBe(false);
    // Typing the brand still lists it first.
    expect(first('pizza hut')[0]!.brand).toBe('Pizza Hut');
    expect(first('burger king')[0]!.brand).toBe('Burger King');
  });

  it('one line per name: the same dish from a second source is shown once', () => {
    for (const q of [
      'idli',
      'poha',
      'butter chicken',
      'omelette',
      'makki ki roti',
      'dal makhani',
    ]) {
      const names = searchFoods(all, q, null, 150).map((f) =>
        f.name.split(/[(/]/)[0]!.trim().toLowerCase(),
      );
      expect(new Set(names).size, q).toBe(names.length);
    }
  });

  it('a dish is found by what it is: "jeera rice" before "rice kheer" for rice', () => {
    const r = searchFoods(all, 'rice', null, 150).map((f) => f.name);
    expect(r.indexOf('Jeera rice')).toBeLessThan(r.indexOf('Rice kheer'));
  });
});
