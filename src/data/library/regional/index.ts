import type { Food } from '@/domain/nutrition/calc';
import { BREADS } from './breads';
import { BREAKFAST } from './breakfast';
import { buildDishes, buildLabels } from './build';
import { DALS } from './dals';
import { DRINKS } from './drinks';
import { FESTIVAL } from './festival';
import { REGIONAL_LABELS } from './labels';
import { PROTEIN } from './protein';
import { RICE_DISHES } from './rice';
import { SIDES } from './sides';
import { SNACKS } from './snacks';
import { SWEETS } from './sweets';
import { VEG } from './veg';

/**
 * The regional library (round 5): dishes from every state that the curated library did not
 * have, loaded with the long tail when food logging opens. They are calculated recipes like
 * the curated foods, so they rank with them in search.
 */
export const REGIONAL_DISHES = [
  ...BREAKFAST,
  ...RICE_DISHES,
  ...DALS,
  ...VEG,
  ...PROTEIN,
  ...BREADS,
  ...SNACKS,
  ...SWEETS,
  ...DRINKS,
  ...SIDES,
  ...FESTIVAL,
];

export const REGIONAL_FOODS: Food[] = [
  ...buildDishes(REGIONAL_DISHES),
  ...buildLabels(REGIONAL_LABELS),
];
