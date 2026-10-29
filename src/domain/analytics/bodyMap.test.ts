import { describe, expect, it } from 'vitest';
import { MUSCLE_SHARES } from '@/data/library/muscleShares';
import { sharesFor } from '@/data/library/shares';
import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import { areasWorked, setsPerArea, shadeLevels } from './bodyMap';

const set = (setType: 'working' | 'warmup' = 'working', done = true) => ({
  completedAt: done ? '2026-10-29T10:00:00.000Z' : null,
  setType,
  deletedAt: null,
});
const ex = (key: string) => SYSTEM_EXERCISES.find((e) => e.id === exerciseIdFor(key))!;

describe('the muscle map', () => {
  it('spreads each set over the muscles by its research shares; warm-ups do not count', () => {
    const sets = setsPerArea(
      [
        {
          exerciseId: exerciseIdFor('barbell-bench-press'),
          exercise: ex('barbell-bench-press'),
          sets: [set('warmup'), set(), set(), set(), set('working', false)],
        },
      ],
      sharesFor,
    );
    const shares = sharesFor(exerciseIdFor('barbell-bench-press'))!;
    const chest = shares.regions
      .filter((r) => /chest/i.test(r.region))
      .reduce((t, r) => t + (3 * r.share) / 100, 0);
    expect(sets.get('chest')).toBeCloseTo(chest, 5);
    expect([...sets.values()].reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3 + 1e-9);
    expect(shadeLevels(sets).get('chest')).toBe(3);
  });

  it('an exercise of your own: one set to its main muscle, half to the others', () => {
    const sets = setsPerArea(
      [
        {
          exerciseId: 'custom-1',
          exercise: {
            primaryMuscle: 'back',
            secondaryMuscles: ['biceps'],
            trackingType: 'weight_reps',
          },
          sets: [set(), set()],
        },
      ],
      () => null,
    );
    expect(sets.get('upper-back')).toBe(2);
    expect(sets.get('biceps')).toBe(1);
  });

  it('cardio paints nothing, and slivers under half a set stay unshaded', () => {
    const sets = setsPerArea(
      [
        {
          exerciseId: exerciseIdFor('treadmill-run'),
          exercise: ex('treadmill-run'),
          sets: [set()],
        },
      ],
      sharesFor,
    );
    expect(sets.size).toBe(0);
    const levels = shadeLevels(
      new Map([
        ['chest', 6],
        ['triceps', 3],
        ['abs', 0.25],
      ]),
    );
    expect(levels.get('chest')).toBe(3);
    expect(levels.get('triceps')).toBe(2);
    expect(levels.has('abs')).toBe(false);
    expect(
      areasWorked(
        new Map([
          ['chest', 2.6],
          ['abs', 0.2],
        ]),
      ),
    ).toEqual([{ area: 'chest', sets: 2.5 }]);
  });

  it('every region of the muscle shares has a place on the drawing or is left off on purpose', () => {
    const offMap = new Set(['Hip flexors', 'Serratus']);
    const regions = new Set(
      Object.values(MUSCLE_SHARES).flatMap((s) => s.regions.map((r) => r.region)),
    );
    for (const region of regions) {
      if (offMap.has(region)) continue;
      const sets = setsPerArea(
        [
          {
            exerciseId: 'x',
            exercise: { primaryMuscle: 'chest', secondaryMuscles: [], trackingType: 'weight_reps' },
            sets: [set()],
          },
        ],
        () => ({ regions: [{ region, share: 100 }] }),
      );
      expect(sets.size, region).toBe(1);
    }
  });
});
