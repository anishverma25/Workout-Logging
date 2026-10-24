import { CustomFood, FoodLog } from '@/domain/models/schemas';
import { portionNutrients, roundNutrients, unitGrams, type Food } from '@/domain/nutrition/calc';
import type { Meal, OilLevel, SizeId, UnitId } from '@/domain/nutrition/types';
import { customToFood, FOOD_LIBRARY_VERSION, recipeDiet, recipePer100 } from '../library/foods';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, patchRecords, putRecords, softDelete } from './write';

export class FoodError extends Error {}

export interface FoodPortion {
  food: Food;
  amount: number;
  unit: UnitId;
  size: SizeId | null;
  oilLevel: OilLevel | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Grams and nutrients for a portion, exactly as they are saved. */
export function measurePortion(p: FoodPortion, katoriMl?: number | null) {
  if (!(p.amount > 0) || p.amount > 5000) throw new FoodError('Enter an amount.');
  const one = p.food.units.includes(p.unit) ? unitGrams(p.food, p.unit, p.size, katoriMl) : null;
  if (one === null) throw new FoodError(`${p.food.name} cannot be measured that way.`);
  const grams = round1(one * p.amount);
  if (grams <= 0 || grams > 5000) throw new FoodError('That portion looks too large.');
  const oil = p.food.fatPer100 ? (p.oilLevel ?? 'normal') : null;
  return { grams, oilLevel: oil, nutrients: roundNutrients(portionNutrients(p.food, grams, oil)) };
}

function toLog(
  p: FoodPortion,
  date: string,
  meal: Meal,
  katoriMl: number | null | undefined,
  at: string,
): FoodLog {
  const m = measurePortion(p, katoriMl);
  const sized = p.unit === 'katori' || p.unit === 'cup' ? (p.size ?? 'medium') : null;
  return FoodLog.parse({
    ...newRecordMeta('user', at),
    date,
    meal,
    foodId: p.food.id,
    foodName: p.food.name.slice(0, 80),
    amount: p.amount,
    unit: p.unit,
    size: sized,
    grams: m.grams,
    oilLevel: m.oilLevel,
    ...m.nutrients,
    libraryVersion:
      p.food.source === 'custom' || p.food.source === 'custom_recipe' ? null : FOOD_LIBRARY_VERSION,
  });
}

/** Logs one or more foods to a meal in one go (a whole thali). */
export async function logFoods(
  db: WorkoutDatabase,
  portions: FoodPortion[],
  where: { date: string; meal: Meal; katoriMl?: number | null },
  now: Date = new Date(),
): Promise<FoodLog[]> {
  if (portions.length === 0) throw new FoodError('Add a food first.');
  // Each a millisecond apart, so the meal keeps the order it was built in.
  const logs = portions.map((p, i) =>
    toLog(p, where.date, where.meal, where.katoriMl, new Date(now.getTime() + i).toISOString()),
  );
  await db.transaction('rw', [db.foodLogs, db.outbox], () => putRecords(db, 'foodLogs', logs));
  return logs;
}

/** Logs a meal again as it was (usual meal, yesterday's lunch), keeping its numbers. */
export async function copyFoodLogs(
  db: WorkoutDatabase,
  items: FoodLog[],
  where: { date: string; meal: Meal },
  now: Date = new Date(),
): Promise<FoodLog[]> {
  const logs = items.map((l, i) =>
    FoodLog.parse({
      ...l,
      ...newRecordMeta('user', new Date(now.getTime() + i).toISOString()),
      date: where.date,
      meal: where.meal,
    }),
  );
  await db.transaction('rw', [db.foodLogs, db.outbox], () => putRecords(db, 'foodLogs', logs));
  return logs;
}

/** Changes a logged food's portion, oil level or meal; the numbers are worked out again. */
export async function updateFoodLog(
  db: WorkoutDatabase,
  id: string,
  portion: FoodPortion,
  meal: Meal,
  katoriMl?: number | null,
): Promise<void> {
  await db.transaction('rw', [db.foodLogs, db.outbox], async () => {
    const current = await db.foodLogs.get(id);
    if (!current || current.deletedAt !== null) throw new FoodError('Entry not found.');
    const next = toLog(portion, current.date, meal, katoriMl, current.createdAt);
    const changes: Partial<FoodLog> = { ...next };
    delete changes.id;
    delete changes.createdAt;
    delete changes.origin;
    await patchRecord<FoodLog>(db, 'foodLogs', id, { ...changes, deletedAt: null });
  });
}

/** Moves a logged food to another meal, keeping its numbers. */
export async function moveFoodLog(db: WorkoutDatabase, id: string, meal: Meal): Promise<void> {
  await db.transaction('rw', [db.foodLogs, db.outbox], () =>
    patchRecord<FoodLog>(db, 'foodLogs', id, { meal }),
  );
}

export async function deleteFoodLogs(db: WorkoutDatabase, ids: string[]): Promise<void> {
  await db.transaction('rw', [db.foodLogs, db.outbox], () => softDelete(db, 'foodLogs', ids));
}

/** Undo for a delete. */
export async function restoreFoodLogs(db: WorkoutDatabase, ids: string[]): Promise<void> {
  await db.transaction('rw', [db.foodLogs, db.outbox], () =>
    patchRecords<FoodLog>(
      db,
      'foodLogs',
      ids.map((id) => ({ id, changes: { deletedAt: null } })),
    ),
  );
}

export interface CustomFoodInput {
  name: string;
  /** From a label: values per 100 g. */
  per100?: { kcal: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };
  pieceG?: number | null;
  diet?: CustomFood['diet'];
  /** A recipe: ingredients in grams, the cooked pot and how many it feeds. */
  recipe?: {
    ingredients: { id: string; grams: number }[];
    cookedG: number | null;
    servings: number;
  };
}

function customFields(
  input: CustomFoodInput,
): Omit<CustomFood, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'origin'> {
  const name = input.name.trim();
  if (!name) throw new FoodError('Give it a name.');
  if (input.recipe) {
    const lines = input.recipe.ingredients.filter((l) => l.grams > 0);
    if (lines.length === 0) throw new FoodError('Add at least one ingredient.');
    if (!(input.recipe.servings >= 1 && input.recipe.servings <= 50))
      throw new FoodError('It should feed between 1 and 50 people.');
    const { per100, cookedG, rawG } = recipePer100(lines, input.recipe.cookedG);
    if (input.recipe.cookedG !== null && (cookedG < rawG * 0.3 || cookedG > rawG * 6))
      throw new FoodError('Check the cooked weight: it is far from the ingredients.');
    const n = roundNutrients(per100);
    return {
      name,
      kind: 'recipe',
      ...n,
      pieceG: null,
      servings: Math.round(input.recipe.servings),
      cookedG: round1(cookedG),
      ingredients: lines.map((l) => ({ id: l.id, grams: round1(l.grams) })),
      diet: recipeDiet(lines.map((l) => l.id)),
    };
  }
  const p = input.per100;
  if (!p) throw new FoodError('Enter the values per 100 g.');
  if (!(p.kcal >= 0 && p.kcal <= 900)) throw new FoodError('Calories per 100 g go up to 900.');
  for (const v of [p.proteinG, p.carbsG, p.fatG, p.fibreG])
    if (!(v >= 0 && v <= 100)) throw new FoodError('Protein, carbs, fat and fibre go up to 100 g.');
  if (p.proteinG + p.carbsG + p.fatG > 100.5)
    throw new FoodError('Protein, carbs and fat add up to more than 100 g.');
  if (input.pieceG != null && !(input.pieceG > 0 && input.pieceG <= 2000))
    throw new FoodError('Enter a piece weight up to 2,000 g.');
  return {
    name,
    kind: 'food',
    ...roundNutrients(p),
    pieceG: input.pieceG ?? null,
    servings: null,
    cookedG: null,
    ingredients: null,
    diet: input.diet ?? 'veg',
  };
}

export async function saveCustomFood(
  db: WorkoutDatabase,
  input: CustomFoodInput,
  id?: string,
  now: Date = new Date(),
): Promise<CustomFood> {
  const fields = customFields(input);
  return db.transaction('rw', [db.customFoods, db.outbox], async () => {
    if (id) {
      const saved = await patchRecord<CustomFood>(db, 'customFoods', id, fields);
      if (!saved) throw new FoodError('Food not found.');
      return saved;
    }
    const food = CustomFood.parse({ ...newRecordMeta('user', now.toISOString()), ...fields });
    await putRecords(db, 'customFoods', [food]);
    return food;
  });
}

/**
 * Foods that exist only on the plate (OverloadGPT estimates, Open Food Facts products) become
 * the person's own foods when logged, so the log can be edited and logged again later.
 */
export async function keepPlateFoods(
  db: WorkoutDatabase,
  plate: FoodPortion[],
): Promise<FoodPortion[]> {
  // One transaction for the whole plate: the food list updates once, not once per food, which
  // kept a phone busy for seconds when OverloadGPT found several foods.
  return db.transaction('rw', [db.customFoods, db.outbox], () => keepAll(db, plate));
}

async function keepAll(db: WorkoutDatabase, plate: FoodPortion[]): Promise<FoodPortion[]> {
  const saved = new Map<string, Food>();
  const out: FoodPortion[] = [];
  for (const p of plate) {
    if (p.food.source !== 'ai' && p.food.source !== 'off') {
      out.push(p);
      continue;
    }
    let food = saved.get(p.food.id);
    if (!food) {
      const n = p.food.per100;
      const sum = n.proteinG + n.carbsG + n.fatG;
      const scale = sum > 100 ? 100 / sum : 1;
      const custom = await saveCustomFood(db, {
        name: p.food.name.slice(0, 60),
        per100: {
          kcal: Math.min(900, n.kcal),
          proteinG: n.proteinG * scale,
          carbsG: n.carbsG * scale,
          fatG: n.fatG * scale,
          fibreG: Math.min(100, n.fibreG),
        },
        pieceG: p.food.servingG ?? p.food.pieceG ?? null,
        diet: p.food.diet,
      });
      food = customToFood(custom);
      saved.set(p.food.id, food);
    }
    const portion =
      p.unit === 'serving' || p.unit === 'piece'
        ? { ...p, food, unit: 'piece' as const }
        : { ...p, food, unit: 'g' as const, amount: round1(measurePortion(p).grams) };
    out.push(food.units.includes(portion.unit) ? portion : { ...p, food, unit: 'g' as const });
  }
  return out;
}

export async function deleteCustomFood(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction('rw', [db.customFoods, db.outbox], () =>
    softDelete(db, 'customFoods', [id]),
  );
}
