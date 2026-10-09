/**
 * How long to rest after a set (Evidence Corner, metric 7: rest over 60 seconds helps growth a
 * little, with no further gain past about 90 seconds; Singer et al. 2024).
 *
 * - Warm-up sets: at most a minute.
 * - The last set of an exercise, when another exercise still has sets to do: the "rest
 *   between exercises" setting, if it is on.
 * - Otherwise the exercise's own rest, or the default.
 */
export function restSecondsAfterSet(input: {
  plannedSec: number | null;
  defaultSec: number;
  warmup: boolean;
  /** No sets of this exercise left after this one. */
  lastOfExercise: boolean;
  /** Another exercise still has sets left. */
  moreToCome: boolean;
  /** Rest between exercises, or null when off. */
  changeSec: number | null;
}): number {
  const planned = input.plannedSec ?? input.defaultSec;
  if (input.warmup) return Math.min(60, planned);
  if (input.lastOfExercise && input.moreToCome && input.changeSec !== null) return input.changeSec;
  return planned;
}
