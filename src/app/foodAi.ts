import { supabase } from '@/data/sync/supabase';
import type { Food } from '@/domain/nutrition/calc';
import type { DietType } from '@/domain/nutrition/types';
import { FOOD_LIMITS, type FoodItem } from '../../supabase/functions/_shared/coach.ts';

/**
 * AI food logging (Pro): the person says what they ate, OverloadGPT splits it into foods with
 * weights and nutrients (looking up brands and restaurant items on the web), and the server
 * checks every item before it comes back. Nothing is stored on the server.
 */

export type { FoodItem };
export { FOOD_LIMITS };

export class FoodAiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function askFoodLog(text: string, diet: DietType | null): Promise<FoodItem[]> {
  if (!supabase)
    throw new FoodAiError('Accounts are not set up in this version of the app.', 'off');
  const { data, error } = await supabase.functions.invoke('coach', {
    body: { kind: 'food', text: text.trim().slice(0, FOOD_LIMITS.text), diet: diet ?? '' },
  });
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
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as FoodItem[]) : [];
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
    ai: { basis: item.basis, ref: item.ref, portion: item.portion },
  };
}
