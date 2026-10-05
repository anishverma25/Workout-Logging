/**
 * Estimated one-rep max using the Epley formula:
 *   e1RM = weight x (1 + reps / 30)
 *
 * This is an estimate, never an actual maximum. Accuracy drops as reps rise,
 * so sets above E1RM_MAX_REPS are not estimated. A single rep returns the load itself.
 */
export const E1RM_MAX_REPS = 12;

export function estimateOneRepMax(
  weightKg: number | null,
  reps: number | null,
  maxReps: number = E1RM_MAX_REPS,
): number | null {
  if (weightKg === null || reps === null) return null;
  if (!(weightKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > maxReps) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
