import { supabase } from '@/data/sync/supabase';
import type { Food } from '@/domain/nutrition/calc';
import type { DietType } from '@/domain/nutrition/types';
import {
  FOOD_LIMITS,
  PHOTO_LIMITS,
  PHOTOS_PER_DAY,
  type FoodItem,
} from '../../supabase/functions/_shared/coach.ts';

/**
 * AI food logging (Pro): the person says what they ate, OverloadGPT splits it into foods with
 * weights and nutrients (looking up brands and restaurant items on the web), and the server
 * checks every item before it comes back. Nothing is stored on the server.
 */

export type { FoodItem };
export { FOOD_LIMITS, PHOTO_LIMITS, PHOTOS_PER_DAY };

export class FoodAiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase)
    throw new FoodAiError('Accounts are not set up in this version of the app.', 'off');
  const { data, error } = await supabase.functions.invoke('coach', { body });
  if (error) {
    let message = 'OverloadGPT could not be reached. Check your connection and try again.';
    let code = 'network';
    try {
      const ctx = (error as { context?: Response }).context;
      const json = ctx ? ((await ctx.json()) as { error?: string; code?: string }) : null;
      if (json?.error) message = json.error;
      if (json?.code) code = json.code;
    } catch {
      // Keep the general message.
    }
    throw new FoodAiError(message, code);
  }
  return (data ?? {}) as Record<string, unknown>;
}

export async function askFoodLog(text: string, diet: DietType | null): Promise<FoodItem[]> {
  const data = await invoke({
    kind: 'food',
    text: text.trim().slice(0, FOOD_LIMITS.text),
    diet: diet ?? '',
  });
  return Array.isArray(data.items) ? (data.items as FoodItem[]) : [];
}

/**
 * Sends one photo (already resized on the phone) with an optional note. The server checks Pro
 * and today's allowance, and returns checked foods and how many photos are left today.
 */
export async function askFoodPhoto(input: {
  image: string;
  mime: string;
  note: string;
  diet: DietType | null;
  known: string[];
}): Promise<{ items: FoodItem[]; left: number | null }> {
  const data = await invoke({
    kind: 'food_photo',
    image: input.image,
    mime: input.mime,
    note: input.note.trim().slice(0, PHOTO_LIMITS.note),
    diet: input.diet ?? '',
    known: input.known.slice(0, PHOTO_LIMITS.known),
  });
  return {
    items: Array.isArray(data.items) ? (data.items as FoodItem[]) : [],
    left: typeof data.left === 'number' ? data.left : null,
  };
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * A food made from one AI item, measured as the portion the person ate ("1 serving" is that
 * many grams), so it can be adjusted on the plate like any other food.
 */
export function foodFromItem(item: FoodItem): Food {
  const per = (v: number) => Math.round((v / item.grams) * 1000) / 10;
  return {
    id: `ai-${newId()}`,
    name: item.name,
    aliases: [],
    category: 'basic',
    region: 'all',
    meals: ['breakfast', 'lunch', 'snacks', 'dinner'],
    diet: item.diet,
    jain: false,
    per100: {
      kcal: Math.min(900, per(item.kcal)),
      proteinG: per(item.proteinG),
      carbsG: per(item.carbsG),
      fatG: per(item.fatG),
      fibreG: per(item.fibreG),
    },
    fatPer100: null,
    units: ['serving', 'g'],
    defaultAmount: 1,
    density: 1,
    pieceG: null,
    pieceName: null,
    servingG: item.grams,
    source: 'ai',
    recipe: null,
    ai: {
      basis: item.basis,
      ref: item.ref,
      portion: item.portion,
      ...(item.confidence ? { confidence: item.confidence } : {}),
    },
  };
}

/** The numbers a person sets for one food on the AI screen, for the portion they ate. */
export interface EditedNumbers {
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}

/**
 * A food with the person's own numbers for the amount they ate: logged as "1 serving" of that
 * many grams, marked as theirs, and adjustable on the plate like any other food.
 */
export function editedPortion(
  name: string,
  diet: Food['diet'],
  n: EditedNumbers,
): {
  food: Food;
  unit: 'serving';
  amount: number;
  size: null;
  oilLevel: null;
} {
  const food = foodFromItem({
    name,
    portion: `${Math.round(n.grams)} g`,
    grams: Math.round(n.grams),
    kcal: Math.round(n.kcal),
    proteinG: n.proteinG,
    carbsG: n.carbsG,
    fatG: n.fatG,
    fibreG: n.fibreG,
    diet: diet === 'egg' || diet === 'nonveg' ? diet : 'veg',
    basis: 'yours',
    ref: 'Your numbers',
  });
  return { food, unit: 'serving', amount: 1, size: null, oilLevel: null };
}
