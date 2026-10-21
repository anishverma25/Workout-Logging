import { normalize } from '../exercises/search';
import type { Food } from './calc';
import { fitsDiet, foodScore } from './search';
import type { DietType, UnitId } from './types';

/**
 * Turns a meal typed the way people say it, "2 roti dal aloo gobhi" or
 * "1 katori rajma aur chawal", into foods from the library with amounts. It only ever picks
 * foods that exist; it never makes up a food or a number. Words it cannot place are returned,
 * so the person sees what was left out.
 */

export interface ParsedItem {
  food: Food;
  amount: number;
  unit: UnitId | null;
}

export interface ParsedMeal {
  items: ParsedItem[];
  unknown: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  half: 0.5,
  aadha: 0.5,
  adha: 0.5,
  one: 1,
  ek: 1,
  a: 1,
  an: 1,
  two: 2,
  do: 2,
  three: 3,
  teen: 3,
  four: 4,
  char: 4,
  chaar: 4,
  five: 5,
  paanch: 5,
  panch: 5,
  six: 6,
  chhe: 6,
};

const UNIT_WORDS: Record<string, UnitId> = {
  katori: 'katori',
  katoris: 'katori',
  katora: 'katori',
  bowl: 'katori',
  bowls: 'katori',
  katoriyan: 'katori',
  glass: 'glass',
  glasses: 'glass',
  cup: 'cup',
  cups: 'cup',
  plate: 'serving',
  plates: 'serving',
  serving: 'serving',
  servings: 'serving',
  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  slice: 'piece',
  slices: 'piece',
  ladle: 'ladle',
  ladles: 'ladle',
  karchi: 'ladle',
  tbsp: 'tbsp',
  spoon: 'tbsp',
  spoons: 'tbsp',
  chammach: 'tbsp',
  tsp: 'tsp',
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
};

const FILLER = new Set([
  'and',
  'aur',
  'with',
  'ke',
  'saath',
  'sath',
  'of',
  'plus',
  'n',
  'or',
  'some',
  'thoda',
]);

function readNumber(word: string): number | null {
  if (/^\d+(\.\d+)?$/.test(word)) return Number(word);
  return NUMBER_WORDS[word] ?? null;
}

/** "150g" and "2pc" come apart into a number and a unit. */
function split(text: string): string[] {
  return normalize(text.replace(/½/g, ' 0.5 ').replace(/(\d)\.(\d)/g, '$1DOT$2'))
    .replace(/(\d)DOT(\d)/g, '$1.$2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean);
}

/** Best food for a run of words, only when every word matches it well. */
function matchRun(words: string[], foods: Food[], diet: DietType | null | undefined) {
  const query = words.join(' ');
  let best: { food: Food; score: number } | null = null;
  for (const food of foods) {
    if (!fitsDiet(food, diet)) continue;
    const score = foodScore(food, query);
    if (score > 0 && (!best || score > best.score)) best = { food, score };
  }
  // Each word must be at least an alias match (score 6 a word) or a strong prefix of the name.
  if (!best || best.score < words.length * 5.5) return null;
  return best.food;
}

export function parseMeal(text: string, foods: Food[], diet?: DietType | null): ParsedMeal {
  const words = split(text.replace(/[,+;&]/g, ' and '));
  const items: ParsedItem[] = [];
  const unknown: string[] = [];
  let amount: number | null = null;
  let unit: UnitId | null = null;
  let i = 0;
  while (i < words.length) {
    const w = words[i]!;
    const n = readNumber(w);
    if (n !== null && n > 0) {
      amount = n;
      i += 1;
      continue;
    }
    if (UNIT_WORDS[w] && (amount !== null || w.length > 2)) {
      unit = UNIT_WORDS[w];
      i += 1;
      continue;
    }
    if (FILLER.has(w)) {
      i += 1;
      continue;
    }
    let matched = false;
    for (let len = Math.min(4, words.length - i); len >= 1; len -= 1) {
      const run = words.slice(i, i + len);
      if (run.some((r) => FILLER.has(r) || readNumber(r) !== null)) continue;
      const food = matchRun(run, foods, diet);
      if (food) {
        const usable = unit && food.units.includes(unit) ? unit : null;
        items.push({ food, amount: amount ?? (usable ? 1 : food.defaultAmount), unit: usable });
        amount = null;
        unit = null;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      unknown.push(w);
      i += 1;
    }
  }
  return { items, unknown };
}
