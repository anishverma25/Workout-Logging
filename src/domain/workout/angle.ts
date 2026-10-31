/**
 * Bench angle. Exercises done on an adjustable bench at an incline or a decline can record its
 * angle, because the angle changes which part of the muscle works (a steeper incline moves work
 * toward the upper chest and front delts). Stored as signed degrees: positive incline, negative
 * decline.
 */
export type AngleKind = 'incline' | 'decline';

export const INCLINE_DEGREES = Array.from({ length: 91 }, (_, i) => i); // 0 to 90
export const DECLINE_DEGREES = Array.from({ length: 46 }, (_, i) => i); // 0 to 45
export const DEFAULT_ANGLE: Record<AngleKind, number> = { incline: 30, decline: 15 };

/** Which kind of angle an exercise takes, from its name. Treadmill incline is a grade, not this. */
export function angleKind(
  exercise: { name: string; trackingType?: string } | undefined,
): AngleKind | null {
  if (!exercise || exercise.trackingType === 'cardio') return null;
  if (/\bdecline\b/i.test(exercise.name)) return 'decline';
  if (/\bincline\b/i.test(exercise.name)) return 'incline';
  return null;
}

/** "30° incline", "15° decline", or "flat" at zero. */
export function formatAngle(deg: number): string {
  if (deg === 0) return 'Flat';
  return `${Math.abs(deg)}° ${deg > 0 ? 'incline' : 'decline'}`;
}

/** Signed storage value from the wheel's positive degrees. */
export const signedAngle = (kind: AngleKind, degrees: number) =>
  kind === 'decline' ? -Math.abs(degrees) : Math.abs(degrees);
