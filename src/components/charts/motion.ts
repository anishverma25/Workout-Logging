/**
 * Charts, rings and count-ups animate from zero once per session (UI Part 8), then appear at
 * rest. Keys are what the visual shows, so the same chart does not replay on every visit.
 */
const played = new Set<string>();

export function firstPlay(key: string): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (played.has(key)) return false;
  played.add(key);
  return true;
}
