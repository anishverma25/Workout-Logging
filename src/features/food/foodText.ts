import type { FoodPortion } from '@/data/repositories/food';
import { UNIT_LABEL, type Food } from '@/domain/nutrition/calc';
import type { DietType, UnitId } from '@/domain/nutrition/types';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function unitName(food: Food, unit: UnitId) {
  if (unit === 'piece' && food.pieceName) return cap(food.pieceName[0]);
  if (unit === 'g') return 'Grams';
  if (unit === 'share') return 'Share of the pot';
  return cap(UNIT_LABEL[unit][0]);
}

/** A first portion for a food: its usual unit and amount. */
export function defaultPortion(food: Food): FoodPortion {
  const unit = food.units[0]!;
  return {
    food,
    unit,
    amount: food.defaultAmount,
    size: unit === 'katori' || unit === 'cup' ? 'medium' : null,
    oilLevel: food.fatPer100 ? 'normal' : null,
  };
}

export const DIET_LABEL: Record<DietType, { title: string; description: string }> = {
  veg: { title: 'Vegetarian', description: 'No meat, fish or eggs' },
  egg: { title: 'Eggetarian', description: 'Vegetarian, and eggs' },
  nonveg: { title: 'Non-vegetarian', description: 'Everything' },
  jain: { title: 'Jain', description: 'Vegetarian, no onion, garlic or root vegetables' },
};

/** Where a food's numbers come from, shown with the food. */
export const SOURCE: Record<Food['source'], string> = {
  recipe: 'Calculated from a home recipe. Varies with oil and portion.',
  ingredient: 'USDA lab values.',
  label: 'From the pack label.',
  chain: "From the chain's published nutrition. Outlets vary a little.",
  usda: 'USDA lab values.',
  indb: 'Indian Nutrient Databank, calculated from a published Indian recipe.',
  off: 'From the pack label, via Open Food Facts.',
  ai: 'Worked out by OverloadGPT. Check the portion.',
  custom: 'Your food, from its label.',
  custom_recipe: 'Your recipe.',
};
