import { measurePortion, type FoodPortion } from '@/data/repositories/food';

/** The largest serving the amount box takes, as `measurePortion` allows. */
export const MAX_SERVING_G = 5000;

/**
 * The same food at a new weight, everything else scaling with it. An OverloadGPT food is "1
 * serving" of that many grams, so the serving itself changes and keeps its source; a library
 * food keeps its unit and the number of katoris, rotis or pieces changes instead.
 */
export function resizedPortion(
  p: FoodPortion,
  grams: number,
  katoriMl: number | null,
): FoodPortion | null {
  if (!(grams > 0) || grams > MAX_SERVING_G) return null;
  const g = Math.round(grams);
  if (p.food.ai && p.unit === 'serving')
    return {
      ...p,
      amount: 1,
      food: { ...p.food, servingG: g, ai: { ...p.food.ai, portion: `${g} g` } },
    };
  let now: number;
  try {
    now = measurePortion(p, katoriMl).grams;
  } catch {
    return null;
  }
  if (!(now > 0)) return null;
  if (p.food.units.includes('g')) return { ...p, unit: 'g', amount: g, size: null };
  return { ...p, amount: Math.round(((p.amount * g) / now) * 100) / 100 };
}

/** Units counted in whole things (rotis, glasses, servings) and in halves (katoris, plates). */
const WHOLE_UNITS = new Set(['piece', 'share', 'serving', 'glass', 'cup', 'tbsp', 'tsp', 'ladle']);
const HALF_UNITS = new Set(['katori', 'plate', 'bowl']);
/** The most of one item the count goes up to. */
export const MAX_COUNT = 50;

/** "3 rotis (120 g)" -> 3, unless the number is a weight or volume ("150 g rice"). */
function leadingCount(text: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(\S*)/.exec(text);
  if (!m) return null;
  if (/^(g|gm|gms|gram|grams|kg|ml|l|litre|liter|oz)\b/i.test(m[2] ?? '')) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/**
 * How many of an item are on the plate, and the step + and - take: one roti, half a katori.
 * Null when the food is measured by weight, where the grams box is the way to change it.
 */
export function itemCount(p: FoodPortion): { count: number; step: number } | null {
  if (p.food.ai && p.unit === 'serving') {
    const n = leadingCount(p.food.ai.portion);
    if (n === null && /^\s*\d/.test(p.food.ai.portion)) return null;
    return { count: n ?? 1, step: 1 };
  }
  if (WHOLE_UNITS.has(p.unit)) return { count: p.amount, step: 1 };
  if (HALF_UNITS.has(p.unit)) return { count: p.amount, step: 0.5 };
  return null;
}

/** "1 roti" -> "2 rotis": the first word after the number follows the count. */
function recount(text: string, from: number, to: number): string {
  const m = /^(\s*)(\d+(?:\.\d+)?)(\s+)(\S+)(.*)$/s.exec(text);
  if (!m) return `${to} × ${text}`;
  let word = m[4]!;
  if (from === 1 && to !== 1 && !/s$/i.test(word)) word = `${word}s`;
  else if (from !== 1 && to === 1 && /[^s]s$/i.test(word)) word = word.slice(0, -1);
  return `${m[1]}${to}${m[3]}${word}${m[5]}`;
}

/**
 * The same item with `count` of them: 4 rotis instead of the 3 the photo showed. Calories and
 * macros scale with it. An OverloadGPT food changes its serving (and the words of its portion);
 * a library food changes how many rotis, katoris or plates it is.
 */
export function withCount(p: FoodPortion, count: number): FoodPortion | null {
  const now = itemCount(p);
  if (!now || !(count > 0) || count > MAX_COUNT) return null;
  const c = Math.round(count * 100) / 100;
  if (p.food.ai && p.unit === 'serving') {
    const servingG = p.food.servingG;
    if (!servingG) return null;
    const grams = Math.round((servingG * c) / now.count);
    if (!(grams > 0) || grams > MAX_SERVING_G) return null;
    return {
      ...p,
      amount: 1,
      food: {
        ...p.food,
        servingG: grams,
        ai: { ...p.food.ai, portion: recount(p.food.ai.portion, now.count, c) },
      },
    };
  }
  return { ...p, amount: c };
}
