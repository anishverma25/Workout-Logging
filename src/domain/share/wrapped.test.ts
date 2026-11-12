import { buildData } from '@/test/fixtures';
import { describe, expect, it } from 'vitest';
import { wrapped, wrappedDue, wrappedStory } from './wrapped';

const specs = [2, 5, 9, 12, 16, 19, 23, 26].map((d, i) => ({
  at: new Date(2026, 9, d, 18).toISOString(),
  name: 'Push',
  minutes: 60,
  exercises: [
    { key: 'barbell-bench-press', sets: [{ w: 80 + i * 2.5, r: 5, rir: 2 }, { w: 80 + i * 2.5, r: 5, rir: 1 }] },
    { key: 'back-squat', sets: [{ w: 100, r: 5, rir: 2 }] },
  ],
}));
const data = buildData([...specs, { at: new Date(2026, 10, 3, 18).toISOString(), name: 'Push', minutes: 45, exercises: [{ key: 'back-squat', sets: [{ w: 100, r: 5, rir: 2 }] }] }]);

describe('Macrotrophy Wrapped', () => {
  it('counts a month from the logs', () => {
    const w = wrapped(data, { year: 2026, month: 9 })!;
    expect(w).toMatchObject({ label: 'October', key: '2026-10', workouts: 8, daysTrained: 8, daysInPeriod: 31, hours: 8, hardSets: 24 });
    // 2 sets of 5 at 80 to 97.5 kg, and 1 set of 5 at 100 kg, per workout.
    expect(w.tonnage).toBe(8 * 500 + 10 * (80 + 82.5 + 85 + 87.5 + 90 + 92.5 + 95 + 97.5));
    expect(w.topExercise).toEqual({ name: 'barbell-bench-press', sets: 16 });
    expect(w.muscles[0]).toEqual({ muscle: 'chest', sets: 16 });
    expect(w.records).toBeGreaterThan(0);
  });

  it('has nothing to say about a month with almost no training', () => {
    expect(wrapped(data, { year: 2026, month: 10 })).toBeNull();
    expect(wrapped(data, { year: 2026, month: 3 })).toBeNull();
  });

  it('a year adds its months up', () => {
    expect(wrapped(data, { year: 2026, month: null })).toMatchObject({ label: '2026', period: 'year', workouts: 9, daysInPeriod: 365 });
  });

  it('is due for last month, and for the year around its end', () => {
    expect(wrappedDue(new Date(2026, 10, 1))).toEqual({ month: { year: 2026, month: 9 }, year: null });
    expect(wrappedDue(new Date(2027, 0, 3))).toEqual({ month: { year: 2026, month: 11 }, year: 2026 });
    expect(wrappedDue(new Date(2026, 11, 25)).year).toBe(2026);
  });

  it('becomes a story card with real rings', () => {
    const s = wrappedStory(wrapped(data, { year: 2026, month: 9 })!, new Date(2026, 10, 1));
    expect(s).toMatchObject({ kind: 'wrapped', title: 'October, wrapped', big: { v: '8', u: 'workouts' } });
    expect(s.rings[0]).toEqual({ frac: 8 / 31, stat: { v: '8', u: '/31', l: 'Days trained' } });
    expect(s.extra).toMatchObject({ type: 'bars', items: [{ l: 'Chest', v: 1, label: '16 sets' }, { l: 'Quads' }] });
  });
});
