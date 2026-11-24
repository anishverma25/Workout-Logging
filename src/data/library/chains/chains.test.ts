import { FOOD_BY_ID } from '@/data/library/foods';
import { loadMoreFoods } from '@/data/library/moreFoods';
import { measurePortion } from '@/data/repositories/food';
import type { Food } from '@/domain/nutrition/calc';
import { portionText } from '@/domain/nutrition/calc';
import {
  collapseVariants,
  pickVariant,
  searchFoods,
  variantChoices,
  variantsOf,
} from '@/domain/nutrition/search';
import rows from './rows.json';
import replaced from './replaced.json';
import { fromChain, type ChainRow } from './index';

let all: Food[] = [];
beforeAll(async () => {
  all = [...FOOD_BY_ID.values(), ...(await loadMoreFoods())];
});
const byName = (re: RegExp) => all.find((f) => re.test(f.name))!;
const kcal = (food: Food, amount: number, unit: Food['units'][number]) =>
  measurePortion({ food, amount, unit, size: null, oilLevel: null }).nutrients.kcal;

describe('chain menus from the chains’ own documents', () => {
  it('every row is copied with a serving, a source, and calories close to its macros or flagged', () => {
    for (const r of [...rows, ...replaced] as unknown as ChainRow[]) {
      expect(['official', 'compiled'], r.id).toContain(r.source);
      expect(r.kcal, r.id).toBeGreaterThanOrEqual(0);
      const atwater = 4 * r.p + 4 * r.c + 9 * r.f;
      if (r.kcal > 40 && Math.abs(atwater - r.kcal) / r.kcal > 0.25)
        expect(r.flag, `${r.id} ${r.kcal} vs ${atwater}`).toBe('conflict');
      // McDonald's is a compilation, never labelled official.
      if (r.brand === "McDonald's") expect(r.source, r.id).toBe('compiled');
    }
  });

  it('keeps published calories exactly (Burger King Crispy Veg, 131 g: 305.6 kcal)', () => {
    const crispy = FOOD_BY_ID.get('bk-crispy-veg')!;
    expect(crispy.pieceG).toBe(131);
    expect(kcal(crispy, 1, 'piece')).toBe(306);
    expect(crispy.brand).toBe('Burger King');
    expect(crispy.chainDoc).toMatch(/February 2026/);
  });

  it('replaces older chain foods in place, keeping their ids', () => {
    expect(replaced).toHaveLength(20);
    const peppy = FOOD_BY_ID.get('dominos-peppy-paneer-slice')!;
    expect(peppy.source).toBe('chain');
    // Domino's: regular hand tossed Peppy Paneer is 857 kcal a serve of 4 slices.
    expect(kcal(peppy, 1, 'piece')).toBe(Math.round(857 / 4));
    // No duplicate: the document's own row is not loaded a second time.
    expect(all.filter((f) => f.name === peppy.name)).toHaveLength(1);
  });

  it('pizza: product, size and crust, whole pizza or slices, any quantity', () => {
    const medium = byName(/^Domino's Margherita pizza, medium, new hand tossed$/);
    // Medium: 585 kcal a serve of 3 slices; the pizza has 6 slices.
    expect(kcal(medium, 1, 'piece')).toBe(195);
    expect(kcal(medium, 1, 'serving')).toBe(1170);
    expect(Math.abs(kcal(medium, 2.5, 'piece') - 487.5)).toBeLessThanOrEqual(0.5);
    expect(portionText(1, 'serving', null, medium)).toBe('1 pizza');
    expect(portionText(3, 'piece', null, medium)).toBe('3 slices');
    // No weight published: grams are never shown for it.
    expect(medium.servingOnly).toBe(true);
    // A large pizza has 8 slices; a regular starts at the whole pizza, others at 2 slices.
    const large = byName(/^Domino's Margherita pizza, large, new hand tossed$/);
    expect(large.servingG! / large.pieceG!).toBe(8);
    expect(large.units[0]).toBe('piece');
    expect(large.defaultAmount).toBe(2);
    const regular = byName(/^Domino's Margherita pizza, regular, new hand tossed$/);
    expect(regular.units[0]).toBe('serving');

    const variants = variantsOf(all, medium);
    expect(variantChoices(variants)).toEqual([
      ['Size', ['Regular', 'Medium', 'Large']],
      ['Crust', ['New Hand Tossed', 'Fresh Pan', 'Thin Crust', 'Cheese Burst']],
    ]);
    // Changing the crust keeps the size; a size not sold in that crust picks one that is.
    expect(pickVariant(variants, medium, 'Crust', 'Cheese Burst')!.name).toMatch(
      /medium, cheese burst$/,
    );
    expect(pickVariant(variants, medium, 'Size', 'Large')!.name).toMatch(/large, new hand tossed$/);
    const thin = pickVariant(variants, medium, 'Crust', 'Thin Crust')!;
    expect(pickVariant(variants, thin, 'Size', 'Large')!.variant!.dims).toContainEqual([
      'Size',
      'Large',
    ]);
  });

  it('Starbucks drinks by their real cup size', () => {
    const grande = byName(/^Starbucks Grande Cappuccino$/);
    expect(grande.pieceG).toBe(473);
    expect(grande.pieceName).toEqual(['cup', 'cups']);
    expect(kcal(grande, 1, 'piece')).toBe(173);
    expect(variantChoices(variantsOf(all, grande))[0]![1]).toEqual(
      expect.arrayContaining(['Short', 'Tall', 'Grande', 'Venti']),
    );
  });

  it('search shows a product once, not once per size', () => {
    const results = collapseVariants(searchFoods(all, "domino's margherita", null, 200));
    const margheritas = results.filter((f) => f.variant?.groupName === "Domino's Margherita pizza");
    expect(margheritas).toHaveLength(1);
  });

  it('missing nutrients are unknown, never zero', () => {
    const r = (rows as unknown as ChainRow[]).find((x) => x.brand === 'Burger King')!;
    expect(r.fibre).toBeNull();
    expect(fromChain(r).fibreUnknown).toBe(true);
  });
});
