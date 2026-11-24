import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import { sharesFor } from '@/data/library/shares';
import type { WorkoutSet } from '@/domain/models/schemas';
import type { Session } from './sessions';
import {
  EFFORT_MIN_PAIRS,
  effortCheck,
  fatigueSessions,
  readiness,
  repRangeNote,
  repRanges,
  setFatigue,
  sideBalance,
  wholeShares,
} from './quality';

let n = 0;
function set(reps: number, w = 100, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  n++;
  return {
    id: `s${n}`,
    workoutId: 'w',
    workoutExerciseId: 'we',
    exerciseId: 'e',
    order: n,
    setType: 'working',
    weightKg: w,
    reps,
    rir: 2,
    rpe: null,
    durationSec: null,
    distanceM: null,
    completedAt: '2026-11-01T10:00:00.000Z',
    notes: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    origin: 'user',
    ...extra,
  } as WorkoutSet;
}

const ex = (slug: string) => SYSTEM_EXERCISES.find((e) => e.id === exerciseIdFor(slug))!;
const bench = ex('barbell-bench-press');
const squat = ex('back-squat');

function session(date: Date, items: { e: typeof bench; sets: WorkoutSet[] }[]): Session {
  return {
    workout: {} as Session['workout'],
    date,
    exercises: items.map(({ e, sets }) => ({
      workoutExercise: { exerciseId: e.id, exerciseName: e.name } as never,
      exercise: e,
      sets,
    })),
  };
}

describe('ready to train', () => {
  const now = new Date('2026-11-24T18:00:00Z');
  it('marks muscles by hours since their last hard sets', () => {
    const s = [
      session(new Date('2026-11-23T18:00:00Z'), [{ e: bench, sets: [set(8), set(8), set(8)] }]),
      session(new Date('2026-11-21T06:00:00Z'), [{ e: squat, sets: [set(5), set(5), set(5)] }]),
    ];
    const r = new Map(readiness(s, sharesFor, now).map((a) => [a.area, a]));
    expect(r.get('chest')).toMatchObject({ status: 'recovering', hours: 24 });
    expect(r.get('quadriceps')).toMatchObject({ status: 'ready', hours: 84 });
    expect(r.get('calves')!.status).toBe('untrained');
  });

  it('ignores easy sets and old sessions', () => {
    const easy = [set(8, 100, { rir: 6 }), set(8, 100, { rir: 6 }), set(8, 100, { rir: 6 })];
    const s = [
      session(new Date('2026-11-24T08:00:00Z'), [{ e: bench, sets: easy }]),
      session(new Date('2026-10-01T08:00:00Z'), [{ e: squat, sets: [set(5), set(5)] }]),
    ];
    const r = new Map(readiness(s, sharesFor, now).map((a) => [a.area, a]));
    expect(r.get('chest')!.status).toBe('untrained');
    expect(r.get('quadriceps')!.status).toBe('untrained');
  });

  it('a 60 hour gap is nearly ready', () => {
    const s = [session(new Date('2026-11-22T06:00:00Z'), [{ e: bench, sets: [set(8), set(8)] }])];
    const chest = readiness(s, sharesFor, now).find((a) => a.area === 'chest')!;
    expect(chest.status).toBe('nearly');
  });
});

describe('set fatigue', () => {
  const days = [1, 3, 5].map((d) => new Date(2026, 10, d));
  it('averages the reps lost across sets at one weight', () => {
    const s = days.map((d) => session(d, [{ e: bench, sets: [set(10), set(9), set(8), set(7)] }]));
    const [f] = setFatigue(s);
    expect(f).toMatchObject({ firstReps: 10, lastReps: 7, sessions: 3, verdict: 'normal' });
    expect(f!.drop).toBeCloseTo(0.3);
  });

  it('needs three sets at one weight and three sessions', () => {
    const ramp = days.map((d) =>
      session(d, [{ e: bench, sets: [set(10, 80), set(8, 90), set(6, 100)] }]),
    );
    expect(setFatigue(ramp)).toEqual([]);
    const two = days
      .slice(0, 2)
      .map((d) => session(d, [{ e: bench, sets: [set(8), set(8), set(8)] }]));
    expect(setFatigue(two)).toEqual([]);
    expect(fatigueSessions(two)).toBe(2);
  });

  it('labels holding and steep', () => {
    const hold = days.map((d) => session(d, [{ e: bench, sets: [set(8), set(8), set(8)] }]));
    expect(setFatigue(hold)[0]!.verdict).toBe('holding');
    const steep = days.map((d) => session(d, [{ e: bench, sets: [set(10), set(7), set(5)] }]));
    expect(setFatigue(steep)[0]!.verdict).toBe('steep');
  });

  it('leaves out warm-ups and unfinished sets', () => {
    const s = days.map((d) =>
      session(d, [
        {
          e: bench,
          sets: [
            set(15, 100, { setType: 'warmup' }),
            set(8),
            set(8),
            set(8),
            set(2, 100, { completedAt: null }),
          ],
        },
      ]),
    );
    expect(setFatigue(s)[0]).toMatchObject({ firstReps: 8, lastReps: 8 });
  });
});

describe('effort check', () => {
  const pairs = (k: number, drop: number) =>
    Array.from({ length: k }, (_, i) =>
      session(new Date(2026, 10, i + 1), [{ e: bench, sets: [set(10), set(10 - drop)] }]),
    );
  it('says nothing below the minimum', () => {
    expect(effortCheck(pairs(EFFORT_MIN_PAIRS - 1, 4)).verdict).toBe('not-enough');
  });
  it('flags RIR 2 sets followed by a big drop', () => {
    const r = effortCheck(pairs(10, 4));
    expect(r).toMatchObject({ pairs: 10, steep: 10, verdict: 'harder' });
  });
  it('matches when reps hold', () => {
    expect(effortCheck(pairs(12, 1)).verdict).toBe('matches');
  });
  it('reads RPE as 10 minus RPE and skips weight changes', () => {
    const s = Array.from({ length: 10 }, (_, i) =>
      session(new Date(2026, 10, i + 1), [
        { e: bench, sets: [set(10, 100, { rir: null, rpe: 7 }), set(6)] },
        { e: squat, sets: [set(10, 100), set(6, 90)] },
      ]),
    );
    expect(effortCheck(s)).toMatchObject({ pairs: 10, steep: 10 });
  });
});

describe('rep ranges', () => {
  it('counts heavy, moderate and light working sets', () => {
    const s = [
      session(new Date(), [
        {
          e: bench,
          sets: [set(3), set(5), set(6), set(12), set(13), set(20, 100, { setType: 'warmup' })],
        },
      ]),
    ];
    expect(repRanges(s)).toEqual({ heavy: 2, moderate: 2, light: 1, total: 5 });
  });
});

describe('left and right', () => {
  const row = ex('one-arm-dumbbell-row');
  it('averages the gap and names the stronger side', () => {
    const s = [10, 12, 14].map((left, i) =>
      session(new Date(2026, 10, i + 1), [
        { e: row as typeof bench, sets: [set(8, 30, { repsLeft: left, repsRight: 10 })] },
      ]),
    );
    const [b] = sideBalance(s);
    expect(b!.stronger).toBe('left');
    expect(b!.firstGap).toBe(0);
    expect(b!.lastGap).toBeCloseTo(4 / 14);
    expect(b!.sessions).toBe(3);
  });
  it('needs three sessions with both sides', () => {
    const s = [
      session(new Date(), [
        { e: row as typeof bench, sets: [set(8, 30, { repsLeft: 8, repsRight: 8 })] },
      ]),
    ];
    expect(sideBalance(s)).toEqual([]);
  });
});

describe('rep range note', () => {
  const r = (heavy: number, moderate: number, light = 0) => ({
    heavy,
    moderate,
    light,
    total: heavy + moderate + light,
  });
  it('waits for 20 sets', () => {
    expect(repRangeNote(r(2, 10), 'strength')).toBe('not-enough');
  });
  it('asks a strength goal for heavy sets under 20%', () => {
    expect(repRangeNote(r(3, 27), 'strength')).toBe('add-heavy');
    expect(repRangeNote(r(6, 24), 'strength_hypertrophy')).toBe('fits-strength');
  });
  it('any load grows muscle for other goals', () => {
    expect(repRangeNote(r(0, 10, 20), 'hypertrophy')).toBe('any-load-grows');
    expect(repRangeNote(r(0, 30), null)).toBe('any-load-grows');
  });
});

describe('whole shares', () => {
  it('always add up to 100', () => {
    expect(wholeShares([3, 48, 10])).toEqual([5, 79, 16]);
    expect(wholeShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholeShares([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
