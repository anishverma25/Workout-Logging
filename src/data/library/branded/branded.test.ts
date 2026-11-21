import { FOODS, FOOD_BY_ID } from '@/data/library/foods';
import { loadMoreFoods } from '@/data/library/moreFoods';
import type { Food } from '@/domain/nutrition/calc';
import { groupResults, namesBrand, searchFoods } from '@/domain/nutrition/search';
import { normalize } from '@/domain/exercises/search';
import rows from './rows.json';
import { REPLACED_ROWS } from './replaced';
import type { BrandedRow } from './types';

/** The Branded Food Macro Database (November 2026) inside the food library and its search. */

const ALL_ROWS = [...(rows as unknown as BrandedRow[]), ...REPLACED_ROWS];
let all: Food[] = [];
beforeAll(async () => {
  all = [...FOODS, ...(await loadMoreFoods())];
});
const ids = (q: string, n = 5, diet: Parameters<typeof searchFoods>[2] = null) =>
  searchFoods(all, q, diet).slice(0, n);

describe('branded foods: the import', () => {
  it('imports every product that lists calories, protein, carbs and fat, once each', () => {
    // 849 products in the database; 24 left out (8 with no calories or protein, 13 with no
    // carbs or fat, 3 ice creams with no weight for their cup or cone): nothing is estimated.
    expect(ALL_ROWS).toHaveLength(825);
    expect(new Set(ALL_ROWS.map((r) => r[0])).size).toBe(825);
    expect(new Set(ALL_ROWS.map((r) => normalize(r[1]))).size).toBe(825);
    for (const id of ALL_ROWS.map((r) => r[0]))
      expect(all.filter((f) => f.id === id), id).toHaveLength(1);
  });

  it('a newer listing of the same product replaces the old one and keeps its id', () => {
    expect(REPLACED_ROWS).toHaveLength(53);
    const biozyme = FOOD_BY_ID.get('muscleblaze-biozyme-whey')!;
    expect(biozyme.name).toBe('MuscleBlaze Biozyme Performance Whey, Rich Chocolate');
    expect(biozyme.brand).toBe('MuscleBlaze');
    // Exactly as listed: 143.26 kcal and 25 g protein in a 36 g scoop.
    expect(biozyme.pieceG).toBe(36);
    expect(biozyme.pieceName).toEqual(['scoop', 'scoops']);
    expect((biozyme.per100.kcal * 36) / 100).toBeCloseTo(143.26, 1);
    expect((biozyme.per100.proteinG * 36) / 100).toBeCloseTo(25, 1);
    // No food appears twice under two names.
    const names = all.filter((f) => f.brand).map((f) => normalize(f.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps per 100 g, per scoop and per pack as servings of one food', () => {
    const paneer = all.find((f) => f.name === 'Amul High Protein Paneer')!;
    expect(paneer.units).toEqual(['g']);
    expect(paneer.per100.proteinG).toBe(25);
    const milk = all.find((f) => f.name === 'Amul High Protein Milk')!;
    // 250 ml pack: 225 kcal, 35 g protein.
    expect(milk.units).toEqual(['piece', 'ml']);
    expect((milk.per100.kcal * milk.pieceG!) / 100).toBeCloseTo(225, 1);
    expect((milk.per100.proteinG * milk.pieceG!) / 100).toBeCloseTo(35, 1);
    const silk = all.find((f) => f.name === 'Cadbury Dairy Milk Silk, Original')!;
    expect(silk.per100.kcal).toBe(543);
  });

  it('flags listings that disagree and labels whose calories are kept as printed', () => {
    const fresh = all.find((f) => f.name === 'Amul Fresh Paneer')!;
    expect(fresh.check?.kind).toBe('conflict');
    expect(fresh.check?.note).toMatch(/Instamart/);
    const flagged = all.filter((f) => f.check);
    expect(flagged.length).toBeGreaterThanOrEqual(20);
    // Fibre the label does not list is unknown, not 0 g.
    expect(fresh.fibreUnknown).toBe(true);
  });
});

describe('branded foods: search', () => {
  it('"Amul paneer" shows Amul paneer first', () => {
    for (const f of ids('amul paneer', 3)) {
      expect(f.brand).toBe('Amul');
      expect(f.name.toLowerCase()).toContain('paneer');
    }
  });

  it('"MuscleBlaze Biozyme" and "mb biozyme" show Biozyme first', () => {
    for (const q of ['muscleblaze biozyme', 'mb biozyme', 'biozyme', 'biozym']) {
      const top = ids(q, 3);
      expect(top.length, q).toBeGreaterThan(0);
      for (const f of top) expect(f.name, q).toMatch(/Biozyme/);
    }
  });

  it('"Dairy Milk Silk" shows Cadbury Dairy Milk Silk first', () => {
    const top = ids('dairy milk silk', 3);
    for (const f of top) expect(f.name).toMatch(/^Cadbury Dairy Milk Silk/);
  });

  it('"paneer" shows plain paneer first, not thirty brands', () => {
    const results = searchFoods(all, 'paneer', null);
    expect(results[0]!.id).toBe('paneer');
    expect(results[0]!.brand).toBeUndefined();
    const { first, more } = groupResults(results, 'paneer');
    expect(first.filter((f) => f.brand).length).toBeLessThanOrEqual(4);
    expect(more.length).toBeGreaterThan(0);
  });

  it('a brand typed shows that brand, ten first and the rest on request', () => {
    const results = searchFoods(all, 'amul', null, 60);
    const { first, more, brandTyped } = groupResults(results, 'amul');
    expect(brandTyped).toBe(true);
    expect(first).toHaveLength(10);
    expect(more.length).toBeGreaterThan(0);
    expect(first.every((f) => f.name.startsWith('Amul'))).toBe(true);
  });

  it('understands brand nicknames and spelling mistakes', () => {
    expect(ids('twt protein bar', 1)[0]?.brand).toBe('The Whole Truth');
    expect(ids('on gold standard', 1)[0]?.brand).toBe('Optimum Nutrition');
    expect(ids('epigamea greek yogurt', 1)[0]?.brand).toBe('Epigamia');
    expect(ids('pintola penut butter', 1)[0]?.brand).toBe('Pintola');
    expect(namesBrand(FOOD_BY_ID.get('muscleblaze-biozyme-whey')!, 'mb')).toBe(true);
  });

  it('foods logged often move up, but never above a food named exactly what was typed', () => {
    const branded = searchFoods(all, 'paneer', null, 200).find((f) => f.brand)!;
    const boost = new Map([[branded.id, 50]]);
    expect(searchFoods(all, 'paneer', null, 30, boost)[0]!.id).toBe('paneer');
    // Among packs of a brand, the usual one comes first.
    const amul = searchFoods(all, 'amul paneer', null);
    expect(amul.length).toBeGreaterThan(1);
    const usual = amul[amul.length - 1]!;
    expect(searchFoods(all, 'amul paneer', null, 30, new Map([[usual.id, 4]]))[0]!.id).toBe(
      usual.id,
    );
  });

  it('a typo never brings back foods outside the diet', () => {
    expect(searchFoods(all, 'chicken', 'veg')).toHaveLength(0);
  });

  it('stays fast with a library of a hundred thousand foods', () => {
    const big: Food[] = [];
    for (let i = 0; big.length < 100_000; i++)
      for (const f of all) {
        big.push({ ...f, id: `${f.id}~${i}`, name: `${f.name} ${i}` });
        if (big.length >= 100_000) break;
      }
    searchFoods(big, 'amul paneer', null); // builds the index once
    const t = performance.now();
    for (const q of ['amul paneer', 'biozyme', 'dal', 'dairy milk silk', 'paneer'])
      searchFoods(big, q, null);
    // Five searches, generous for a slow test machine; about 20 ms each on a laptop.
    expect(performance.now() - t).toBeLessThan(2500);
  });
});
