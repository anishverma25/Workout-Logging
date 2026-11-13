import { useSyncExternalStore } from 'react';
import { supabase } from '@/data/sync/supabase';
import type { Food } from '@/domain/nutrition/calc';
import { newId } from '@/lib/ids';
import { getAccountState } from './account';

/**
 * Foods members suggested and the owner checked (migration 0025). They are fetched when the food
 * logger opens, at most once every few hours, and kept on the phone so search works offline.
 * A member's suggestion goes to `submit_food`; nothing is shared until it is approved.
 */

const CACHE_KEY = 'overload.sharedFoods';
const REFRESH_MS = 3 * 60 * 60 * 1000;

interface SharedRow {
  id: string;
  name: string;
  diet: Food['diet'];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  piece_g: number | null;
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));

/** A checked row from the server as a food the logger can use; null when it is not usable. */
export function sharedToFood(row: unknown): Food | null {
  const r = row as Partial<SharedRow> | null;
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string' || !r.name.trim()) return null;
  const kcal = num(r.kcal);
  const proteinG = num(r.protein_g);
  const carbsG = num(r.carbs_g);
  const fatG = num(r.fat_g);
  if (![kcal, proteinG, carbsG, fatG].every((v) => Number.isFinite(v) && v >= 0)) return null;
  if (kcal <= 0 || kcal > 900) return null;
  const diet: Food['diet'] = r.diet === 'egg' || r.diet === 'nonveg' ? r.diet : 'veg';
  const piece = r.piece_g === null || r.piece_g === undefined ? null : num(r.piece_g);
  const pieceG = piece && Number.isFinite(piece) && piece > 0 ? piece : null;
  const fibre = num(r.fibre_g);
  return {
    id: `shared-${r.id}`,
    name: r.name.trim(),
    aliases: [],
    category: 'basic',
    region: 'all',
    meals: ['breakfast', 'lunch', 'snacks', 'dinner'],
    diet,
    jain: false,
    per100: { kcal, proteinG, carbsG, fatG, fibreG: Number.isFinite(fibre) ? fibre : 0 },
    fatPer100: null,
    units: pieceG ? ['piece', 'g'] : ['g', 'katori'],
    defaultAmount: pieceG ? 1 : 100,
    density: 1,
    pieceG,
    pieceName: pieceG ? ['serving', 'servings'] : null,
    servingG: null,
    source: 'community',
    recipe: null,
  };
}

function readCache(): { at: number; foods: Food[] } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { at: 0, foods: [] };
    const parsed = JSON.parse(raw) as { at?: number; rows?: unknown[] };
    const foods = (parsed.rows ?? []).map(sharedToFood).filter((f): f is Food => f !== null);
    return { at: typeof parsed.at === 'number' ? parsed.at : 0, foods };
  } catch {
    return { at: 0, foods: [] };
  }
}

let state: Food[] | null = null;
let fetchedAt = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const EMPTY: Food[] = [];

function current(): Food[] {
  if (state === null) {
    const cached = readCache();
    state = cached.foods.length ? cached.foods : EMPTY;
    fetchedAt = cached.at;
  }
  return state;
}

export const sharedFoodsStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get: current,
};

export const useSharedFoods = () =>
  useSyncExternalStore(sharedFoodsStore.subscribe, sharedFoodsStore.get);

/** Fetches the checked foods when the copy on the phone is old. Never throws. */
export function loadSharedFoods(now: number = Date.now(), force = false): Promise<void> {
  current();
  if (!supabase || getAccountState().status !== 'signedIn') return Promise.resolve();
  if (!force && now - fetchedAt < REFRESH_MS) return Promise.resolve();
  if (loading) return loading;
  const client = supabase;
  loading = (async () => {
    try {
      const { data, error } = await client.rpc('get_shared_foods');
      // A server without the table yet, or no signal: keep what the phone has.
      if (error || !Array.isArray(data)) return;
      const foods = data.map(sharedToFood).filter((f): f is Food => f !== null);
      fetchedAt = now;
      state = foods.length ? foods : EMPTY;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: now, rows: data }));
      } catch {
        // Storage full or blocked: the list still works for this visit.
      }
      listeners.forEach((l) => l());
    } catch {
      // Offline.
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// ---------------------------------------------------------------------------------------------
// Suggesting a food, and the thank-you
// ---------------------------------------------------------------------------------------------

export class SuggestError extends Error {}

export interface SuggestedFood {
  name: string;
  diet: Food['diet'];
  per100: { kcal: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };
  pieceG: number | null;
}

/** Calories must roughly match the macros, as on a real label: the server's own rule. */
export function numbersAgree(per100: SuggestedFood['per100']): boolean {
  const fromMacros = 4 * per100.proteinG + 4 * per100.carbsG + 9 * per100.fatG;
  return Math.abs(per100.kcal - fromMacros) <= Math.max(40, 0.25 * per100.kcal);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Sends a food for review. Throws SuggestError with words for the person. */
export async function suggestFood(food: SuggestedFood): Promise<void> {
  if (!supabase || getAccountState().status !== 'signedIn') {
    throw new SuggestError('Sign in to suggest a food.');
  }
  if (!numbersAgree(food.per100)) {
    throw new SuggestError(
      'Saved for you. It was not sent for everyone: the calories do not match the protein, carbs and fat. Check the label.',
    );
  }
  const { error } = await supabase.rpc('submit_food', {
    p_id: newId(),
    p_name: food.name.trim(),
    p_diet: food.diet,
    p_kcal: round1(food.per100.kcal),
    p_protein: round1(food.per100.proteinG),
    p_carbs: round1(food.per100.carbsG),
    p_fat: round1(food.per100.fatG),
    p_fibre: round1(food.per100.fibreG),
    p_piece_g: food.pieceG === null ? null : round1(food.pieceG),
  });
  if (!error) return;
  if (error.code === '23505') {
    throw new SuggestError('Saved for you. A food with this name is already suggested or shared.');
  }
  if (/limit|waiting/i.test(error.message)) {
    throw new SuggestError('Saved for you. You have sent a lot for review; send more tomorrow.');
  }
  if (/disagree|missing|Name/i.test(error.message)) {
    throw new SuggestError('Saved for you. It was not sent for everyone: check the name and numbers.');
  }
  throw new SuggestError('Saved for you. It could not be sent for everyone right now.');
}

export interface FoodThanks {
  foods: { id: string; name: string; status: 'pending' | 'approved' | 'rejected' }[];
  credit: { percent: number; validUntil: string } | null;
}

/** The person's own suggestions and the thank-you open now. Null when it cannot be read. */
export async function fetchFoodThanks(): Promise<FoodThanks | null> {
  if (!supabase || getAccountState().status !== 'signedIn') return null;
  try {
    const { data, error } = await supabase.rpc('get_my_food_thanks');
    if (error || !data) return null;
    const d = data as {
      foods?: FoodThanks['foods'];
      credit?: { percent?: number; valid_until?: string } | null;
    };
    const credit =
      d.credit && typeof d.credit.percent === 'number' && typeof d.credit.valid_until === 'string'
        ? { percent: d.credit.percent, validUntil: d.credit.valid_until }
        : null;
    return { foods: Array.isArray(d.foods) ? d.foods : [], credit };
  } catch {
    return null;
  }
}

const THANKED_KEY = 'overload.foodThanked';

/** Approved foods this phone has not said thank you for yet. */
export function unthanked(thanks: FoodThanks): FoodThanks['foods'] {
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(THANKED_KEY) ?? '[]') as string[];
  } catch {
    seen = [];
  }
  return thanks.foods.filter((f) => f.status === 'approved' && !seen.includes(f.id));
}

export function markThanked(ids: string[]): void {
  try {
    const seen = JSON.parse(localStorage.getItem(THANKED_KEY) ?? '[]') as string[];
    localStorage.setItem(THANKED_KEY, JSON.stringify([...new Set([...seen, ...ids])].slice(-200)));
  } catch {
    // Storage blocked: the thank-you may show once more.
  }
}
