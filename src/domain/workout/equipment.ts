import type { Equipment, GymAccess } from '../models/schemas';

/**
 * What a person's equipment allows (setup: full gym, dumbbells, or home). One rule for the
 * programmes, the Brain's swaps, stall variations and the swap picker (batch 13).
 */
const ALLOWED: Record<Exclude<GymAccess, 'full_gym'>, ReadonlySet<Equipment | string>> = {
  dumbbells: new Set(['dumbbell', 'bodyweight', 'kettlebell', 'band', 'other']),
  home: new Set(['bodyweight', 'band', 'other']),
};

/** Dumbbell moves that work unloaded, so they count as home exercises (library keys). */
export const HOME_UNLOADED = new Set(['bulgarian-split-squat', 'walking-lunge', 'step-up']);

export function equipmentFits(
  equipment: Equipment | string,
  access: GymAccess | null | undefined,
  key?: string | null,
): boolean {
  if (!access || access === 'full_gym') return true;
  if (access === 'home' && key && HOME_UNLOADED.has(key)) return true;
  return ALLOWED[access].has(equipment);
}
