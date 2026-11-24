import type { Food } from '@/domain/nutrition/calc';
import type { Meal } from '@/domain/nutrition/types';

/**
 * Chain menus (November 2026), written by scripts/chain-foods/build.py from each chain's own
 * nutrition document: Burger King (February 2026), Domino's, Pizza Hut (2022), McDonald's
 * (compiled from the booklet, flagged as such) and Starbucks. One row is one serving as the
 * chain publishes it; sizes, crusts and portions of one product share a `group`.
 */
export interface ChainRow {
  id: string;
  name: string;
  brand: string;
  group: string;
  groupName: string;
  dims: [string, string][];
  category: Food['category'];
  diet: Food['diet'];
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** null: the document does not give it (unknown, never 0). */
  fibre: number | null;
  sugar: number | null;
  /** Grams or ml of the serving, or null when the chain publishes no weight. */
  basis: number | null;
  unit: 'g' | 'ml' | null;
  piece: [string, string];
  /** Slices in the whole pizza, for pizzas (the row is one slice). */
  slices: number | null;
  serves: number | null;
  source: 'official' | 'compiled';
  flag: 'conflict' | 'check' | null;
  note: string | null;
  /** For a row that took an older food's id: the id it has in the documents. */
  replaces?: string;
}

export const CHAIN_DOCS: Record<string, string> = {
  'Burger King': 'Burger King India, nutrition per serve, 12 February 2026',
  "Domino's": "Domino's India, nutritional information",
  'Pizza Hut': 'Pizza Hut India, nutrition and allergen booklet, 2022',
  "McDonald's": "McDonald's India (North and East), compiled from the official booklet",
  Starbucks: 'Tata Starbucks, nutrition guide for food and beverages',
};

/** Other names people type for a chain; search treats them like the chain's name. */
export const CHAIN_ALIASES: Record<string, string[]> = {
  "Domino's": ['dominos', 'domino'],
  "McDonald's": ['mcd', 'mcdonalds', 'mcdonald', 'mcdonalds'],
  'Burger King': ['bk', 'burgerking'],
  'Pizza Hut': ['pizzahut'],
  Starbucks: ['starbuck', 'sbux'],
};

const ALL: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner'];
const MEALS: Partial<Record<Food['category'], Meal[]>> = {
  drink: ['breakfast', 'snacks'],
  sweet: ['snacks', 'dinner'],
};

/** A virtual weight for items sold without one: their numbers are per piece, grams never shown. */
const NO_WEIGHT_G = 100;

export function fromChain(r: ChainRow): Food {
  const weighed = r.basis !== null && r.basis > 0;
  const pieceG = weighed ? r.basis! : NO_WEIGHT_G;
  const k = 100 / pieceG;
  const pizza = r.slices !== null && r.slices > 1;
  const wholeFirst = pizza && r.dims.some(([d, v]) => d === 'Size' && /regular|personal/i.test(v));
  const units: Food['units'] = pizza
    ? wholeFirst
      ? ['serving', 'piece']
      : ['piece', 'serving']
    : ['piece'];
  if (weighed) units.push(r.unit === 'ml' ? 'ml' : 'g');
  return {
    id: r.id,
    name: `${r.brand} ${r.name}`,
    aliases: CHAIN_ALIASES[r.brand] ?? [],
    brand: r.brand,
    category: r.category,
    region: 'all',
    meals: MEALS[r.category] ?? ALL,
    diet: r.diet,
    jain: false,
    per100: {
      kcal: r.kcal * k,
      proteinG: r.p * k,
      carbsG: r.c * k,
      fatG: r.f * k,
      fibreG: (r.fibre ?? 0) * k,
    },
    fatPer100: null,
    units,
    // A regular pizza starts at the whole pizza, a medium or large at two slices.
    defaultAmount: pizza && !wholeFirst ? 2 : 1,
    density: 1,
    pieceG,
    pieceName: r.piece,
    servingG: pizza ? pieceG * r.slices! : null,
    ...(pizza ? { servingName: ['pizza', 'pizzas'] as [string, string] } : {}),
    source: 'chain',
    recipe: null,
    variant: { group: r.group, groupName: `${r.brand} ${r.groupName}`, dims: r.dims },
    chainDoc: CHAIN_DOCS[r.brand] ?? r.brand,
    ...(r.fibre === null ? { fibreUnknown: true } : {}),
    ...(weighed ? {} : { servingOnly: true }),
    ...(r.flag === 'conflict' ? { printedKcal: true } : {}),
    ...(r.flag && r.note ? { check: { kind: r.flag, note: r.note } } : {}),
  };
}
