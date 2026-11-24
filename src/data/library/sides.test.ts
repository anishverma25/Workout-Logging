import { exerciseIdFor, SYSTEM_EXERCISES, EACH_SIDE_SINCE } from './exercises';
import { logsBySide } from './sides';
import { sideLoadHands, setVolumeLoad } from '@/domain/analytics/volume';
import type { WorkoutSet } from '@/domain/models/schemas';

const ex = (key: string) => SYSTEM_EXERCISES.find((e) => e.id === exerciseIdFor(key))!;
const done = (s: Partial<WorkoutSet>) =>
  ({
    completedAt: '2026-11-25T10:00:00.000Z',
    deletedAt: null,
    repsLeft: null,
    repsRight: null,
    ...s,
  }) as WorkoutSet;

describe('laterality from the muscle-targeting sheet', () => {
  it('unilateral exercises log each side by default; bilateral and "both" do not', () => {
    expect(logsBySide(null, ex('one-arm-dumbbell-row'), '2026-12-01T00:00:00.000Z')).toBe(true);
    expect(logsBySide(null, ex('bayesian-cable-curl'))).toBe(true);
    expect(logsBySide(null, ex('barbell-bench-press'))).toBe(false);
    // "Both": together by default, the card offers one side at a time.
    expect(logsBySide(null, ex('dumbbell-curl'))).toBe(false);
    expect(logsBySide(true, ex('dumbbell-curl'))).toBe(true);
  });

  it('a choice always wins over the default', () => {
    expect(logsBySide(false, ex('bulgarian-split-squat'), '2026-12-01T00:00:00.000Z')).toBe(false);
  });

  it('exercises that became per side keep old workouts as they were logged', () => {
    expect(EACH_SIDE_SINCE.size).toBe(8);
    const row = ex('one-arm-dumbbell-row');
    // Made before the change: both sides together, as logged.
    expect(logsBySide(null, row, '2026-11-01T00:00:00.000Z')).toBe(false);
    // Made after it, but already logged as one number by an older app: stays one number.
    expect(logsBySide(null, row, '2026-11-26T00:00:00.000Z', [done({ reps: 10 })])).toBe(false);
    // New and empty, or logged per side: per side.
    expect(logsBySide(null, row, '2026-11-26T00:00:00.000Z', [])).toBe(true);
    expect(
      logsBySide(null, row, '2026-11-26T00:00:00.000Z', [
        done({ reps: 9, repsLeft: 9, repsRight: 10 }),
      ]),
    ).toBe(true);
    // Exercises that were always per side are unaffected by dates.
    expect(logsBySide(null, ex('single-leg-romanian-deadlift'), '2026-01-01T00:00:00.000Z')).toBe(
      true,
    );
  });

  it('duration and distance exercises are never logged per side', () => {
    expect(logsBySide(true, ex('side-plank'))).toBe(false);
    expect(logsBySide(null, ex('copenhagen-adduction'))).toBe(false);
  });
});

describe('volume with sides', () => {
  const set = (s: Partial<WorkoutSet>) => ({ ...done(s), setType: 'working' }) as WorkoutSet;

  it('one-arm moves count the one dumbbell for each side’s reps, never twice', () => {
    const row = ex('one-arm-dumbbell-row');
    expect(sideLoadHands(row)).toBe(1);
    expect(setVolumeLoad(set({ weightKg: 30, reps: 10, repsLeft: 10, repsRight: 11 }), row)).toBe(
      30 * 21,
    );
    // Logged as one number (both sides): per hand counts both sides.
    expect(setVolumeLoad(set({ weightKg: 30, reps: 10 }), row)).toBe(30 * 10 * 2);
  });

  it('leg moves with a dumbbell in each hand carry both on every rep', () => {
    const bss = ex('bulgarian-split-squat');
    expect(sideLoadHands(bss)).toBe(2);
    expect(setVolumeLoad(set({ weightKg: 20, reps: 8, repsLeft: 8, repsRight: 9 }), bss)).toBe(
      20 * 2 * 17,
    );
  });

  it('unequal sides: reps is the weaker side, volume counts every rep', () => {
    const curl = ex('bayesian-cable-curl');
    expect(setVolumeLoad(set({ weightKg: 10, reps: 8, repsLeft: 8, repsRight: 12 }), curl)).toBe(
      10 * 20,
    );
  });
});
