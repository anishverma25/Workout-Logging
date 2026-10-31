import type { Food } from '@/domain/nutrition/calc';
import type { FoodCategory, Meal, Region, UnitId } from '@/domain/nutrition/types';
import { fromDish, fromLabel, type DishDef, type LabelDef, type Line } from '../foods';
import type { IngredientId } from '../ingredients';
import { withMeasures } from '../measures';

/**
 * Compact recipe notation for the regional library (round 5, October 2026). Each dish is a
 * standard home or restaurant recipe in grams of raw ingredients, calculated exactly like the
 * curated library: USDA SR28 values, and the Indian Food Composition Tables 2017 (NIN) for
 * Indian ingredients USDA lacks. Nothing is copied from another app.
 *
 *   lines: 'potato 300, curd 60, oil 25'  (ingredient id, grams of raw ingredient)
 *   cooked: grams of the finished pot, or 'm34' for a cooked moisture of 34%
 *
 * Any oil, ghee, butter or mustard oil line is the cooking fat the oil level changes.
 */

export const MAINS: Meal[] = ['lunch', 'dinner'];
export const ALL: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner'];
const FATS = new Set<string>(['oil', 'ghee', 'butter', 'mustard-oil', 'olive-oil']);

const REGION: Record<string, Region> = { n: 'north', s: 'south', e: 'east', w: 'west', a: 'all' };
const MEALS: Record<string, Meal[]> = {
  m: MAINS,
  b: ['breakfast'],
  bs: ['breakfast', 'snacks'],
  s: ['snacks'],
  a: ALL,
  bm: ['breakfast', 'lunch', 'dinner'],
  sd: ['snacks', 'dinner'],
};

export interface Opts {
  /** Aliases, separated by semicolons. */
  a?: string;
  /** Pieces the recipe makes, and what one is called. */
  p?: [number, string, string];
  /** Servings the recipe makes. */
  s?: number;
  /** Meals key (see MEALS). */
  m?: keyof typeof MEALS;
  u?: UnitId[];
  /** Default amount in the first unit. */
  n?: number;
  /** g per ml, for drinks. */
  d?: number;
  /** Stable id when the name alone would clash. */
  id?: string;
  /** No adjustable cooking fat (the fat is part of the food, as in a sweet's ghee). */
  nofat?: boolean;
}

export const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function parseLines(text: string): Line[] {
  return text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const m = /^([a-z0-9-]+)\s+(\d+(?:\.\d+)?)$/.exec(x);
      if (!m || Number(m[2]) <= 0) throw new Error(`Bad recipe line "${x}"`);
      return [m[1] as IngredientId, Number(m[2])];
    });
}

export interface GroupDef {
  category: FoodCategory;
  meals: keyof typeof MEALS;
  units: UnitId[];
}

/** A group of dishes sharing a category, usual meals and units. */
export function group(def: GroupDef) {
  const out: DishDef[] = [];
  const add = (
    name: string,
    region: string,
    lines: string,
    cooked: number | string,
    o: Opts = {},
  ) => {
    const parsed = parseLines(lines);
    const fat = o.nofat ? [] : parsed.map(([id]) => id).filter((id) => FATS.has(id));
    out.push({
      id: o.id ?? slug(name),
      name,
      aliases: o.a
        ? o.a
            .split(';')
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
      category: def.category,
      region: REGION[region] ?? 'all',
      meals: MEALS[o.m ?? def.meals]!,
      lines: parsed,
      fat: fat.length ? fat : undefined,
      cooked: typeof cooked === 'string' ? { moisture: Number(cooked.slice(1)) / 100 } : cooked,
      pieces: o.p?.[0],
      piece: o.p ? [o.p[1], o.p[2]] : undefined,
      servings: o.s,
      units: o.u ?? (o.p ? ['piece', 'g'] : def.units),
      amount: o.n,
      density: o.d,
    });
  };
  return { add, out };
}

export const CURRY: UnitId[] = ['katori', 'ladle', 'g'];
export const DRY: UnitId[] = ['katori', 'g'];
export const RICE: UnitId[] = ['katori', 'serving', 'g'];
export const PLATE: UnitId[] = ['serving', 'g'];
export const GLASS: UnitId[] = ['glass', 'g'];
export const CUP: UnitId[] = ['cup', 'g'];
export const SPOON: UnitId[] = ['tbsp', 'tsp', 'g'];

export const buildDishes = (dishes: DishDef[]): Food[] => dishes.map(fromDish).map(withMeasures);
export const buildLabels = (labels: LabelDef[]): Food[] => labels.map(fromLabel).map(withMeasures);
