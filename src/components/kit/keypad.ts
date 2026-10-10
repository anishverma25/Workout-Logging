/**
 * Keypad entry for times: digits read like a microwave. "45" is 0:45, "230" is 2:30, "1000"
 * is 10:00. A colon is accepted too ("2:30"). Seconds of 60 or more roll into minutes ("90" is
 * 1:30). Returns null for anything that is not a time, then the caller clamps to its range.
 */
export function parseDurationDigits(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  if (!/^\d{1,4}$/.test(t)) return null;
  if (t.length <= 2) return Number(t);
  const minutes = Number(t.slice(0, -2));
  const seconds = Number(t.slice(-2));
  return minutes * 60 + seconds;
}

/** Whole degrees typed on a keypad; null for anything else. */
export function parseWholeNumber(text: string): number | null {
  const t = text.trim();
  return /^\d{1,3}$/.test(t) ? Number(t) : null;
}

export const clampTo = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Rest presets (UI Part 6): 4 by 2 chips. */
export const REST_PRESETS_SEC = [45, 60, 90, 120, 150, 180, 240, 300];
