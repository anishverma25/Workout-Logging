/**
 * Haptics through the Vibration API, where it exists (Android browsers; iOS ignores it).
 * Light for value changes, medium for a logged set and the end of rest (D12), success only for
 * a finished workout and a new record.
 */
const PATTERNS = {
  light: 8,
  medium: 20,
  success: [14, 70, 28],
} as const;

export type Haptic = keyof typeof PATTERNS;

export function haptic(kind: Haptic): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[kind] as VibratePattern);
  } catch {
    // Some browsers throw when vibration is blocked; it is only ever a nicety.
  }
}
