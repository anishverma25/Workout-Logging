/**
 * Estimated one-rep max (Evidence Corner, metric 1).
 *
 * - Epley throughout: load × (1 + reps / 30). It was among the most accurate linear equations
 *   in Reynolds et al. 2006 (Table 5), with only a slight tendency to overestimate.
 * - Reps in reserve count as reps you could have done: 8 reps with 2 in reserve is estimated
 *   as 10, while the total stays within the cap.
 * - No more than 10 reps: Reynolds et al. concluded "no more than 10 repetitions should be used
 *   in linear equations". Sets above the cap are not estimated.
 * - A single rep with nothing in reserve returns the load itself.
 *
 * This is an estimate, never an actual maximum.
 */
export const E1RM_MAX_REPS = 10;
/** Progress charts prefer the best set in this rep range when the session has one. */
export const E1RM_PREFERRED_MAX_REPS = 6;

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
