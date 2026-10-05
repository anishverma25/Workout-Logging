import { BENCH, buildData, PULL_UP } from '@/test/fixtures';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { detectPersonalRecords, featuredRecord } from './prs';
import { buildSessions } from './sessions';

const bench = (at: string, sets: { w: number; r: number; type?: 'warmup' | 'working' }[]) => ({
  at,
  exercises: [{ key: 'barbell-bench-press', sets }],
});

describe('personal records', () => {
  it('does not treat the first session as a record', () => {
    const data = buildData([bench('2026-09-01T18:00:00Z', [{ w: 80, r: 8 }])]);
    expect(detectPersonalRecords(buildSessions(data), SYSTEM_EXERCISES)).toEqual([]);
  });

  it('detects heavier load and higher e1RM separately', () => {
    const data = buildData([
      bench('2026-09-01T18:00:00Z', [{ w: 80, r: 8 }]),
      bench('2026-09-04T18:00:00Z', [{ w: 82.5, r: 5 }]),
    ]);
    const prs = detectPersonalRecords(buildSessions(data), SYSTEM_EXERCISES);
    // 82.5 x 5 = 96.25 e1RM is below 80 x 8 = 101.33, so only the load is a record
    expect(prs.map((p) => p.type)).toEqual(['load']);
    expect(prs[0]).toMatchObject({ exerciseId: BENCH, value: 82.5, previousBest: 80 });
  });

  it('detects an e1RM record from more reps at the same load', () => {
    const data = buildData([
      bench('2026-09-01T18:00:00Z', [{ w: 80, r: 8 }]),
      bench('2026-09-04T18:00:00Z', [{ w: 80, r: 9 }]),
    ]);
    const [pr] = detectPersonalRecords(buildSessions(data), SYSTEM_EXERCISES);
    expect(pr?.type).toBe('e1rm');
    expect(pr?.value).toBeCloseTo(104, 5);
  });

  it('ignores warm-up sets and equal performances', () => {
    const data = buildData([
      bench('2026-09-01T18:00:00Z', [{ w: 80, r: 8 }]),
      bench('2026-09-04T18:00:00Z', [
        { w: 100, r: 1, type: 'warmup' },
        { w: 80, r: 8 },
      ]),
    ]);
    expect(detectPersonalRecords(buildSessions(data), SYSTEM_EXERCISES)).toEqual([]);
  });

  it('tracks most reps for bodyweight exercises', () => {
    const data = buildData([
      { at: '2026-09-01T18:00:00Z', exercises: [{ key: 'pull-up', sets: [{ w: null, r: 8 }] }] },
      { at: '2026-09-04T18:00:00Z', exercises: [{ key: 'pull-up', sets: [{ w: null, r: 10 }] }] },
    ]);
    const [pr] = detectPersonalRecords(buildSessions(data), SYSTEM_EXERCISES);
    expect(pr).toMatchObject({ type: 'reps', exerciseId: PULL_UP, value: 10, previousBest: 8 });
  });

  it('recomputes when a past set is removed', () => {
    const data = buildData([
      bench('2026-09-01T18:00:00Z', [{ w: 80, r: 8 }]),
      bench('2026-09-04T18:00:00Z', [{ w: 85, r: 8 }]),
    ]);
    expect(detectPersonalRecords(buildSessions(data), SYSTEM_EXERCISES).length).toBe(2);
    const edited = {
      ...data,
      sets: data.sets.map((s) =>
        s.weightKg === 85 ? { ...s, deletedAt: '2026-09-05T00:00:00Z' } : s,
      ),
    };
    expect(detectPersonalRecords(buildSessions(edited), SYSTEM_EXERCISES)).toEqual([]);
  });

  it('features actual load over an estimate from the same session', () => {
    const data = buildData([
      bench('2026-09-01T18:00:00Z', [{ w: 80, r: 8 }]),
      bench('2026-09-04T18:00:00Z', [{ w: 85, r: 8 }]),
    ]);
    expect(featuredRecord(detectPersonalRecords(buildSessions(data), SYSTEM_EXERCISES))?.type).toBe(
      'load',
    );
  });
});
