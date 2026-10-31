/**
 * Food and nutrition types. Every number the app shows for food is calculated from these:
 * ingredient values per 100 g (USDA SR28, public domain) and standard home recipes in grams.
 */

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}

export const ZERO: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 };

/** One raw ingredient, per 100 g. */
export interface Ingredient extends Nutrients {
  name: string;
  /** USDA SR28 NDB number, so every value can be traced. Empty for water. */
  ndb: string;
  /** The USDA food it comes from. */
  usda: string;
  /** Water in g per 100 g, used for cooking yields. */
  water: number;
  note?: string;
}

export type FoodCategory =
  | 'bread'
  | 'rice'
  | 'dal'
  | 'sabzi'
  | 'paneer'
  | 'egg'
  | 'chicken'
  | 'meat'
  | 'fish'
  | 'breakfast'
  | 'south'
  | 'snack'
  | 'sweet'
  | 'drink'
  | 'dairy'
  | 'fruit'
  | 'side'
  | 'basic';

export type Region = 'north' | 'south' | 'west' | 'east' | 'all';

/** What a food fits: Jain also excludes onion, garlic and root vegetables. */
export type DietType = 'veg' | 'egg' | 'nonveg' | 'jain';

export type Meal = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

export type OilLevel = 'light' | 'normal' | 'rich';
/** Light is about half the standard oil, rich about double. */
export const OIL_FACTOR: Record<OilLevel, number> = { light: 0.5, normal: 1, rich: 2 };

/** Household units. Volumes in ml, from common Indian kitchen sizes. */
export type UnitId =
  | 'katori'
  | 'ladle'
  | 'glass'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'piece'
  | 'serving'
  | 'share'
  | 'g'
  | 'plate'
  | 'bowl'
  | 'ml';

export type SizeId = 'small' | 'medium' | 'large';
