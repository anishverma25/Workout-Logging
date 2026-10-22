import { FOOD_BY_ID, FOODS } from './foods';
import { portionNutrients } from '@/domain/nutrition/calc';
import { searchFoods } from '@/domain/nutrition/search';

/** The foods added in October 2026: Indian street food, chains, labels, pea protein. */

const top = (q: string, diet: Parameters<typeof searchFoods>[2] = null) =>
  searchFoods(FOODS, q, diet)[0]?.id;
const one = (id: string) => {
  const f = FOOD_BY_ID.get(id)!;
  return portionNutrients(f, f.pieceG ?? 100);
};

describe('chain and label foods keep the published numbers', () => {
  it('a chain serving is the serving the chain published', () => {
    // McDonald's India McAloo Tikki, 146 g: 340 kcal, 8.5 g protein.
    expect(Math.round(one('mcaloo-tikki').kcal)).toBe(340);
    expect(one('mcaloo-tikki').proteinG).toBeCloseTo(8.5, 1);
    // KFC Classic Zinger, 225 g: 612 kcal, 27 g protein.
    expect(Math.round(one('kfc-classic-zinger').kcal)).toBe(612);
    expect(FOOD_BY_ID.get('kfc-classic-zinger')!.source).toBe('chain');
    expect(FOOD_BY_ID.get('bournvita')!.source).toBe('label');
  });

  it('chicken chain foods are non-veg, the egg burger is egg, the rest veg', () => {
    expect(FOOD_BY_ID.get('mcchicken')!.diet).toBe('nonveg');
    expect(FOOD_BY_ID.get('bk-egg-burger')!.diet).toBe('egg');
    expect(FOOD_BY_ID.get('mcveggie')!.diet).toBe('veg');
  });

  it('every pea protein is there, with its scoop', () => {
    for (const id of [
      'nutrabay-pea-protein-isolate',
      'nutrabay-gold-hydrolyzed-pea-protein',
      'nakpro-pea-protein-isolate',
      'myprotein-pea-protein-isolate',
    ]) {
      const f = FOOD_BY_ID.get(id)!;
      expect(f.pieceG, id).toBeGreaterThan(25);
      // A scoop gives 20 g of protein or more.
      expect(portionNutrients(f, f.pieceG!).proteinG, id).toBeGreaterThan(20);
    }
  });

  it('creatine has no energy and BCAA almost none', () => {
    expect(one('muscleblaze-creamp-creatine').kcal).toBe(0);
    expect(one('gnc-bcaa').kcal).toBeLessThan(10);
  });
});

describe('people find them by the name they use', () => {
  it.each([
    ['pea protein', 'pea'],
    ['mcdonalds', 'mc'],
    ['zinger', 'zinger'],
    ['bournvita', 'bournvita'],
    ['horlicks', 'horlicks'],
    ['creatine', 'creatine'],
    ['casein', 'casein'],
    ['mass gainer', 'gainer'],
    ['dabeli', 'dabeli'],
    ['sev puri', 'sev-puri'],
    ['chole bhature', 'chole-bhature'],
    ['litti chokha', 'litti-chokha'],
    ['kulfi', 'kulfi'],
    ['mysore pak', 'mysore-pak'],
    ['puran poli', 'puran-poli'],
    ['thums up', 'thums-up'],
    ['kiwi', 'kiwi'],
    ['chikoo', 'sapota'],
    ['sitaphal', 'custard-apple'],
    ['sugarcane juice', 'sugarcane-juice'],
    ['kurkure', 'kurkure-masala-munch'],
  ])('%s finds a food whose id has %s', (query, part) => {
    expect(top(query), query).toContain(part);
  });

  it('a veg eater is never offered the chicken burger first', () => {
    expect(searchFoods(FOODS, 'mcdonalds', 'veg').every((f) => f.diet === 'veg')).toBe(true);
  });
});
