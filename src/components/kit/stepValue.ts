/**
 * One stepper step: adds `delta`, snaps to the step grid and clamps, so repeated presses never
 * drift (0.1 + 0.2) and never pass a limit.
 */
export function stepValue(
  value: number,
  delta: number,
  min: number,
  max: number,
  step: number,
): number {
  const next = Math.round((value + delta) / step) * step;
  return Math.max(min, Math.min(max, Number(next.toFixed(6))));
}
