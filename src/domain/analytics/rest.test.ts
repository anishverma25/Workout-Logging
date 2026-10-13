import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import type { WorkoutSet } from '@/domain/models/schemas';
import type { Session } from './sessions';
import { formatRest, restAnalysis, restIntervals, workoutRest } from './rest';

const T0 = Date.parse('2026-10-01T10:00:00Z');
let n = 0;
function set(
  we: string,
  doneAtSec: number | null,
  reps = 8,
  w = 100,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet {
  n++;
  return {
    id: `s${n}`,
    workoutId: 'w',
    workoutExerciseId: we,
    exerciseId: we,
    order: n,
    setType: 'working',
    weightKg: w,
    reps,
    rir: null,
    rpe: null,
    durationSec: null,
    distanceM: null,
    completedAt: doneAtSec === null ? null : new Date(T0 + doneAtSec * 1000).toISOString(),
    notes: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    origin: 'user',
    ...extra,
  } as WorkoutSet;
}

describe('rest between sets', () => {
  it('takes the time to do the next set out of the gap', () => {
    const a = set('bench', 0);
    const b = set('bench', 150); // 150 s later, 8 reps take about 24 s
    const c = set('row', 330, 10); // 180 s later, 10 reps take 30 s
    const r = restIntervals([a, b, c]);
    expect(r.get(b.id)).toMatchObject({ kind: 'set', seconds: 126 });
    expect(r.get(c.id)).toMatchObject({ kind: 'exercise', seconds: 150 });
  });

  it('leaves out sets ticked off together and long pauses', () => {
    const a = set('bench', 0);
    const b = set('bench', 2);
    const c = set('bench', 2 + 20 * 60);
    const d = set('bench', null);
    expect(restIntervals([a, b, c, d]).size).toBe(0);
    // An import: every set has the same time.
    expect(workoutRest([set('x', 0), set('x', 0), set('x', 0)]).timedShare).toBe(0);
  });

  it('uses the logged duration for timed sets', () => {
    const a = set('plank', 0, 0, 0, { reps: null, durationSec: 60 });
    const b = set('plank', 150, 0, 0, { reps: null, durationSec: 60 });
    expect(restIntervals([a, b]).get(b.id)!.seconds).toBe(90);
  });

  it('summarises a workout', () => {
    const sets = [set('a', 0), set('a', 114), set('a', 238), set('b', 400), set('b', 500)];
    const r = workoutRest(sets);
    expect(r.betweenSets).toEqual({ median: 90, count: 3 });
    expect(r.betweenExercises).toEqual({ median: 138, count: 1 });
    expect(r.timedShare).toBe(1);
  });

  it('formats rest', () => {
    expect(formatRest(45)).toBe('45 s');
    expect(formatRest(125)).toBe('2:05');
  });
});

describe('rest analysis', () => {
  const bench = SYSTEM_EXERCISES.find((e) => e.id === exerciseIdFor('barbell-bench-press'))!;
  const curl = SYSTEM_EXERCISES.find((e) => e.id === exerciseIdFor('dumbbell-curl'))!;
  /** A session where each pair of bench sets is separated by `rest` s and keeps `next` reps. */
  const session = (day: number, rest: number, next: number): Session => {
    const first = set('bench', 0, 8);
    const second = set('bench', rest + 8 * 3, next);
    const c1 = set('curl', rest + 400, 12, 15);
    const c2 = set('curl', rest + 400 + 45 + 36, 12, 16);
    return {
      workout: {} as Session['workout'],
      date: new Date(2026, 8, day),
      exercises: [
        { workoutExercise: {} as never, exercise: bench, sets: [first, second] },
        { workoutExercise: {} as never, exercise: curl, sets: [c1, c2] },
      ],
    };
  };

  it('compares how many reps you keep after short and long rests', () => {
    const sessions = [
      ...Array.from({ length: 10 }, (_, i) => session(i + 1, 70, 6)),
      ...Array.from({ length: 10 }, (_, i) => session(i + 11, 180, 8)),
    ];
    const a = restAnalysis(sessions, new Date(2026, 8, 1), new Date(2026, 9, 1));
    expect(a.bands[0]).toMatchObject({ pairs: 10, kept: 0.75 });
    expect(a.bands[2]).toMatchObject({ pairs: 10, kept: 1 });
    expect(a.personal!.band.from).toBe(150);
    expect(a.compound.median).toBe(128);
    expect(a.isolation.median).toBe(45);
    expect(a.verdicts).toEqual(['isolation_short']);
  });

  it('flags short rests on compound lifts', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(i + 1, 60, 6));
    const a = restAnalysis(sessions, new Date(2026, 8, 1), new Date(2026, 9, 1));
    expect(a.verdicts).toContain('compound_short');
    expect(a.personal).toBeNull();
  });
});
