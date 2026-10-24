import { foodFromItem, type FoodItem } from '@/app/foodAi';
import type { FoodPortion } from '@/data/repositories/food';
import { normalize } from '@/domain/exercises/search';
import type { Food } from '@/domain/nutrition/calc';
import { fitsDiet } from '@/domain/nutrition/search';
import { defaultPortion } from './foodText';
import type { FoodContext } from './useFoodContext';

/**
 * Turning OverloadGPT's foods into plate portions. A food the curated library has by exactly
 * that name or alias uses the library's values with the AI's amount, because a tested recipe
 * beats an estimate; anything else becomes an AI food with the numbers the server checked.
 */

/** A curated library food with exactly this name or alias. */
export function libraryMatch(item: FoodItem, ctx: FoodContext): Food | null {
  const name = normalize(item.name);
  for (const f of ctx.foods) {
    if (f.source === 'usda' || f.source === 'indb') continue;
    if (normalize(f.name) === name || f.aliases.some((a) => normalize(a) === name))
      return fitsDiet(f, ctx.diet) || item.diet === f.diet ? f : null;
  }
  return null;
}

const countIn = (portion: string) => Number(/^\s*(\d+(?:\.\d+)?)/.exec(portion)?.[1] ?? '1');

/** The portion for an item: pieces or katoris when the library food has them, else grams. */
export function portionForItem(item: FoodItem, ctx: FoodContext): FoodPortion {
  // The person's own numbers are never swapped for the library's.
  const food = item.basis === 'yours' ? null : libraryMatch(item, ctx);
  if (!food) return defaultPortion(foodFromItem(item));
  const count = countIn(item.portion);
  if (food.pieceG && food.units.includes('piece')) {
    const each = item.grams / count;
    if (each > food.pieceG * 0.6 && each < food.pieceG * 1.6)
      return { ...defaultPortion(food), unit: 'piece', amount: count };
  }
  if (/plate/i.test(item.portion) && food.units.includes('plate'))
    return { ...defaultPortion(food), unit: 'plate', amount: count, size: null };
  if (/bowl/i.test(item.portion) && food.units.includes('bowl'))
    return { ...defaultPortion(food), unit: 'bowl', amount: count, size: null };
  if (/katori|bowl/i.test(item.portion) && food.units.includes('katori'))
    return { ...defaultPortion(food), unit: 'katori', amount: count, size: 'medium' };
  if (food.units.includes('g'))
    return {
      food,
      amount: item.grams,
      unit: 'g',
      size: null,
      oilLevel: food.fatPer100 ? 'normal' : null,
    };
  return defaultPortion(food);
}

/** The names the app knows, most useful first, so the AI can use them for what it sees. */
export function knownNames(ctx: FoodContext, starters: string[], limit = 160): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string | undefined) => {
    if (!name || seen.has(name) || out.length >= limit) return;
    seen.add(name);
    out.push(name);
  };
  for (const l of ctx.logs.slice(-200).reverse()) add(l.foodName);
  for (const id of starters) add(ctx.foodById.get(id)?.name);
  for (const f of ctx.foods) if (f.source === 'recipe' || f.source === 'ingredient') add(f.name);
  return out;
}
