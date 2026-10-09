import { exerciseIdFor } from './exercises';
import { MUSCLE_SHARES, SHARE_SOURCES, type ExerciseShares } from './muscleShares';

const byId = new Map(Object.entries(MUSCLE_SHARES).map(([key, s]) => [exerciseIdFor(key), s]));

/** Research-based muscle breakdown of a library exercise, or null (custom exercises, cardio). */
export const sharesFor = (exerciseId: string): ExerciseShares | null =>
  byId.get(exerciseId) ?? null;

export const shareSource = (id: string) => SHARE_SOURCES[id] ?? null;

/** "Upper chest 40% · Front delts 25%": the top regions, for lists. */
export function sharesSummary(shares: ExerciseShares, top = 2): string {
  return shares.regions
    .slice(0, top)
    .map((r) => `${r.region} ${r.share}%`)
    .join(' · ');
}
