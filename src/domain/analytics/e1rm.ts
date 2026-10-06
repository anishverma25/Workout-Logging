/**
 * Estimated one-rep max.
 *
 * - Up to 5 reps: Brzycki, load × 36 / (37 - reps). It tracks real maxes more closely at low
 *   reps than Epley does.
 * - 6 to 12 reps: Epley, load × (1 + reps / 30).
 * - Reps in reserve count as reps you could have done: 8 reps with 2 in reserve is estimated
 *   as 10. Only while the total stays at 12 or fewer, where the formulas hold up.
 *
 * This is an estimate, never an actual maximum. Sets above E1RM_MAX_REPS are not estimated.
 * A single rep with nothing in reserve returns the load itself.
 */
export const E1RM_MAX_REPS = 12;
export const BRZYCKI_MAX_REPS = 5;

export function estimateOneRepMax(
  weightKg: number | null,
  reps: number | null,
  rir: number | null = null,
): number | null {
  if (weightKg === null || reps === null) return null;
  if (!(weightKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > E1RM_MAX_REPS) return null;
  const reserve = rir !== null && rir > 0 && reps + rir <= E1RM_MAX_REPS ? rir : 0;
  const effective = reps + reserve;
  if (effective === 1) return weightKg;
  if (effective <= BRZYCKI_MAX_REPS) return (weightKg * 36) / (37 - effective);
  return weightKg * (1 + effective / 30);
}

/**
 * Estimated 1RM is only meaningful for compound lifts: a one-rep max for a lateral raise or a
 * cable pushdown is not something anyone trains for or could safely test. Isolation exercises
 * keep their real records (heaviest load, best reps at each load) instead.
 */
export function supportsE1rm(
  exercise: { trackingType: string; category: string } | undefined,
): boolean {
  return !!exercise && exercise.trackingType === 'weight_reps' && exercise.category === 'compound';
}
