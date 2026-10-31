import { generateDemoDataset } from '@/data/demo/generate';
import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import { BENCH, buildData } from '@/test/fixtures';
import type { BodyWeightEntry } from '../models/schemas';
import { estimateOneRepMax } from './e1rm';
import {
  bodyWeightAt,
  bucketFor,
  buildProgress,
  exerciseOptions,
  joinList,
  periodsFor,
  progressWindow,
  type ProgressOptions,
} from './progress';
import { buildSessions, isWorkingSet, type TrainingData } from './sessions';
import { setVolumeLoad } from './volume';

const NOW = new Date(2026, 9, 5, 18, 0); // Monday 5 Oct 2026, local time
const opts = (over: Partial<ProgressOptions> = {}): ProgressOptions => ({
  range: '30d',
  exerciseId: null,
  now: NOW,
  weekStartsOn: 1,
  unit: 'kg',
  ...over,
});
const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).toISOString();

const weigh = (iso: string, kg: number): BodyWeightEntry => ({
  id: `44444444-4444-4444-8444-${String(Date.parse(iso)).slice(-12).padStart(12, '0')}`,
  createdAt: iso,
  updatedAt: iso,
  deletedAt: null,
  origin: 'user',
  measuredAt: iso,
  weightKg: kg,
  enteredUnit: 'kg',
  note: null,
});

describe('windows and periods', () => {
  it('covers the last N days including today, with today as the end', () => {
    const w = progressWindow('7d', NOW, null);
    expect(w.days).toBe(7);
    expect(w.start).toEqual(new Date(2026, 8, 29));
    expect(w.end).toEqual(new Date(2026, 9, 6));
  });

  it('starts "all time" at the first workout', () => {
    const w = progressWindow('all', NOW, new Date(2026, 8, 1, 7));
    expect(w.start).toEqual(new Date(2026, 8, 1));
    expect(w.days).toBe(35);
  });

  it('buckets by day for 7 days, weeks for 30 and 90, months for long histories', () => {
    expect(bucketFor('7d', progressWindow('7d', NOW, null))).toBe('day');
    expect(bucketFor('90d', progressWindow('90d', NOW, null))).toBe('week');
    expect(bucketFor('all', progressWindow('all', NOW, new Date(2025, 0, 1)))).toBe('month');
    expect(bucketFor('all', progressWindow('all', NOW, new Date(2026, 6, 1)))).toBe('week');
  });

  it('makes contiguous periods that cover the window and marks the current one', () => {
    const w = progressWindow('30d', NOW, null);
    const ps = periodsFor(w, 'week', 1, NOW);
    expect(ps[0]!.start <= w.start).toBe(true);
    expect(ps[ps.length - 1]!.end >= w.end).toBe(true);
    for (let i = 1; i < ps.length; i++) expect(ps[i]!.start).toEqual(ps[i - 1]!.end);
    expect(ps.filter((p) => p.current)).toHaveLength(1);
    expect(ps.every((p) => p.start.getDay() === 1)).toBe(true);
    expect(periodsFor(progressWindow('7d', NOW, null), 'day', 1, NOW)).toHaveLength(7);
  });
});

describe('progress model', () => {
  const data = buildData([
    // Outside the 30-day window: sets the baseline record.
    { at: at(2026, 8, 20), exercises: [{ key: 'barbell-bench-press', sets: [{ w: 75, r: 8 }] }] },
    // Exactly on the first day of the window (5 Sep is 30 days before 5 Oct, inclusive window starts 6 Sep).
    {
      at: at(2026, 9, 5, 23),
      exercises: [{ key: 'barbell-bench-press', sets: [{ w: 99, r: 1 }] }],
    },
    {
      at: at(2026, 9, 6, 7),
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 80, r: 8 },
            { w: 80, r: 7 },
          ],
        },
      ],
    },
    {
      at: at(2026, 9, 20),
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 40, r: 10, type: 'warmup' },
            { w: 82.5, r: 8 },
            { w: 60, r: 20 },
            { w: 90, r: 1, done: false },
          ],
        },
        { key: 'pull-up', sets: [{ w: null, r: 10 }] },
      ],
    },
    { at: at(2026, 10, 5, 7), exercises: [{ key: 'back-squat', sets: [{ w: 100, r: 5 }] }] },
  ]);
  data.bodyWeights = [weigh(at(2026, 9, 1, 7), 70), weigh(at(2026, 9, 25, 7), 72)];
  const model = buildProgress(data, opts());

  it('includes sessions on the window boundaries correctly', () => {
    // 5 Sep 23:00 is outside, 6 Sep 07:00 inside, today inside.
    expect(model.sessionsInWindow).toBe(3);
  });

  it('computes volume only from completed non-warm-up sets of load-tracked exercises', () => {
    expect(model.volume.totalKg).toBe(80 * 8 + 80 * 7 + 82.5 * 8 + 60 * 20 + 100 * 5);
    expect(model.volume.periods.reduce((s, p) => s + p.volumeKg, 0)).toBe(model.volume.totalKg);
    // History starts 20 Aug, after the previous window began (7 Aug): no comparison.
    expect(model.volume.previousTotalKg).toBeNull();
    expect(model.insights.some((i) => i.id === 'volume-change')).toBe(false);
    const seven = buildProgress(data, opts({ range: '7d' }));
    // Previous 7 days (22 to 28 Sep) are fully covered: compared, even though they hold no sets.
    expect(seven.volume.previousTotalKg).toBe(0);
    expect(model.volume.byExercise[0]).toMatchObject({ id: BENCH, workingSets: 4 });
  });

  it('builds strength points with e1RM that ignores high-rep and unfinished sets', () => {
    const s = model.selected!;
    expect(s.exerciseId).toBe(BENCH);
    expect(s.points).toHaveLength(2);
    // 60 x 20 is past the rep cap, 90 x 1 was not completed: best is 82.5 x 8.
    expect(s.points[1]!.bestE1rm).toBeCloseTo(estimateOneRepMax(82.5, 8)!, 9);
    expect(s.points[1]!.topLoad).toBe(82.5);
    expect(s.points[1]!.topLoadReps).toBe(8);
    expect(s.e1rmChange!.fraction).toBeCloseTo(
      estimateOneRepMax(82.5, 8)! / estimateOneRepMax(80, 8)! - 1,
      9,
    );
    // The running best includes history before the window: 99 x 1 (99) is beaten by 80 x 8 (101.3).
    expect(s.points[0]!.runningBestE1rm).toBeCloseTo(estimateOneRepMax(80, 8)!, 9);
    expect(s.points[1]!.runningBestE1rm).toBeCloseTo(estimateOneRepMax(82.5, 8)!, 9);
  });

  it('relative strength divides the latest e1RM by body weight on that day', () => {
    const r = model.selected!.relativeStrength!;
    expect(r.bodyKg).toBe(70); // 20 Sep uses the 1 Sep weigh-in, not the later one
    expect(r.ratio).toBeCloseTo(estimateOneRepMax(82.5, 8)! / 70, 9);
  });

  it('counts frequency only over days since the first workout', () => {
    expect(model.consistency.total).toBe(3);
    expect(model.consistency.perWeek).toBeCloseTo(3 / (30 / 7), 9);
    const fresh = buildProgress(
      buildData([
        { at: at(2026, 10, 3), exercises: [{ key: 'back-squat', sets: [{ w: 100, r: 5 }] }] },
      ]),
      opts({ range: '90d' }),
    );
    // Three days of history is too little for a weekly rate.
    expect(fresh.consistency.perWeek).toBeNull();
  });

  it('lists records within the window only', () => {
    expect(model.records.every((r) => new Date(r.date) >= model.window.start)).toBe(true);
    // Both bench sessions in the window beat the previous best estimate.
    expect(model.records.filter((r) => r.exerciseId === BENCH && r.type === 'e1rm')).toHaveLength(
      2,
    );
    // 82.5 kg beats the 80 kg in the window but not the 99 kg from before it, so no load record.
    expect(model.records.some((r) => r.type === 'load')).toBe(false);
  });

  it('honours an exercise filter and falls back when it is not in range', () => {
    const squat = exerciseIdFor('back-squat');
    expect(buildProgress(data, opts({ exerciseId: squat })).selected?.exerciseId).toBe(squat);
    expect(
      buildProgress(data, opts({ exerciseId: exerciseIdFor('deadlift') })).selected?.exerciseId,
    ).toBe(BENCH);
  });

  it('never offers bodyweight exercises for the strength chart', () => {
    expect(model.exerciseOptions.map((o) => o.id)).not.toContain(exerciseIdFor('pull-up'));
  });
});

describe('empty and missing data', () => {
  const empty: TrainingData = { ...buildData([]), bodyWeights: [] };

  it('returns an honest empty model', () => {
    const m = buildProgress(empty, opts({ range: 'all' }));
    expect(m.hasAnyData).toBe(false);
    expect(m.sessionsInWindow).toBe(0);
    expect(m.selected).toBeNull();
    expect(m.volume.totalKg).toBe(0);
    expect(m.consistency.perWeek).toBeNull();
    expect(m.consistency.adherence.rate).toBeNull();
    expect(m.body.points).toEqual([]);
    expect(m.body.trend).toBeNull();
    expect(m.insights).toEqual([]);
  });

  it('has no relative strength without any weigh-in', () => {
    const d = buildData([
      { at: at(2026, 10, 1), exercises: [{ key: 'barbell-bench-press', sets: [{ w: 80, r: 5 }] }] },
    ]);
    expect(buildProgress(d, opts()).selected?.relativeStrength).toBeNull();
  });

  it('has no e1RM change with a single session', () => {
    const d = buildData([
      { at: at(2026, 10, 1), exercises: [{ key: 'barbell-bench-press', sets: [{ w: 80, r: 5 }] }] },
    ]);
    expect(buildProgress(d, opts()).selected?.e1rmChange).toBeNull();
  });
});

describe('body weight lookup', () => {
  const entries = [weigh(at(2026, 9, 10, 7), 66), weigh(at(2026, 9, 20, 7), 67)];
  it('uses the latest weigh-in on or before the day, else one within a week after', () => {
    expect(bodyWeightAt(entries, new Date(2026, 8, 20, 20))).toBe(67);
    expect(bodyWeightAt(entries, new Date(2026, 8, 15))).toBe(66);
    expect(bodyWeightAt(entries, new Date(2026, 8, 5))).toBe(66);
    expect(bodyWeightAt(entries, new Date(2026, 7, 1))).toBeNull();
    expect(
      bodyWeightAt([{ ...entries[0]!, deletedAt: at(2026, 9, 11) }], new Date(2026, 8, 15)),
    ).toBeNull();
  });
});

describe('demo data, cross-checked against the raw sets', () => {
  const d = generateDemoDataset(NOW);
  const data: TrainingData = { exercises: SYSTEM_EXERCISES, ...d };
  const m = buildProgress(data, opts({ range: '7d' }));
  const byId = new Map(SYSTEM_EXERCISES.map((e) => [e.id, e]));

  it('populates the 7-day view', () => {
    expect(m.sessionsInWindow).toBeGreaterThanOrEqual(4);
    expect(m.selected?.points.length).toBeGreaterThanOrEqual(1);
    expect(m.volume.totalKg).toBeGreaterThan(0);
    expect(m.muscles.workload.filter((w) => w.direct > 0).length).toBeGreaterThanOrEqual(8);
    expect(m.body.points.length).toBeGreaterThanOrEqual(4);
    expect(m.records.length).toBeGreaterThan(0);
    expect(m.consistency.adherence.planned).toBeGreaterThan(0);
  });

  it('has volume equal to an independent recount of every logged set in the window', () => {
    const ids = new Set(
      d.workouts
        .filter((w) => w.status === 'completed' && new Date(w.startedAt) >= m.window.start)
        .map((w) => w.id),
    );
    const recount = d.sets
      .filter((s) => ids.has(s.workoutId) && s.deletedAt === null)
      .reduce((sum, s) => sum + setVolumeLoad(s, byId.get(s.exerciseId)), 0);
    expect(m.volume.totalKg).toBeCloseTo(recount, 6);
  });

  it('has muscle set counts equal to a recount of working sets', () => {
    const ids = new Set(
      buildSessions(data)
        .filter((s) => s.date >= m.window.start)
        .map((s) => s.workout.id),
    );
    const chestSets = d.sets.filter(
      (s) =>
        ids.has(s.workoutId) &&
        isWorkingSet(s) &&
        byId.get(s.exerciseId)?.primaryMuscle === 'chest',
    ).length;
    expect(m.muscles.workload.find((w) => w.muscle === 'chest')!.direct).toBe(chestSets);
  });

  it('gives every insight a stated basis and no em dashes', () => {
    for (const i of m.insights) {
      expect(i.basis.length).toBeGreaterThan(20);
      expect(i.title + i.basis).not.toMatch(/—/);
    }
  });

  it('does not show every number going up', () => {
    const changes = buildProgress(data, opts({ range: '30d' })).exerciseOptions.map((o) =>
      buildProgress(data, opts({ range: '30d', exerciseId: o.id })).selected!.points.map(
        (p) => p.bestE1rm,
      ),
    );
    const anyDip = changes.some((series) =>
      series.some((v, i) => i > 0 && v !== null && series[i - 1] !== null && v < series[i - 1]!),
    );
    expect(anyDip).toBe(true);
  });
});

describe('helpers', () => {
  it('joins lists in plain English', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['calves'])).toBe('calves');
    expect(joinList(['calves', 'abs'])).toBe('calves and abs');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('ranks exercise options with free-weight compounds first', () => {
    const d = buildData([
      {
        at: at(2026, 10, 1),
        exercises: [
          { key: 'cable-fly', sets: [{ w: 20, r: 12 }] },
          { key: 'leg-press', sets: [{ w: 150, r: 10 }] },
          { key: 'back-squat', sets: [{ w: 100, r: 5 }] },
        ],
      },
    ]);
    expect(exerciseOptions(buildSessions(d), SYSTEM_EXERCISES).map((o) => o.name)).toEqual([
      'Back squat',
      'Leg press',
      'Cable fly',
    ]);
  });
});
