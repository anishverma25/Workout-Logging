import {
  SYSTEM_EXERCISES,
  SYSTEM_EXERCISE_KEYS,
  exerciseIdFor,
  EACH_SIDE_EXERCISE_IDS,
} from './exercises';
import {
  MUSCLE_REGIONS,
  MUSCLE_SHARES,
  regionDetail,
  shareSource,
  sharesFor,
  sharesSummary,
  shortRegion,
} from './shares';

describe('muscle shares (imported from the muscle-targeting sheet)', () => {
  it('belong to real library exercises, add up to 100 in 5% steps and name only regions in the key', () => {
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
      for (const r of s.regions)
        expect(MUSCLE_REGIONS[r.region], `${key}: ${r.region}`).toBeDefined();
      // Biggest share first.
      expect(
        [...s.regions].sort((a, b) => b.share - a.share),
        key,
      ).toEqual(s.regions);
      for (const id of s.sources) expect(shareSource(id), `${key}: ${id}`).not.toBeNull();
      expect(s.note === null || s.note.length > 10, key).toBe(true);
    }
  });

  it('cover every library exercise, and the key has 51 regions in 20 groups', () => {
    expect(Object.keys(MUSCLE_SHARES).sort()).toEqual([...SYSTEM_EXERCISE_KEYS].sort());
    // 50 from the first sheet, plus the thumb and hand muscles for the plate pinch (second).
    expect(Object.keys(MUSCLE_REGIONS)).toHaveLength(51);
    expect(MUSCLE_REGIONS['Thumb adductors & intrinsic hand muscles']).toBe('Forearms');
    expect(new Set(Object.values(MUSCLE_REGIONS)).size).toBe(20);
  });

  it('the second sheet’s one-or-two-arm exercises start on its default mode', () => {
    const oneSide = ['dumbbell-triceps-kickback', 'dumbbell-preacher-curl', 'cable-front-raise'];
    const together = ['cable-wrist-curl', 'reverse-cable-wrist-curl'];
    for (const key of [...oneSide, ...together]) {
      expect(sharesFor(exerciseIdFor(key))!.laterality, key).toBe('both');
      expect(EACH_SIDE_EXERCISE_IDS.has(exerciseIdFor(key)), key).toBe(oneSide.includes(key));
    }
  });

  it('one side at a time by default exactly for the sheet’s unilateral rep exercises', () => {
    for (const e of SYSTEM_EXERCISES) {
      const s = sharesFor(e.id)!;
      const reps = ['weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_bodyweight'];
      if (!reps.includes(e.trackingType)) continue;
      // Exercises done either way ("both") start on the sheet's default mode.
      if (s.laterality === 'both') continue;
      expect(EACH_SIDE_EXERCISE_IDS.has(e.id), e.name).toBe(s.laterality === 'unilateral');
    }
  });

  it('short names for chips, the anatomical part for the full sheet', () => {
    expect(shortRegion('Mid chest (sternal pec)')).toBe('Mid chest');
    expect(regionDetail('Mid chest (sternal pec)')).toBe('sternal pec');
    expect(regionDetail('Lats')).toBeNull();
    const s = sharesFor(exerciseIdFor('barbell-bench-press'))!;
    expect(sharesSummary(s)).toBe('Mid chest 35% · Lower chest 20%');
  });
});
