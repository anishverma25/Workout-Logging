import { SYSTEM_EXERCISES, SYSTEM_EXERCISE_KEYS, exerciseIdFor } from './exercises';
import { MUSCLE_SHARES, SHARE_SOURCES } from './muscleShares';
import { sharesFor, sharesSummary } from './shares';

describe('muscle shares', () => {
  it('belong to real library exercises, add up to 100 and cite real sources', () => {
    for (const [key, s] of Object.entries(MUSCLE_SHARES)) {
      expect(SYSTEM_EXERCISE_KEYS, key).toContain(key);
      expect(
        s.regions.reduce((a, r) => a + r.share, 0),
        key,
      ).toBe(100);
      expect(
        s.regions.every((r) => r.share > 0 && r.share % 5 === 0),
        key,
      ).toBe(true);
      expect(s.sources.length, key).toBeGreaterThan(0);
      for (const id of s.sources) expect(SHARE_SOURCES[id], `${key}: ${id}`).toBeDefined();
    }
  });

  it('cover the strength exercises of the library', () => {
    const covered = SYSTEM_EXERCISES.filter((e) => e.trackingType !== 'cardio' && sharesFor(e.id));
    const strength = SYSTEM_EXERCISES.filter((e) => e.trackingType !== 'cardio');
    expect(covered.length / strength.length).toBeGreaterThan(0.9);
  });

  it('summarise the top regions for lists', () => {
    const s = sharesFor(exerciseIdFor('incline-dumbbell-press'))!;
    expect(sharesSummary(s)).toMatch(/^\D+ \d+% · \D+ \d+%$/);
  });
});
