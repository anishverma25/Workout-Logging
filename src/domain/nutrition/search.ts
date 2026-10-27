import { normalize } from '../exercises/search';
import type { Food } from './calc';
import type { DietType } from './types';

/**
 * Food search that understands how Indian food names are typed: Hinglish spellings
 * (dal, daal, dhal), English and Hindi names (rice and chawal, okra and bhindi) and regional
 * names (curd, dahi, thayir). Every query word must match a word of the name or an alias.
 */

/**
 * Folds the usual transliteration differences: doubled vowels (daal, dal), an h after a
 * consonant (dhal, bhindi), w for v (sabzi and sabji are handled by z/j), ee and i.
 */
export function phonetic(word: string): string {
  return word
    .replace(/([bcdgjkpst])h/g, '$1')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/(.)\1+/g, '$1')
    .replace(/y$/g, 'i');
}

/** English and Hindi names for the same thing; each query word also matches its partners. */
const SYNONYMS: Record<string, string[]> = {
  rice: ['chawal', 'bhaat', 'chaval'],
  chawal: ['rice'],
  okra: ['bhindi'],
  ladyfinger: ['bhindi'],
  eggplant: ['baingan', 'brinjal'],
  brinjal: ['baingan'],
  cauliflower: ['gobhi'],
  potato: ['aloo'],
  potatoes: ['aloo'],
  spinach: ['palak'],
  peas: ['matar'],
  chickpea: ['chole', 'chana'],
  chickpeas: ['chole', 'chana'],
  lentil: ['dal'],
  lentils: ['dal'],
  yogurt: ['curd', 'dahi'],
  yoghurt: ['curd', 'dahi'],
  dahi: ['curd'],
  buttermilk: ['chaas'],
  tea: ['chai'],
  milk: ['doodh'],
  egg: ['anda', 'omelette', 'bhurji'],
  eggs: ['anda', 'egg'],
  chicken: ['murgh'],
  mutton: ['gosht'],
  fish: ['machli', 'meen'],
  flatbread: ['roti', 'paratha'],
  bread: ['roti', 'pav'],
  cheese: ['paneer'],
  cottage: ['paneer'],
  sweet: ['halwa', 'kheer', 'ladoo'],
  dessert: ['halwa', 'kheer', 'ladoo', 'rasgulla'],
  salad: ['kachumber'],
  soya: ['nutrela'],
  sabji: ['sabzi'],
  bhaji: ['sabzi', 'pakora'],
};

export interface FoodMatch {
  food: Food;
  score: number;
}

function tokensOf(food: Food): { name: string[]; alias: string[] } {
  return {
    name: normalize(food.name).split(' ').map(phonetic),
    alias: food.aliases.flatMap((a) => normalize(a).split(' ')).map(phonetic),
  };
}

const cache = new WeakMap<Food, ReturnType<typeof tokensOf>>();
const tokens = (food: Food) => {
  let t = cache.get(food);
  if (!t) {
    t = tokensOf(food);
    cache.set(food, t);
  }
  return t;
};

function wordScore(word: string, food: Food): number {
  const { name, alias } = tokens(food);
  const forms = [word, ...(SYNONYMS[word] ?? [])].map(phonetic);
  let best = 0;
  for (const f of forms) {
    name.forEach((t, i) => {
      if (t === f) best = Math.max(best, 10 - i * 0.1);
      else if (t.startsWith(f)) best = Math.max(best, 7 - i * 0.1);
    });
    for (const t of alias) {
      if (t === f) best = Math.max(best, 6);
      else if (t.startsWith(f)) best = Math.max(best, 4);
    }
  }
  return best;
}

/** Relevance of a food for a query; 0 means no match. */
export function foodScore(food: Food, query: string): number {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return 1;
  let total = 0;
  for (const w of words) {
    const s = wordScore(w, food);
    if (s === 0) return 0;
    total += s;
  }
  // A query that is exactly one of the food's names picks the everyday dish: "dal" is dal
  // tadka, "paneer" is plain paneer. Shorter names win the remaining ties.
  const q = normalize(query);
  // "Milk, full cream" is milk: the name before a comma or bracket counts as the food itself.
  const base = normalize(food.name.split(/[,(]/)[0] ?? food.name);
  const exact = (food.aliases.some((a) => normalize(a) === q) ? 3 : 0) + (base === q ? 2 : 0);
  // The curated library first, then Indian Nutrient Databank dishes, then USDA foods.
  const tail = food.source === 'usda' ? 4 : food.source === 'indb' ? 2 : 0;
  return total + exact - tail - normalize(food.name).length * 0.01;
}

/** Whether a food fits a diet. Jain food is vegetarian without onion, garlic or roots. */
export function fitsDiet(food: Pick<Food, 'diet' | 'jain'>, diet: DietType | null | undefined) {
  if (!diet || diet === 'nonveg') return true;
  if (diet === 'jain') return food.jain;
  if (diet === 'egg') return food.diet !== 'nonveg';
  return food.diet === 'veg';
}

export function searchFoods(
  foods: Food[],
  query: string,
  diet: DietType | null | undefined,
  limit = 30,
): Food[] {
  return foods
    .filter((f) => fitsDiet(f, diet))
    .map((food) => ({ food, score: foodScore(food, query) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((m) => m.food);
}
