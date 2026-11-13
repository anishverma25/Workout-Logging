import type { HeaderArtKind } from './HeaderArt';

/** Each guide's picture and the line written on it. */
export const GUIDE_ART: Record<string, { kind: HeaderArtKind; caption: string }> = {
  '/indian-food-calorie-counter': { kind: 'food', caption: '2 rotis + 1 katori dal = 343 kcal' },
  '/workout-tracker': { kind: 'workout', caption: 'Beat last time, one set at a time' },
  '/gym-leaderboard': { kind: 'leaderboard', caption: 'Points for effort, not ego' },
};
