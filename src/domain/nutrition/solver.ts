import type { FoodLog } from '../models/schemas';
import { portionNutrients, roundNutrients, unitGrams, type Food } from './calc';
import { fitsDiet, searchFoods } from './search';
import { ZERO, type DietType, type Meal, type Nutrients, type SizeId, type UnitId } from './types';

/**
 * The food solver (November 2026, Project doc `claude/macrotrophy-brain-plan.md`): one engine
 * behind "Eat next" and the weekly meal plan, so the two never disagree. It only picks foods
 * and portions; every number is the library's (or the person's own food's), added up.
 *
 * There are no prices in the library, so budget is a class per food (staples, everyday,
 * premium), never a rupee figure.
 */

export type Setting = 'home' | 'hostel' | 'mess' | 'pg';
export type Budget = 'tight' | 'medium' | 'open';
export const SETTING_LABEL: Record<Setting, string> = {
  home: 'Home',
  hostel: 'Hostel',
  mess: 'Mess',
  pg: 'PG',
};
export const BUDGET_LABEL: Record<Budget, string> = {
  tight: 'Tight',
  medium: 'Medium',
  open: 'No limit',
};

/** 1 staples (dal, eggs, chana, milk), 2 everyday (paneer, chicken), 3 premium (whey, fish, nuts). */
export type Cost = 1 | 2 | 3;
const COST_BY_CATEGORY: Partial<Record<Food['category'], Cost>> = {
  bread: 1,
  rice: 1,
  dal: 1,
  sabzi: 1,
  egg: 1,
  basic: 1,
  breakfast: 1,
  south: 1,
  dairy: 1,
  fruit: 2,
  side: 1,
  snack: 2,
  paneer: 2,
  chicken: 2,
  drink: 2,
  meat: 3,
  fish: 3,
  sweet: 2,
};
const COST_OVERRIDE: Record<string, Cost> = {
  'protein-shake': 3,
  'greek-yogurt': 3,
  almonds: 3,
  paneer: 2,
  tofu: 2,
  banana: 1,
  peanuts: 1,
  'roasted-chana': 1,
  'soya-chunks-boiled': 1,
  'sattu-drink': 1,
  chaas: 1,
  'sprouts-chaat': 1,
  'roasted-makhana': 2,
  apple: 2,
};
export const costOf = (food: Pick<Food, 'id' | 'category'>): Cost =>
  COST_OVERRIDE[food.id] ?? COST_BY_CATEGORY[food.category] ?? 2;
const MAX_COST: Record<Budget, Cost> = { tight: 1, medium: 2, open: 3 };

/** What a mess, hostel or PG kitchen cannot give: things kept in the room or bought ready. */
export const ADD_ONS = [
  'boiled-egg',
  'curd',
  'milk',
  'protein-shake',
  'roasted-chana',
  'peanuts',
  'paneer',
  'soya-chunks-boiled',
  'sprouts-chaat',
  'sattu-drink',
  'chaas',
  'banana',
  'peanut-butter-toast',
  'greek-yogurt',
] as const;

const POOL: Record<Meal, string[]> = {
  breakfast: [
    'poha', 'upma', 'idli', 'dosa', 'besan-chilla', 'moong-chilla', 'oats-milk', 'omelette',
    'egg-bhurji', 'paneer-paratha', 'aloo-paratha', 'peanut-butter-toast', 'overnight-oats',
    'boiled-egg', 'sprouts-chaat', 'banana', 'milk', 'curd', 'protein-shake', 'tofu-bhurji',
    'paneer-bhurji',
  ],
  lunch: [
    'phulka', 'rice', 'dal-tadka', 'moong-dal', 'rajma', 'chole', 'khichdi', 'curd',
    'paneer-bhurji', 'palak-paneer', 'soya-curry', 'egg-curry', 'chicken-curry', 'chicken-plain',
    'fish-curry', 'mix-veg', 'green-salad', 'curd-rice', 'chicken-breast', 'tofu',
    'kala-chana-boiled', 'boiled-egg',
  ],
  snacks: [
    'roasted-chana', 'peanuts', 'sprouts-chaat', 'chana-chaat', 'roasted-makhana', 'banana',
    'apple', 'curd', 'greek-yogurt', 'milk', 'protein-shake', 'boiled-egg', 'paneer',
    'sattu-drink', 'chaas', 'peanut-butter-toast', 'soya-chunks-boiled',
  ],
  dinner: [
    'phulka', 'rice', 'dal-tadka', 'moong-dal', 'masoor-dal', 'khichdi', 'curd', 'paneer-bhurji',
    'palak-paneer', 'soya-curry', 'egg-curry', 'egg-bhurji', 'chicken-curry', 'chicken-plain',
    'fish-curry', 'mix-veg', 'green-salad', 'chicken-breast', 'tofu', 'boiled-egg', 'milk',
  ],
};

export interface Portion {
  food: Food;
  amount: number;
  unit: UnitId;
  size: SizeId | null;
  grams: number;
  nutrients: Nutrients;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** A food at an amount of one of its units, with the library's numbers for it. */
export function portionOf(
  food: Food,
  amount: number,
  unit: UnitId = food.units[0]!,
  katoriMl?: number | null,
): Portion | null {
  if (!food.units.includes(unit)) return null;
  const size: SizeId | null = unit === 'katori' || unit === 'cup' ? 'medium' : null;
  const one = unitGrams(food, unit, size, katoriMl);
  if (!one || !(amount > 0)) return null;
  const grams = round1(one * amount);
  return { food, amount, unit, size, grams, nutrients: roundNutrients(portionNutrients(food, grams)) };
}

const usual = (food: Food, katoriMl?: number | null) =>
  portionOf(food, food.defaultAmount, food.units[0], katoriMl);

// ---------------------------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------------------------

export interface Habit {
  /** Days in the window it was eaten on, and at which meals. */
  days: number;
  meals: Set<Meal>;
  /** The amount last logged. */
  amount: number;
  unit: UnitId;
}

export const HABIT_WINDOW_DAYS = 28;

/** What the person actually eats, from their last four weeks of logs. */
export function habitsFrom(logs: FoodLog[], today: string): Map<string, Habit> {
  const from = new Date(`${today}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - HABIT_WINDOW_DAYS);
  const start = from.toISOString().slice(0, 10);
  const days = new Map<string, Set<string>>();
  const out = new Map<string, Habit>();
  for (const l of [...logs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (l.deletedAt || l.date < start || l.date > today) continue;
    const set = days.get(l.foodId) ?? new Set<string>();
    set.add(l.date);
    days.set(l.foodId, set);
    const h = out.get(l.foodId) ?? { days: 0, meals: new Set<Meal>(), amount: l.amount, unit: l.unit as UnitId };
    h.meals.add(l.meal);
    h.amount = l.amount;
    h.unit = l.unit as UnitId;
    h.days = set.size;
    out.set(l.foodId, h);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Eat next
// ---------------------------------------------------------------------------------------------

/** How a day's food usually splits across meals, and the meals still to come from each. */
const MEAL_SHARE: Record<Meal, number> = { breakfast: 0.25, lunch: 0.35, snacks: 0.1, dinner: 0.3 };
const MEALS_FROM: Record<Meal, Meal[]> = {
  breakfast: ['breakfast', 'lunch', 'snacks', 'dinner'],
  lunch: ['lunch', 'snacks', 'dinner'],
  snacks: ['snacks', 'dinner'],
  dinner: ['dinner'],
};

/** Under this much left there is nothing to suggest. */
export const EAT_NEXT_MIN_KCAL = 120;

export interface Suggestion extends Portion {
  /** usual: they eat it. protein: it closes the protein gap. fits: it fits what is left. */
  why: 'usual' | 'protein' | 'fits';
}

export interface EatNextInput {
  remaining: { kcal: number; proteinG: number };
  meal: Meal;
  diet: DietType | null | undefined;
  foods: Map<string, Food>;
  habits: Map<string, Habit>;
  setting?: Setting | null;
  budget?: Budget | null;
  katoriMl?: number | null;
  limit?: number;
  /** Foods already on the plate today at this meal: not suggested again. */
  eatenNow?: Set<string>;
}

/**
 * Up to three foods for what is left of the day's calories and protein: closes the protein gap
 * without going over the calories, favouring what the person already eats at this meal.
 */
export function eatNext(input: EatNextInput): Suggestion[] {
  const { remaining, meal, foods, habits } = input;
  if (remaining.kcal < EAT_NEXT_MIN_KCAL) return [];
  const away = input.setting && input.setting !== 'home';
  const ids = new Set<string>(away ? ADD_ONS : POOL[meal]);
  for (const [id, h] of habits) if (h.meals.has(meal) || h.days >= 3) ids.add(id);
  const maxCost = MAX_COST[input.budget ?? 'open'];
  // What this meal should bring: its share of what is left, by how the day usually splits.
  const share = MEAL_SHARE[meal] / MEALS_FROM[meal].reduce((n, m) => n + MEAL_SHARE[m], 0);
  const aim = { kcal: remaining.kcal * share, proteinG: Math.max(0, remaining.proteinG) * share };
  const proteinShare = Math.min(1, aim.proteinG / Math.max(1, aim.kcal / 10));
  const options: (Suggestion & { score: number })[] = [];
  for (const id of ids) {
    const food = foods.get(id);
    if (!food || !fitsDiet(food, input.diet) || input.eatenNow?.has(id)) continue;
    const habit = habits.get(id);
    // Their own usual amount when they have one, else the library's.
    const own = habit ? portionOf(food, habit.amount, habit.unit, input.katoriMl) : null;
    const tries: (Portion | null)[] = [own ?? usual(food, input.katoriMl)];
    for (const p of tries) {
      if (!p || p.nutrients.kcal < 30) continue;
      if (p.nutrients.kcal > Math.min(remaining.kcal * 1.05, Math.max(aim.kcal * 1.6, 200))) continue;
      const density = (p.nutrients.proteinG * 4) / Math.max(1, p.nutrients.kcal);
      // A cup of chai is not an answer to "what should I eat".
      if (p.nutrients.kcal < aim.kcal * 0.15 && density < 0.25) continue;
      const closes = aim.proteinG > 0 ? Math.min(p.nutrients.proteinG, aim.proteinG) / aim.proteinG : 0;
      const kcalShare = p.nutrients.kcal / Math.max(150, aim.kcal);
      let score = 100 * closes * proteinShare + 30 * density - 35 * Math.max(0, kcalShare - Math.max(closes, 0.35));
      if (habit) score += 12 + Math.min(8, habit.days);
      if (habit?.meals.has(meal)) score += 10;
      if (food.meals.includes(meal)) score += 14;
      // Over budget is out, unless it is something they already buy.
      if (costOf(food) > maxCost && !habit) continue;
      const why: Suggestion['why'] =
        closes >= 0.3 && density >= 0.2 ? 'protein' : habit ? 'usual' : 'fits';
      options.push({ ...p, why, score });
    }
  }
  const unscored = ({ score: _score, ...s }: Suggestion & { score: number }): Suggestion => s;
  const picked: Suggestion[] = [];
  const seen = new Set<string>();
  const categories = new Set<string>();
  for (const o of options.sort((a, b) => b.score - a.score || a.food.id.localeCompare(b.food.id))) {
    if (seen.has(o.food.id) || categories.has(o.food.category)) continue;
    seen.add(o.food.id);
    categories.add(o.food.category);
    picked.push(unscored(o));
    if (picked.length >= (input.limit ?? 3)) break;
  }
  return picked;
}

// ---------------------------------------------------------------------------------------------
// A restaurant menu
// ---------------------------------------------------------------------------------------------

export interface MenuMatch {
  /** The name as printed on the menu. */
  dish: string;
  /** The library food it was matched to at its usual portion, or null when nothing fits. */
  portion: Portion | null;
  /** best: fits what is left and brings the most protein for its calories. */
  verdict: 'best' | 'fits' | 'over' | 'unknown';
}

/**
 * Ranks the dishes read off a menu for what is left of the day. The dish names come from the
 * photo; every number comes from the matched library food, never from the AI.
 */
export function rankMenu(input: {
  dishes: string[];
  foods: Food[];
  remaining: { kcal: number; proteinG: number };
  diet: DietType | null | undefined;
  katoriMl?: number | null;
}): MenuMatch[] {
  const matched: (MenuMatch & { score: number })[] = input.dishes.map((dish) => {
    const food = searchFoods(input.foods, dish, null, 1)[0];
    const portion = food ? usual(food, input.katoriMl) : null;
    if (!food || !portion) return { dish, portion: null, verdict: 'unknown' as const, score: -1e6 };
    const over = portion.nutrients.kcal > Math.max(input.remaining.kcal, 0) * 1.05;
    const density = (portion.nutrients.proteinG * 4) / Math.max(1, portion.nutrients.kcal);
    const closes = input.remaining.proteinG > 0 ? Math.min(portion.nutrients.proteinG, input.remaining.proteinG) / input.remaining.proteinG : 0;
    const score = (fitsDiet(food, input.diet) ? 0 : -500) + (over ? -200 : 0) + 100 * closes + 60 * density;
    return { dish, portion, verdict: over ? ('over' as const) : ('fits' as const), score };
  });
  matched.sort((a, b) => b.score - a.score);
  let best = 0;
  return matched.map(({ score: _score, ...m }) => {
    if (m.verdict === 'fits' && best < 3 && m.portion && fitsDiet(m.portion.food, input.diet) && m.portion.nutrients.proteinG >= 8) {
      best += 1;
      return { ...m, verdict: 'best' as const };
    }
    return m;
  });
}

// ---------------------------------------------------------------------------------------------
// The week's meal plan
// ---------------------------------------------------------------------------------------------

interface Line {
  id: string;
  /** Amount of the food's first unit; the food's usual amount when left out. */
  amount?: number;
  /** carb: scaled to meet calories. */
  scale?: 'carb';
}
interface Template {
  key: string;
  meal: Meal;
  diet: 'veg' | 'egg' | 'nonveg';
  cost: Cost;
  /** Cooked by the mess or PG kitchen: not on the grocery list. */
  kitchen?: boolean;
  lines: Line[];
}

const T = (key: string, meal: Meal, diet: Template['diet'], cost: Cost, lines: Line[], kitchen = false): Template => ({
  key, meal, diet, cost, lines, kitchen,
});
const carb = (id: string, amount?: number): Line => ({ id, amount, scale: 'carb' });

/** Meals cooked at home. */
const HOME: Template[] = [
  T('poha-curd', 'breakfast', 'veg', 1, [{ id: 'poha' }, { id: 'curd' }]),
  T('chilla-chaas', 'breakfast', 'veg', 1, [{ id: 'besan-chilla', amount: 2 }, { id: 'chaas' }]),
  T('oats-banana', 'breakfast', 'veg', 1, [{ id: 'oats-milk' }, { id: 'banana' }]),
  T('idli-sambar', 'breakfast', 'veg', 1, [carb('idli', 3), { id: 'sambar' }]),
  T('moong-chilla-curd', 'breakfast', 'veg', 1, [{ id: 'moong-chilla', amount: 2 }, { id: 'curd' }]),
  T('paneer-paratha-curd', 'breakfast', 'veg', 2, [{ id: 'paneer-paratha', amount: 1 }, { id: 'curd' }]),
  T('upma-milk', 'breakfast', 'veg', 1, [{ id: 'upma' }, { id: 'milk' }]),
  T('omelette-toast', 'breakfast', 'egg', 1, [{ id: 'omelette' }, carb('bread-slice', 2), { id: 'milk' }]),
  T('bhurji-phulka', 'breakfast', 'egg', 1, [{ id: 'egg-bhurji' }, carb('phulka', 2)]),
  T('eggs-banana-milk', 'breakfast', 'egg', 1, [{ id: 'boiled-egg', amount: 3 }, { id: 'banana' }, { id: 'milk' }]),

  T('roti-dal-sabzi', 'lunch', 'veg', 1, [carb('phulka', 3), { id: 'dal-tadka' }, { id: 'mix-veg' }, { id: 'curd' }]),
  T('rajma-rice', 'lunch', 'veg', 1, [carb('rice', 1.5), { id: 'rajma' }, { id: 'green-salad' }]),
  T('chole-roti', 'lunch', 'veg', 1, [carb('phulka', 3), { id: 'chole' }, { id: 'curd' }]),
  T('khichdi-curd', 'lunch', 'veg', 1, [carb('khichdi', 1.5), { id: 'curd' }, { id: 'green-salad' }]),
  T('sambar-rice', 'lunch', 'veg', 1, [carb('rice', 1.5), { id: 'sambar' }, { id: 'beans-poriyal' }, { id: 'curd' }]),
  T('palak-paneer-roti', 'lunch', 'veg', 2, [carb('phulka', 3), { id: 'palak-paneer' }, { id: 'green-salad' }]),
  T('soya-roti', 'lunch', 'veg', 1, [carb('phulka', 3), { id: 'soya-curry' }, { id: 'curd' }]),
  T('egg-curry-roti', 'lunch', 'egg', 1, [carb('phulka', 3), { id: 'egg-curry' }, { id: 'green-salad' }]),
  T('chicken-rice', 'lunch', 'nonveg', 2, [carb('rice', 1.5), { id: 'chicken-curry' }, { id: 'green-salad' }]),
  T('chicken-roti', 'lunch', 'nonveg', 2, [carb('phulka', 3), { id: 'chicken-curry' }, { id: 'curd' }]),
  T('fish-rice', 'lunch', 'nonveg', 3, [carb('rice', 1.5), { id: 'fish-curry' }, { id: 'green-salad' }]),

  T('moong-bhindi', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'moong-dal' }, { id: 'bhindi' }]),
  T('paneer-bhurji-roti', 'dinner', 'veg', 2, [carb('phulka', 3), { id: 'paneer-bhurji' }, { id: 'green-salad' }]),
  T('dal-aloo-gobhi', 'dinner', 'veg', 1, [carb('rice', 1), { id: 'dal-fry' }, { id: 'aloo-gobhi' }]),
  T('masoor-lauki', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'masoor-dal' }, { id: 'lauki' }]),
  T('kadai-paneer-roti', 'dinner', 'veg', 2, [carb('phulka', 3), { id: 'kadai-paneer' }, { id: 'green-salad' }]),
  T('chana-dal-cabbage', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'chana-dal' }, { id: 'cabbage-sabzi' }]),
  T('egg-bhurji-dal', 'dinner', 'egg', 1, [carb('phulka', 3), { id: 'egg-bhurji' }, { id: 'dal-tadka' }]),
  T('grilled-chicken-roti', 'dinner', 'nonveg', 2, [carb('phulka', 3), { id: 'chicken-plain' }, { id: 'green-salad' }]),
  T('chicken-dal', 'dinner', 'nonveg', 2, [carb('phulka', 2), { id: 'chicken-curry' }, { id: 'moong-dal' }]),

  // Without onion, garlic or roots, so a Jain week has as much choice as any other.
  T('idli-curd', 'breakfast', 'veg', 1, [carb('idli', 3), { id: 'curd' }]),
  T('dhokla-chaas', 'breakfast', 'veg', 1, [carb('dhokla', 3), { id: 'chaas' }]),
  T('thepla-curd', 'breakfast', 'veg', 1, [carb('thepla', 2), { id: 'curd' }]),
  T('pongal-milk', 'breakfast', 'veg', 1, [{ id: 'pongal' }, { id: 'milk' }]),
  T('moong-lauki-roti', 'lunch', 'veg', 1, [carb('phulka', 3), { id: 'moong-dal' }, { id: 'lauki' }, { id: 'curd' }]),
  T('moong-cabbage-rice', 'lunch', 'veg', 1, [carb('rice', 1.5), { id: 'moong-dal' }, { id: 'cabbage-sabzi' }, { id: 'curd' }]),
  T('chana-kaddu-roti', 'lunch', 'veg', 1, [carb('phulka', 3), { id: 'kala-chana-boiled' }, { id: 'kaddu' }, { id: 'chaas' }]),
  T('rajma-plain-rice', 'lunch', 'veg', 1, [carb('jeera-rice', 1.5), { id: 'rajma-boiled' }, { id: 'curd' }]),
  T('khichdi-chaas', 'dinner', 'veg', 1, [carb('khichdi', 1.5), { id: 'curd' }]),
  T('paneer-beans-roti', 'dinner', 'veg', 2, [carb('phulka', 3), { id: 'paneer', amount: 100 }, { id: 'beans-poriyal' }]),
  T('soya-lauki-roti', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'soya-chunks-boiled' }, { id: 'lauki' }]),
  T('moong-kaddu-rice', 'dinner', 'veg', 1, [carb('rice', 1), { id: 'moong-dal' }, { id: 'kaddu' }]),

  T('chana', 'snacks', 'veg', 1, [{ id: 'roasted-chana' }]),
  T('sprouts', 'snacks', 'veg', 1, [{ id: 'sprouts-chaat' }]),
  T('peanuts-banana', 'snacks', 'veg', 1, [{ id: 'peanuts' }, { id: 'banana' }]),
  T('curd-apple', 'snacks', 'veg', 2, [{ id: 'curd' }, { id: 'apple' }]),
  T('makhana-milk', 'snacks', 'veg', 2, [{ id: 'roasted-makhana' }, { id: 'milk' }]),
  T('sattu', 'snacks', 'veg', 1, [{ id: 'sattu-drink' }]),
  T('shake-banana', 'snacks', 'veg', 3, [{ id: 'protein-shake' }, { id: 'banana' }]),
  T('boiled-eggs', 'snacks', 'egg', 1, [{ id: 'boiled-egg', amount: 2 }]),
];

/** What a mess or PG kitchen serves: logged as served, never on the grocery list. */
const KITCHEN: Template[] = [
  T('mess-poha', 'breakfast', 'veg', 1, [{ id: 'poha' }, { id: 'masala-chai' }], true),
  T('mess-paratha', 'breakfast', 'veg', 1, [carb('aloo-paratha', 2), { id: 'curd' }], true),
  T('mess-idli', 'breakfast', 'veg', 1, [carb('idli', 3), { id: 'sambar' }], true),
  T('mess-upma', 'breakfast', 'veg', 1, [{ id: 'upma' }, { id: 'masala-chai' }], true),
  T('mess-dal-sabzi', 'lunch', 'veg', 1, [carb('phulka', 3), carb('rice', 1), { id: 'dal-tadka' }, { id: 'mix-veg' }], true),
  T('mess-rajma', 'lunch', 'veg', 1, [carb('phulka', 2), carb('rice', 1), { id: 'rajma' }, { id: 'aloo-sabzi' }], true),
  T('mess-chole', 'lunch', 'veg', 1, [carb('phulka', 3), carb('rice', 1), { id: 'chole' }, { id: 'cabbage-sabzi' }], true),
  T('mess-kadhi', 'lunch', 'veg', 1, [carb('phulka', 2), carb('rice', 1), { id: 'kadhi' }, { id: 'aloo-gobhi' }], true),
  T('mess-idli-curd', 'breakfast', 'veg', 1, [carb('idli', 3), { id: 'curd' }], true),
  T('mess-thepla', 'breakfast', 'veg', 1, [carb('thepla', 2), { id: 'curd' }], true),
  T('mess-pongal', 'breakfast', 'veg', 1, [{ id: 'pongal' }, { id: 'milk' }], true),
  T('mess-moong-lauki', 'lunch', 'veg', 1, [carb('phulka', 3), carb('rice', 1), { id: 'moong-dal' }, { id: 'lauki' }], true),
  T('mess-moong-cabbage', 'lunch', 'veg', 1, [carb('phulka', 2), carb('rice', 1), { id: 'moong-dal' }, { id: 'cabbage-sabzi' }], true),
  T('mess-chana-kaddu', 'lunch', 'veg', 1, [carb('phulka', 3), carb('rice', 1), { id: 'kala-chana-boiled' }, { id: 'kaddu' }], true),
  T('mess-dinner-khichdi', 'dinner', 'veg', 1, [carb('khichdi', 1.5), { id: 'curd' }], true),
  T('mess-dinner-moong-beans', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'moong-dal' }, { id: 'beans-poriyal' }], true),
  T('mess-dinner-lauki', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'moong-dal' }, { id: 'lauki' }], true),
  T('mess-dinner-dal', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'dal-fry' }, { id: 'aloo-matar' }], true),
  T('mess-dinner-moong', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'moong-dal' }, { id: 'bhindi' }], true),
  T('mess-dinner-paneer', 'dinner', 'veg', 1, [carb('phulka', 3), { id: 'matar-paneer' }, { id: 'dal-tadka' }], true),
  T('mess-dinner-egg', 'dinner', 'egg', 1, [carb('phulka', 3), { id: 'egg-curry' }, { id: 'dal-tadka' }], true),
  T('mess-dinner-chicken', 'dinner', 'nonveg', 1, [carb('phulka', 3), { id: 'chicken-curry' }, { id: 'dal-tadka' }], true),
];

/** Snacks kept in a room, for people who do not cook. */
const ROOM: Template[] = HOME.filter((t) => t.meal === 'snacks' && t.key !== 'sprouts');

export const TEMPLATE_FOOD_IDS = [
  ...new Set([...HOME, ...KITCHEN].flatMap((t) => t.lines.map((l) => l.id)).concat(ADD_ONS, ...Object.values(POOL))),
];

export interface PlanMeal {
  meal: Meal;
  /** Served by the mess or PG kitchen. */
  kitchen: boolean;
  items: Portion[];
}
export interface PlanDay {
  /** 0 to 6 from the first day of the week. */
  index: number;
  meals: PlanMeal[];
  totals: Nutrients;
}
export interface GroceryItem {
  name: string;
  /** Grams to buy, or a count for things bought by the piece. */
  grams: number | null;
  count: number | null;
  countName: string | null;
}
export interface MealPlan {
  days: PlanDay[];
  targets: { kcal: number; proteinG: number };
  /** True when the protein target could not be met within the diet, budget and setting. */
  proteinShort: boolean;
  grocery: GroceryItem[];
}

export interface PlanInput {
  targets: { kcal: number; proteinG: number };
  diet: DietType | null | undefined;
  setting: Setting;
  budget: Budget;
  foods: Map<string, Food>;
  katoriMl?: number | null;
  /** Changes which meals land on which day, so "Make another" gives a different week. */
  seed?: number;
}

const dietRank = { veg: 0, egg: 1, nonveg: 2 } as const;
const sum = (items: Portion[]): Nutrients =>
  items.reduce(
    (t, p) => ({
      kcal: t.kcal + p.nutrients.kcal,
      proteinG: t.proteinG + p.nutrients.proteinG,
      carbsG: t.carbsG + p.nutrients.carbsG,
      fatG: t.fatG + p.nutrients.fatG,
      fibreG: t.fibreG + p.nutrients.fibreG,
    }),
    ZERO,
  );

/** The smallest step a food is served in, and the most of it in one meal. */
function stepOf(food: Food): { step: number; min: number; max: number } {
  const unit = food.units[0]!;
  if (unit === 'piece') return { step: 1, min: 1, max: 4 };
  if (unit === 'g' || unit === 'ml') return { step: 25, min: 25, max: 300 };
  return { step: 0.5, min: 0.5, max: 2 };
}

/** The dish of a meal that carries its protein: it can be served larger. */
const MAIN_CATEGORIES = new Set<Food['category']>(['dal', 'paneer', 'chicken', 'egg', 'fish', 'meat']);
/** Where a protein add-on is eaten, so no meal is stuffed with all of them. */
const ADD_ON_MEAL: Record<string, Meal> = {
  milk: 'breakfast',
  'boiled-egg': 'breakfast',
  'peanut-butter-toast': 'breakfast',
  curd: 'lunch',
  chaas: 'lunch',
  paneer: 'dinner',
  'soya-chunks-boiled': 'dinner',
  'greek-yogurt': 'snacks',
  'protein-shake': 'snacks',
  'roasted-chana': 'snacks',
  peanuts: 'snacks',
  'sprouts-chaat': 'snacks',
  'sattu-drink': 'snacks',
  banana: 'snacks',
};
/** The most add-ons one meal takes. */
const MAX_ADD_ONS: Record<Meal, number> = { breakfast: 1, lunch: 1, snacks: 2, dinner: 1 };

/**
 * Seven days of meals that hit the calorie and protein targets: meals rotate so the week does
 * not repeat, rotis and rice scale to the calories, and protein is topped up with the add-ons
 * the diet, budget and kitchen allow.
 */
export function planWeek(input: PlanInput): MealPlan {
  const { foods, targets } = input;
  const diet = input.diet === 'jain' ? 'veg' : (input.diet ?? 'nonveg');
  const maxCost = MAX_COST[input.budget];
  const away = input.setting !== 'home';
  const ok = (t: Template) =>
    dietRank[t.diet] <= dietRank[diet] &&
    t.cost <= maxCost &&
    t.lines.every((l) => {
      const f = foods.get(l.id);
      return f && fitsDiet(f, input.diet);
    });
  const mains = (away ? KITCHEN : HOME).filter(ok);
  const snacks = (away ? ROOM : HOME).filter((t) => t.meal === 'snacks').filter(ok);
  const seed = input.seed ?? 0;
  const addOns = ADD_ONS.map((id) => foods.get(id))
    .filter((f): f is Food => !!f && fitsDiet(f, input.diet) && costOf(f) <= maxCost)
    .map((f) => usual(f, input.katoriMl))
    .filter((p): p is Portion => !!p && p.nutrients.proteinG >= 5)
    .sort((a, b) => b.nutrients.proteinG / b.nutrients.kcal - a.nutrients.proteinG / a.nutrients.kcal);

  let proteinShort = false;
  const days: PlanDay[] = [];
  for (let d = 0; d < 7; d++) {
    const pick = (meal: Meal, list: Template[], offset: number) => {
      const options = list.filter((t) => t.meal === meal);
      // The richest protein options come round most often for people who eat them.
      const prefer = options.filter((t) => t.diet === diet);
      const pool = prefer.length >= 3 && (d + seed) % 2 === 0 ? prefer : options;
      return pool.length ? pool[(d * (offset + 1) + seed + offset) % pool.length]! : null;
    };
    const chosen: [Meal, Template | null][] = [
      ['breakfast', pick('breakfast', mains, 0)],
      ['lunch', pick('lunch', mains, 1)],
      ['snacks', pick('snacks', snacks, 2)],
      ['dinner', pick('dinner', mains, 3)],
    ];
    const meals: (PlanMeal & { scalable: { i: number; food: Food }[] })[] = chosen.map(([meal, t]) => {
      const items: Portion[] = [];
      const scalable: { i: number; food: Food }[] = [];
      for (const line of t?.lines ?? []) {
        const food = foods.get(line.id)!;
        const p = portionOf(food, line.amount ?? food.defaultAmount, food.units[0], input.katoriMl);
        if (!p) continue;
        if (line.scale === 'carb') scalable.push({ i: items.length, food });
        items.push(p);
      }
      return { meal, kitchen: !!t?.kitchen, items, scalable };
    });
    const total = () => sum(meals.flatMap((m) => m.items));
    const setAmount = (m: (typeof meals)[number], i: number, food: Food, amount: number) => {
      const p = portionOf(food, amount, food.units[0], input.katoriMl);
      if (p) m.items[i] = p;
    };

    // 1. Protein first. The dal, paneer, egg or chicken of lunch and dinner is served larger,
    // then add-ons go to the meal each belongs to, one or two a meal at most.
    const short = () => total().proteinG < targets.proteinG * 0.97;
    for (let round = 0; round < 2 && short(); round++)
      for (const m of meals) {
        if (!short()) break;
        const i = m.items.findIndex((p) => MAIN_CATEGORIES.has(p.food.category));
        if (i < 0) continue;
        const main = m.items[i]!;
        const { step, max } = stepOf(main.food);
        if (main.amount + step <= max) setAmount(m, i, main.food, main.amount + step);
      }
    const addedTo = new Map<Meal, number>();
    // A second pass lets each meal take one more, only when the first was not enough.
    for (const extra of [0, 1])
      for (const next of addOns) {
        if (!short()) break;
        const m = meals.find((x) => x.meal === (ADD_ON_MEAL[next.food.id] ?? 'snacks'))!;
        if ((addedTo.get(m.meal) ?? 0) >= MAX_ADD_ONS[m.meal] + extra) continue;
        if (meals.some((x) => x.items.some((p) => p.food.id === next.food.id))) continue;
        if (total().kcal + next.nutrients.kcal > targets.kcal * 1.05 + 200) continue;
        m.items.push(next);
        addedTo.set(m.meal, (addedTo.get(m.meal) ?? 0) + 1);
      }

    // 2. Calories: rotis and rice step up or down, spread over the meals.
    for (let guard = 0; guard < 40; guard++) {
      const gap = targets.kcal - total().kcal;
      if (Math.abs(gap) <= targets.kcal * 0.03) break;
      const up = gap > 0;
      let moved = false;
      const order = [...meals].sort((a, b) => (up ? 1 : -1) * (sum(a.items).kcal - sum(b.items).kcal));
      for (const m of order) {
        for (const sc of m.scalable) {
          const { step, min, max } = stepOf(sc.food);
          const now = m.items[sc.i]!.amount;
          const next = now + (up ? step : -step);
          if (next < min || next > max) continue;
          const p = portionOf(sc.food, next, sc.food.units[0], input.katoriMl);
          if (!p) continue;
          const change = Math.abs(p.nutrients.kcal - m.items[sc.i]!.nutrients.kcal);
          if (change > Math.abs(gap) * 1.6) continue;
          setAmount(m, sc.i, sc.food, next);
          moved = true;
          break;
        }
        if (moved) break;
      }
      if (!moved) break;
    }
    // Still over: the larger servings of step 1 come back down, sides first.
    for (let guard = 0; guard < 12 && total().kcal > targets.kcal * 1.04; guard++) {
      let moved = false;
      for (const m of [...meals].sort((a, b) => sum(b.items).kcal - sum(a.items).kcal)) {
        const i = m.items.findIndex(
          (p, k) => !m.scalable.some((sc) => sc.i === k) && p.amount - stepOf(p.food).step >= stepOf(p.food).min && p.nutrients.kcal > 60 && !MAIN_CATEGORIES.has(p.food.category),
        );
        if (i < 0) continue;
        const p = m.items[i]!;
        setAmount(m, i, p.food, p.amount - stepOf(p.food).step);
        moved = true;
        break;
      }
      if (!moved) break;
    }
    // Still over on a small target: the side that brings the least protein is left out.
    for (let guard = 0; guard < 4 && total().kcal > targets.kcal * 1.05; guard++) {
      const options = meals.flatMap((m) =>
        m.items
          .map((p, k) => ({ m, k, p }))
          .filter(({ m: meal, k, p }) => meal.items.length > 1 && !meal.scalable.some((sc) => sc.i === k) && !MAIN_CATEGORIES.has(p.food.category)),
      );
      const drop = options.sort(
        (a, b) => a.p.nutrients.proteinG / a.p.nutrients.kcal - b.p.nutrients.proteinG / b.p.nutrients.kcal,
      )[0];
      if (!drop) break;
      drop.m.items.splice(drop.k, 1);
      drop.m.scalable = drop.m.scalable.map((sc) => (sc.i > drop.k ? { ...sc, i: sc.i - 1 } : sc));
    }
    // Still short on calories: the simplest things to add, then larger sides.
    for (const id of ['banana', 'peanuts', 'milk', 'curd', 'roasted-chana']) {
      if (targets.kcal - total().kcal <= targets.kcal * 0.04) break;
      const food = foods.get(id);
      const p = food && fitsDiet(food, input.diet) ? usual(food, input.katoriMl) : null;
      const m = meals.find((x) => x.meal === (ADD_ON_MEAL[id] ?? 'snacks'))!;
      if (p && !meals.some((x) => x.items.some((y) => y.food.id === id)) && total().kcal + p.nutrients.kcal <= targets.kcal * 1.04)
        m.items.push(p);
    }
    for (let guard = 0; guard < 16 && targets.kcal - total().kcal > targets.kcal * 0.04; guard++) {
      let moved = false;
      for (const m of [...meals].sort((a, b) => sum(a.items).kcal - sum(b.items).kcal)) {
        const i = m.items.findIndex((p, k) => {
          const st = stepOf(p.food);
          const bigger = portionOf(p.food, p.amount + st.step, p.unit, input.katoriMl);
          return (
            !m.scalable.some((sc) => sc.i === k) &&
            p.amount + st.step <= st.max &&
            !!bigger &&
            total().kcal + (bigger.nutrients.kcal - p.nutrients.kcal) <= targets.kcal * 1.04
          );
        });
        if (i < 0) continue;
        const p = m.items[i]!;
        setAmount(m, i, p.food, p.amount + stepOf(p.food).step);
        moved = true;
        break;
      }
      if (!moved) break;
    }
    const totals = total();
    if (totals.proteinG < targets.proteinG * 0.9) proteinShort = true;
    days.push({
      index: d,
      meals: meals.map(({ scalable: _s, ...m }) => m),
      totals: roundNutrients(totals),
    });
  }
  return { days, targets, proteinShort, grocery: groceryList(days, input.setting) };
}

/**
 * What to buy for the week. At home, recipes are broken into their ingredients; in a mess,
 * hostel or PG only what the kitchen does not serve is listed.
 */
export function groceryList(days: PlanDay[], setting: Setting): GroceryItem[] {
  const grams = new Map<string, { name: string; g: number }>();
  const counts = new Map<string, { name: string; count: number; unit: string }>();
  // "Curd (dahi)" and "Curd", "Paneer, plain" and "Paneer" are one thing to buy.
  const keyOf = (name: string) =>
    name
      .toLowerCase()
      .replace(/\s*\(.*?\)/g, '')
      .replace(/,.*$/, '')
      .replace(/^boiled /, '')
      .trim();
  const addGrams = (name: string, g: number) => {
    const key = keyOf(name);
    if (key === 'egg') {
      addCount('Eggs', g / 50, 'eggs');
      return;
    }
    const clean = name.replace(/\s*\(.*?\)/g, '').replace(/,.*$/, '').trim();
    const cur = grams.get(key) ?? { name: clean, g: 0 };
    cur.g += g;
    grams.set(key, cur);
  };
  const addCount = (name: string, n: number, unit: string) => {
    const cur = counts.get(name) ?? { name, count: 0, unit };
    cur.count += n;
    counts.set(name, cur);
  };
  for (const day of days)
    for (const meal of day.meals) {
      if (meal.kitchen && setting !== 'home') continue;
      for (const p of meal.items) {
        const recipe = p.food.recipe;
        if (recipe && recipe.cookedG > 0 && recipe.lines.length > 0) {
          for (const line of recipe.lines) addGrams(line.name, (line.grams * p.grams) / recipe.cookedG);
        } else if (keyOf(p.food.name) === 'egg') {
          addCount('Eggs', p.unit === 'piece' ? p.amount : p.grams / 50, 'eggs');
        } else if (p.food.pieceG && p.food.pieceName && p.unit === 'piece') {
          addCount(p.food.name, p.amount, p.food.pieceName[1]);
        } else {
          addGrams(p.food.name, p.grams);
        }
      }
    }
  const out: GroceryItem[] = [];
  for (const { name, g } of grams.values()) {
    // Water, salt and a pinch of spice are not shopping.
    if (/^(water|salt)$/i.test(name) || g < 15) continue;
    out.push({ name, grams: Math.ceil(g / 50) * 50, count: null, countName: null });
  }
  for (const c of counts.values())
    out.push({ name: c.name, grams: null, count: Math.ceil(c.count), countName: c.unit });
  return out.sort((a, b) => (b.grams ?? b.count! * 50) - (a.grams ?? a.count! * 50));
}
