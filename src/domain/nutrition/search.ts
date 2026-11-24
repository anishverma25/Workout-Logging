import { everydayRank } from './everyday';
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

/**
 * Something was typed, but nothing in it can be searched (Hindi script, symbols): no food
 * matches it, and the search says to use English letters (batch 10, D3).
 */
export function unreadableQuery(query: string): boolean {
  return query.trim() !== '' && normalize(query).trim() === '';
}

const brandCache = new WeakMap<Food, string[]>();
/** Words in a brand that are also the food ("pizza" in Pizza Hut): typing them is not the brand. */
const FOOD_WORD_BRANDS = new Set(['pizza', 'burger', 'coffee', 'chai', 'tea', 'cafe']);
/** The brand's own words and the other names people type for it, as search tokens. */
function brandTokens(food: Food): string[] {
  if (!food.brand) return [];
  let t = brandCache.get(food);
  if (!t) {
    t = [food.brand, ...food.aliases]
      .flatMap((a) => normalize(a).split(' '))
      .filter((w) => w && !FOOD_WORD_BRANDS.has(w))
      .map(phonetic);
    brandCache.set(food, t);
  }
  return t;
}

/** Whether the query names this food's brand ("amul paneer", "mb biozyme", "cadbury"). */
export function namesBrand(food: Food, query: string): boolean {
  const own = brandTokens(food);
  if (own.length === 0) return false;
  return normalize(query)
    .split(' ')
    .filter((w) => w && !FOOD_WORD_BRANDS.has(w))
    .map(phonetic)
    .some((w) => own.some((t) => t === w || (w.length >= 3 && t.startsWith(w))));
}

/** Words close enough to count as a typo: one letter off, two in long words. */
function typoDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

function fuzzyWordScore(word: string, food: Food): number {
  const w = phonetic(word);
  if (w.length < 4) return 0;
  const limit = w.length >= 7 ? 2 : 1;
  const { name, alias } = tokens(food);
  let best = 0;
  for (const t of [...name, ...alias]) {
    // A whole word with a typo, or the start of one typed with a typo ("muscleblz").
    const d = Math.min(
      typoDistance(w, t),
      t.length > w.length ? typoDistance(w, t.slice(0, w.length)) : 9,
    );
    if (d <= limit) best = Math.max(best, 3);
  }
  return best;
}

/** Relevance of a food for a query; 0 means no match. */
export function foodScore(food: Food, query: string, fuzzy = false): number {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return unreadableQuery(query) ? 0 : 1;
  let total = 0;
  for (const w of words) {
    const s = wordScore(w, food) || (fuzzy ? fuzzyWordScore(w, food) : 0);
    if (s === 0) return 0;
    total += s;
  }
  // A query that is exactly one of the food's names picks the everyday dish: "dal" is dal
  // tadka, "paneer" is plain paneer. Shorter names win the remaining ties.
  const q = normalize(query);
  // "Milk, full cream" is milk: the name before a comma or bracket counts as the food itself.
  // Not for the reference databases, whose every name starts with the plain word ("Rice, white,
  // glutinous, unenriched, cooked" is not what someone typing "rice" means).
  const reference = food.source === 'usda' || food.source === 'indb';
  const base = normalize(reference ? food.name : (food.name.split(/[,(]/)[0] ?? food.name));
  // An alias that is the whole query counts like the name (an alias word scores 6 against 10 for
  // a name word), so "chapati" is roti, not chapati roll; a food named exactly the query still
  // comes first.
  const aliasExact = food.aliases.some((a) => normalize(a) === q) ? 4 * words.length + 1 : 0;
  // Larger than any alias can add, so a name that is the query always wins ("Protein bar" of
  // your own over a brand's bar that lists "protein bar" as another name).
  const nameExact = base === q ? 4 * words.length + 3 : 0;
  const exact = aliasExact + nameExact;
  // The curated library first, then Indian Nutrient Databank dishes, then USDA foods.
  const tail = food.source === 'usda' ? 4 : food.source === 'indb' ? 2 : 0;
  // Packs from the branded database: first when the brand is typed ("amul paneer"), after the
  // everyday food when it is not ("paneer" is plain paneer, not thirty brands of it).
  const brand = food.brand ? (namesBrand(food, query) ? 2 : -3) : 0;
  // Indian dish names end in what the dish is: "jeera rice" is rice, "rice kheer" is kheer.
  const nameWords = base.split(' ');
  // Only among partial matches: a food that is exactly what was typed is never overtaken.
  const head =
    !reference && exact === 0 && nameWords.length > 1 && nameWords.at(-1) === words.at(-1)
      ? 0.5
      : 0;
  return total + exact + brand + head - tail - normalize(food.name).length * 0.01;
}

/** Whether a food fits a diet. Jain food is vegetarian without onion, garlic or roots. */
export function fitsDiet(food: Pick<Food, 'diet' | 'jain'>, diet: DietType | null | undefined) {
  if (!diet || diet === 'nonveg') return true;
  if (diet === 'jain') return food.jain;
  if (diet === 'egg') return food.diet !== 'nonveg';
  return food.diet === 'veg';
}

interface PrefixIndex {
  byPrefix: Map<string, Food[]>;
}
const indexCache = new WeakMap<Food[], PrefixIndex>();

/**
 * Foods by the first two letters of each word of their names and other names, built once per
 * list: a query only scores the foods that can match its words, so search stays fast as the
 * library grows.
 */
function prefixIndex(foods: Food[]): PrefixIndex {
  let index = indexCache.get(foods);
  if (index) return index;
  const byPrefix = new Map<string, Food[]>();
  for (const food of foods) {
    const { name, alias } = tokens(food);
    const keys = new Set<string>();
    for (const t of [...name, ...alias]) if (t.length >= 2) keys.add(t.slice(0, 2));
    for (const k of keys) {
      const list = byPrefix.get(k);
      if (list) list.push(food);
      else byPrefix.set(k, [food]);
    }
  }
  index = { byPrefix };
  indexCache.set(foods, index);
  return index;
}

/** The foods that could match every word of the query, or null when any word is too short. */
function candidates(foods: Food[], words: string[]): Food[] | null {
  const { byPrefix } = prefixIndex(foods);
  let result: Food[] | null = null;
  for (const w of words) {
    const forms = [w, ...(SYNONYMS[w] ?? [])].map(phonetic);
    if (forms.some((f) => f.length < 2)) continue;
    const these = new Set<Food>();
    for (const f of forms) for (const food of byPrefix.get(f.slice(0, 2)) ?? []) these.add(food);
    result = result === null ? [...these] : result.filter((x: Food) => these.has(x));
  }
  return result;
}

/**
 * The foods for a query, best first. Every word must match (a word with a typo matches when
 * nothing else does), the brand typed ranks that brand first, and foods the person logs often
 * move up a little, never above a food named exactly what was typed. A shared food with the
 * same name as one in the library is shown once.
 */
export function searchFoods(
  foods: Food[],
  query: string,
  diet: DietType | null | undefined,
  limit = 30,
  boost?: ReadonlyMap<string, number>,
): Food[] {
  const words = normalize(query).split(' ').filter(Boolean);
  const pool = (words.length ? candidates(foods, words) : null) ?? foods;
  const rank = (list: Food[], fuzzy: boolean) =>
    list
      .filter((f) => fitsDiet(f, diet))
      .map((food) => {
        const score = foodScore(food, query, fuzzy);
        // A recent or usual food moves up by at most 2, less than an exact name adds (7+).
        const extra = score > 0 && boost ? Math.min(2, (boost.get(food.id) ?? 0) * 0.5) : 0;
        return { food, score: score > 0 ? score + extra : 0 };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);
  let matches: { food: Food; score: number }[] = rank(pool, false);
  // Nothing (or almost nothing) for what was typed: allow a typo in each word. Not when the
  // words do match foods outside the person's diet ("chicken" for a vegetarian is not a typo).
  const outsideDiet = matches.length === 0 && !!diet && pool.some((f) => foodScore(f, query) > 0);
  if (matches.length < 3 && !outsideDiet && words.some((w) => w.length >= 4)) {
    const seen = new Set(matches.map((m) => m.food));
    matches = [...matches, ...rank(foods, true).filter((m) => !seen.has(m.food))];
  }
  // The everyday picks for the most typed words come first, in their own order.
  const picks = everydayRank(normalize(query));
  if (picks) {
    const byId = new Map(foods.map((f) => [f.id, f]));
    const pinned = [...picks.keys()]
      .map((id) => byId.get(id))
      .filter((f): f is Food => !!f && fitsDiet(f, diet))
      .map((food) => ({ food, score: Infinity }));
    const pinnedIds = new Set(pinned.map((p) => p.food.id));
    matches = [...pinned, ...matches.filter((m) => !pinnedIds.has(m.food.id))];
  }
  const shown = new Set<string>();
  const out: Food[] = [];
  for (const m of matches) {
    const key = displayKey(m.food.name);
    // One line per name: the same dish from a second source ("Idli" from the Indian Nutrient
    // Databank under our own "Idli", a shared food under the library's) is left out. The
    // person's own foods always show.
    if (shown.has(key) && !OWN_SOURCES.has(m.food.source)) continue;
    shown.add(key);
    out.push(m.food);
    if (out.length >= limit) break;
  }
  return out;
}

const OWN_SOURCES = new Set<Food['source']>(['custom', 'custom_recipe', 'ai', 'off']);

/** "Makki ki roti" and "Curd rice (Dahi bhaat/...)" by the name before any bracket. */
function displayKey(name: string): string {
  return normalize(name.split(/[(/]/)[0] ?? name);
}

/** Everyday foods shown before "Show more" for a plain word. */
export const FIRST_EVERYDAY = 8;
/** Packs shown before "Show more" for a plain word. */
export const FIRST_PACKS = 3;
/** Reference entries (USDA) shown first only when fewer everyday foods than this match. */
export const FEW_EVERYDAY = 3;

/**
 * Results split into what shows first and what waits behind "Show more". A plain word ("rice")
 * shows a short list: the everyday foods and dishes, then a few packs. The detailed reference
 * entries (USDA's twenty kinds of raw and cooked rice) wait behind "Show more", unless almost
 * nothing else matches. A brand typed shows its first ten products.
 */
export function groupResults(
  results: Food[],
  query: string,
): { first: Food[]; more: Food[]; brandTyped: boolean } {
  const brandTyped = results.some((f) => f.brand && namesBrand(f, query));
  if (brandTyped) return { first: results.slice(0, 10), more: results.slice(10), brandTyped };
  // The most typed words ("rice", "dal", "egg") show only their everyday picks first.
  const picks = everydayRank(normalize(query));
  if (picks && results.some((f) => picks.has(f.id))) {
    return {
      first: results.filter((f) => picks.has(f.id)),
      more: results.filter((f) => !picks.has(f.id)),
      brandTyped,
    };
  }
  const words = normalize(query).split(' ').filter(Boolean);
  // A pack only shows first when its own name says what was typed, not its brackets ("Plant
  // Protein (Pea + Brown Rice)" is not rice).
  const named = (f: Food) => {
    // Its own name: without the brackets, and without the brand in front ("Pizza Hut 7 UP").
    const own = f.brand && f.name.startsWith(f.brand) ? f.name.slice(f.brand.length) : f.name;
    const outside = normalize(own.replace(/\([^)]*\)/g, ' ')).split(' ');
    return words.every((w) => outside.some((x) => x.startsWith(w)));
  };
  const everyday = results.filter((f) => !f.brand && f.source !== 'usda');
  const reference = results.filter((f) => !f.brand && f.source === 'usda');
  const packs = results.filter((f) => f.brand && named(f));
  const firstReference = everyday.length < FEW_EVERYDAY ? reference.slice(0, 5) : [];
  const keep = new Set([
    ...everyday.slice(0, FIRST_EVERYDAY),
    ...firstReference,
    ...packs.slice(0, FIRST_PACKS),
  ]);
  return {
    first: results.filter((f) => keep.has(f)),
    more: results.filter((f) => !keep.has(f)),
    brandTyped,
  };
}

/**
 * Sizes and versions of one product (a pizza's sizes and crusts, a drink's cup sizes) show as
 * one result: the best ranked of them, which the food's page then lets the person change.
 */
export function collapseVariants(results: Food[]): Food[] {
  const seen = new Set<string>();
  return results.filter((f) => {
    if (!f.variant) return true;
    if (seen.has(f.variant.group)) return false;
    seen.add(f.variant.group);
    return true;
  });
}

/** Every version of a product, for the selectors on its page. */
export function variantsOf(foods: readonly Food[], food: Food): Food[] {
  if (!food.variant) return [];
  const group = food.variant.group;
  return foods.filter((f) => f.variant?.group === group);
}

/**
 * The version that matches `dims` with one dimension changed, or the first that has the new
 * value when that exact combination is not sold (a large pizza has no thin crust).
 */
export function pickVariant(
  variants: readonly Food[],
  current: Food,
  dim: string,
  value: string,
): Food | null {
  const want = new Map(current.variant?.dims ?? []);
  want.set(dim, value);
  const has = (f: Food) => new Map(f.variant?.dims ?? []).get(dim) === value;
  const exact = variants.find(
    (f) => has(f) && (f.variant?.dims ?? []).every(([d, v]) => want.get(d) === v),
  );
  return exact ?? variants.find(has) ?? null;
}

/** The choices for each dimension of a product ("Size": Regular, Medium, Large), in menu order. */
export function variantChoices(variants: readonly Food[]): [string, string[]][] {
  const out = new Map<string, string[]>();
  for (const f of variants)
    for (const [d, v] of f.variant?.dims ?? []) {
      const list = out.get(d) ?? [];
      if (!list.includes(v)) list.push(v);
      out.set(d, list);
    }
  return [...out.entries()];
}
