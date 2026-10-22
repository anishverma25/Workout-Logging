import type { Food } from './calc';
import type { UnitId } from './types';

/**
 * Reads a quantity the person typed ("150", "150 g", "2 scoops", "1 1/2 katori", "250 ml",
 * "1.5 kg") for one food. Returns the amount and unit to log, or null when it cannot be read
 * or the food cannot be measured that way. Volumes in ml become grams through the food's
 * density; kg become grams. No unit means the unit already chosen.
 */
export interface ParsedQuantity {
  amount: number;
  unit: UnitId;
  /** What was understood, to show back: "2 scoops". */
  text: string;
}

type Measured = Pick<Food, 'units' | 'pieceName' | 'density'>;

const FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};

/** The number at the start of the text and the rest of it, or null. */
function leadingNumber(text: string): { value: number; rest: string } | null {
  const t = text.trim().replace(/,(?=\d{1,2}(?!\d))/g, '.');
  // "1 1/2", "1/2", "1½", "½", "2.5", ".5"
  const m =
    /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(t) ??
    /^(\d+)?\s*([½¼¾⅓⅔])/.exec(t) ??
    /^(\d+)\s*\/\s*(\d+)/.exec(t) ??
    /^(\d*\.?\d+)/.exec(t);
  if (!m) return null;
  const rest = t.slice(m[0].length).trim();
  if (m.length === 4 && m[3] !== undefined) {
    const d = Number(m[3]);
    if (!d) return null;
    return { value: Number(m[1]) + Number(m[2]) / d, rest };
  }
  if (m[2] && FRACTIONS[m[2]] !== undefined) {
    return { value: Number(m[1] ?? 0) + FRACTIONS[m[2]]!, rest };
  }
  if (m[2] !== undefined && /^\d+$/.test(m[2]) && m[0].includes('/')) {
    const d = Number(m[2]);
    return d ? { value: Number(m[1]) / d, rest } : null;
  }
  return { value: Number(m[1]), rest };
}

const WORDS: [UnitId | 'kg' | 'ml' | 'l', string[]][] = [
  ['g', ['g', 'gm', 'gms', 'gr', 'gram', 'grams', 'grm']],
  ['kg', ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms']],
  ['ml', ['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters']],
  ['l', ['l', 'lt', 'litre', 'litres', 'liter', 'liters']],
  ['katori', ['katori', 'katoris', 'katora', 'bowl', 'bowls', 'vati', 'vatti']],
  ['ladle', ['ladle', 'ladles', 'ladel', 'karchi']],
  ['glass', ['glass', 'glasses']],
  ['cup', ['cup', 'cups']],
  ['tbsp', ['tbsp', 'tbs', 'tablespoon', 'tablespoons']],
  ['tsp', ['tsp', 'teaspoon', 'teaspoons']],
  ['piece', ['piece', 'pieces', 'pc', 'pcs', 'no', 'nos']],
  [
    'serving',
    ['serving', 'servings', 'scoop', 'scoops', 'portion', 'portions', 'pack', 'packet', 'sachet'],
  ],
  ['share', ['share', 'shares']],
];

function unitFor(word: string, food: Measured): UnitId | 'kg' | 'ml' | 'l' | null {
  const w = word.toLowerCase().replace(/\.$/, '');
  const names = (food.pieceName ?? []).map((x) => x.toLowerCase());
  // What the food's own pieces are called ("roti", "rotis", "egg", "scoop") counts as pieces
  // when the food has pieces, and as servings when it only has servings.
  if (names.includes(w)) return food.units.includes('piece') ? 'piece' : 'serving';
  for (const [unit, words] of WORDS) if (words.includes(w)) return unit;
  return null;
}

export function parseQuantity(
  text: string,
  food: Measured,
  current: UnitId,
): ParsedQuantity | null {
  const lead = leadingNumber(text);
  if (!lead || !(lead.value > 0)) return null;
  const word = lead.rest.replace(/^of\s+/, '').split(/\s+/)[0] ?? '';
  let unit: UnitId | 'kg' | 'ml' | 'l' = current;
  if (word) {
    const found = unitFor(word, food);
    if (!found) return null;
    unit = found;
  }
  let amount = lead.value;
  let target: UnitId;
  if (unit === 'kg' || unit === 'ml' || unit === 'l') {
    // Everything by weight or volume is logged in grams.
    if (!food.units.includes('g')) return null;
    if (unit === 'kg') amount *= 1000;
    else {
      if (!(food.density > 0)) return null;
      amount = (unit === 'l' ? amount * 1000 : amount) * food.density;
    }
    target = 'g';
  } else {
    if (!food.units.includes(unit)) return null;
    target = unit;
  }
  amount = target === 'g' ? Math.round(amount) : Math.round(amount * 100) / 100;
  if (!(amount > 0)) return null;
  return { amount, unit: target, text: `${amount} ${target}` };
}
