import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { BENCH, buildData } from '@/test/fixtures';
import {
  filterHistory,
  groupByWeek,
  historyEntries,
  historyFilterOptions,
  NO_HISTORY_FILTERS,
} from './history';

const data = buildData([
  {
    at: '2026-09-21T18:00:00Z', // Monday
    name: 'Push',
    exercises: [{ key: 'barbell-bench-press', sets: [{ w: 80, r: 8 }] }],
  },
  {
    at: '2026-09-23T18:00:00Z',
    name: 'Legs',
    exercises: [
      { key: 'back-squat', sets: [{ w: 100, r: 5 }] },
      { key: 'leg-press', sets: [{ w: 150, r: 10 }] },
    ],
  },
  {
    at: '2026-09-29T18:00:00Z', // next week
    name: 'Push',
    exercises: [
      { key: 'barbell-bench-press', sets: [{ w: 82.5, r: 8 }] },
      { key: 'cable-fly', sets: [{ w: 20, r: 12, done: false }] },
    ],
  },
]);
const NOW = new Date('2026-10-02T12:00:00Z');

describe('history', () => {
  const entries = historyEntries(data);

  it('lists finished workouts newest first with sets, volume and records', () => {
    expect(entries.map((e) => e.session.workout.name)).toEqual(['Push', 'Legs', 'Push']);
    expect(entries[0]!.workingSets).toBe(1);
    expect(entries[0]!.volumeKg).toBe(82.5 * 8);
    expect(entries[0]!.prExercises).toBe(1);
    // An exercise with no completed sets is not listed.
    expect(entries[0]!.exerciseNames).toEqual(['barbell-bench-press']);
  });

  it('highlights a record first, otherwise the best compound top set', () => {
    expect(entries[0]!.highlight.kind).toBe('pr');
    if (entries[0]!.highlight.kind === 'pr') expect(entries[0]!.highlight.record.type).toBe('load');
    expect(entries[1]!.highlight).toMatchObject({
      kind: 'top_set',
      exerciseName: 'back-squat',
      weightKg: 100,
      reps: 5,
    });
  });

  it('filters by date range, workout, exercise and muscle (primary or secondary)', () => {
    const f = (over: Partial<typeof NO_HISTORY_FILTERS>) =>
      filterHistory(entries, { ...NO_HISTORY_FILTERS, ...over }, SYSTEM_EXERCISES, NOW).map((e) =>
        e.session.workout.startedAt.slice(0, 10),
      );
    expect(f({ range: '7d' })).toEqual(['2026-09-29']);
    expect(f({ workoutName: 'Push' })).toEqual(['2026-09-29', '2026-09-21']);
    expect(f({ exerciseId: BENCH, range: '30d' })).toEqual(['2026-09-29', '2026-09-21']);
    expect(f({ muscle: 'glutes' })).toEqual(['2026-09-23']);
    expect(f({ muscle: 'triceps' })).toEqual(['2026-09-29', '2026-09-21']); // bench, secondary
    expect(f({ muscle: 'biceps' })).toEqual([]);
  });

  it('offers only filters that exist in the history', () => {
    const o = historyFilterOptions(entries);
    expect(o.workoutNames).toEqual([
      { name: 'Push', count: 2 },
      { name: 'Legs', count: 1 },
    ]);
    expect(o.exercises.map((e) => e.name)).toEqual([
      'barbell-bench-press',
      'back-squat',
      'leg-press',
    ]);
  });

  it('features the record on the main lift over an accessory record', () => {
    const d = buildData([
      {
        at: '2026-09-01T18:00:00Z',
        exercises: [
          { key: 'barbell-bench-press', sets: [{ w: 80, r: 8 }] },
          { key: 'triceps-rope-pushdown', sets: [{ w: 30, r: 12 }] },
        ],
      },
      {
        at: '2026-09-04T18:00:00Z',
        exercises: [
          { key: 'barbell-bench-press', sets: [{ w: 80, r: 9 }] },
          { key: 'triceps-rope-pushdown', sets: [{ w: 32.5, r: 12 }] },
        ],
      },
    ]);
    const [latest] = historyEntries(d);
    expect(latest!.highlight.kind === 'pr' && latest!.highlight.record.exerciseId).toBe(BENCH);
  });

  it('groups by calendar week with totals', () => {
    const weeks = groupByWeek(entries, 1);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.entries).toHaveLength(1);
    expect(weeks[1]!.entries).toHaveLength(2);
    expect(weeks[1]!.volumeKg).toBe(80 * 8 + 100 * 5 + 150 * 10);
  });
});
