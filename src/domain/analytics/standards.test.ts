import { buildData } from '@/test/fixtures';
import { performanceByExercise } from './performance';
import { buildSessions } from './sessions';
import {
  balanceRatios,
  detectPlateaus,
  dotsScore,
  e1rmRate,
  loadSpike,
  sessionLoad,
  strengthLevel,
} from './standards';

const BENCH_ID = 'bench';

describe('strength levels', () => {
  it('places a lift between the standard multiples of body weight', () => {
    const l = strengthLevel('barbell-bench-press', BENCH_ID, 100, 80, 'male')!;
    expect(l.ratio).toBe(1.25);
    expect(l.level).toBe('Intermediate');
    expect(l.next).toBe('Advanced');
    expect(l.nextKg).toBe(140);
    expect(l.progress).toBe(0);
    const below = strengthLevel('barbell-bench-press', BENCH_ID, 30, 80, 'male')!;
    expect(below.level).toBeNull();
    expect(below.next).toBe('Beginner');
    const top = strengthLevel('deadlift', 'dl', 250, 80, 'male')!;
    expect(top.level).toBe('Elite');
    expect(top.nextKg).toBeNull();
    expect(strengthLevel('barbell-bench-press', BENCH_ID, 60, 60, 'female')!.level).toBe(
      'Advanced',
    );
    expect(strengthLevel('cable-fly', 'x', 60, 60, 'female')).toBeNull();
  });
});

describe('DOTS', () => {
  it('matches the published coefficients', () => {
    expect(dotsScore(700, 100, 'male')).toBeCloseTo(430.86, 1);
    expect(dotsScore(400, 60, 'female')).toBeCloseTo(443.42, 1);
    // Body weight is held inside the formula's range.
    expect(dotsScore(700, 250, 'male')).toBeCloseTo(dotsScore(700, 210, 'male'), 9);
  });
});

const benchAt = (at: string, w: number, r = 5, minutes = 60) => ({
  at,
  minutes,
  exercises: [
    {
      key: 'barbell-bench-press',
      sets: [
        { w, r },
        { w, r },
        { w, r },
      ],
    },
  ],
});

describe('rate and plateaus', () => {
  const NOW = new Date(2026, 9, 7, 20);
  it('fits a weekly rate to the best e1RM of each session', () => {
    const data = buildData(
      [0, 1, 2, 3, 4].map((week) =>
        benchAt(`2026-09-${String(2 + week * 7).padStart(2, '0')}T10:00:00`, 80 + week * 2.5),
      ),
    );
    const history = [...performanceByExercise(buildSessions(data)).values()][0]!;
    const rate = e1rmRate(history, NOW)!;
    expect(rate).toBeCloseTo(2.5 * (35 / 30), 5);
    expect(e1rmRate(history.slice(0, 3), NOW)).toBeNull();
  });

  it('flags a lift that has not beaten its best for 3 weeks', () => {
    const data = buildData([
      benchAt('2026-09-07T10:00:00', 80),
      benchAt('2026-09-10T10:00:00', 85),
      benchAt('2026-09-14T10:00:00', 82.5),
      benchAt('2026-09-21T10:00:00', 85),
      benchAt('2026-09-28T10:00:00', 82.5),
      benchAt('2026-10-05T10:00:00', 85),
    ]);
    const plateaus = detectPlateaus(
      performanceByExercise(buildSessions(data)),
      NOW,
      'intermediate',
    );
    expect(plateaus).toHaveLength(1);
    expect(plateaus[0]).toMatchObject({ weeks: 3, sessionsSince: 4, suggestion: 'rep_range' });
    expect(
      detectPlateaus(performanceByExercise(buildSessions(data)), NOW, 'advanced')[0]!.suggestion,
    ).toBe('deload');
    // Stopped doing it: not a plateau.
    expect(
      detectPlateaus(performanceByExercise(buildSessions(data)), new Date(2026, 10, 1), null),
    ).toEqual([]);
  });
});

describe('balance', () => {
  it('compares push with pull and flags a lopsided month', () => {
    const NOW = new Date(2026, 9, 7, 20);
    const session = (at: string) => ({
      at,
      exercises: [
        { key: 'barbell-bench-press', sets: Array(6).fill({ w: 60, r: 8 }) },
        { key: 'overhead-press', sets: Array(4).fill({ w: 40, r: 8 }) },
        { key: 'barbell-row', sets: Array(3).fill({ w: 60, r: 8 }) },
      ],
    });
    const data = buildData([session('2026-09-20T10:00:00'), session('2026-10-01T10:00:00')]);
    const [pushPull, quadHam] = balanceRatios(buildSessions(data), NOW);
    expect(pushPull).toMatchObject({ a: { sets: 20 }, b: { sets: 6 }, verdict: 'a_heavy' });
    expect(quadHam!.verdict).toBe('too_little');
  });
});

describe('training load', () => {
  it('multiplies session effort by minutes', () => {
    expect(sessionLoad(7, 60)).toBe(420);
    expect(sessionLoad(null, 60)).toBeNull();
  });

  it('flags a week with more than 1.5 times the usual sets', () => {
    const NOW = new Date(2026, 9, 7, 20);
    const day = (at: string, n: number) => ({
      at,
      exercises: [{ key: 'barbell-bench-press', sets: Array(n).fill({ w: 60, r: 8 }) }],
    });
    const steady = [
      day('2026-08-25T10:00:00', 12),
      day('2026-09-03T10:00:00', 12),
      day('2026-09-10T10:00:00', 12),
      day('2026-09-17T10:00:00', 12),
      day('2026-09-24T10:00:00', 12),
    ];
    expect(
      loadSpike(buildSessions(buildData([...steady, day('2026-10-05T10:00:00', 12)])), NOW),
    ).toBeNull();
    const spike = loadSpike(
      buildSessions(
        buildData([...steady, day('2026-10-02T10:00:00', 12), day('2026-10-05T10:00:00', 12)]),
      ),
      NOW,
    )!;
    expect(spike.acuteSets).toBe(24);
    expect(spike.ratio).toBeGreaterThan(1.5);
  });
});

describe('strength profile', () => {
  it('finds the standard lifts by their built-in ids and adds up DOTS', async () => {
    const { strengthProfile } = await import('./standards');
    const { SYSTEM_EXERCISES } = await import('@/data/library/exercises');
    const NOW = new Date(2026, 9, 7, 20);
    const data = buildData([
      {
        at: '2026-10-01T10:00:00',
        exercises: [
          { key: 'back-squat', sets: [{ w: 100, r: 1 }] },
          { key: 'barbell-bench-press', sets: [{ w: 80, r: 1 }] },
          { key: 'deadlift', sets: [{ w: 140, r: 1 }] },
        ],
      },
    ]);
    const p = strengthProfile(
      performanceByExercise(buildSessions(data)),
      SYSTEM_EXERCISES,
      80,
      'male',
      NOW,
    );
    expect(p.levels.map((l) => [l.name, l.level])).toEqual([
      ['Squat', 'Novice'],
      ['Bench press', 'Novice'],
      ['Deadlift', 'Novice'],
    ]);
    expect(p.dots!.totalKg).toBe(320);
    expect(
      strengthProfile(
        performanceByExercise(buildSessions(data)),
        SYSTEM_EXERCISES,
        80,
        'unspecified',
        NOW,
      ).levels,
    ).toEqual([]);
  });
});

describe('readiness pattern', () => {
  it('compares sessions after good and poor sleep, with 4 on each side', async () => {
    const { readinessPattern } = await import('./standards');
    const specs = Array.from({ length: 9 }, (_, i) =>
      benchAt(`2026-09-${String(1 + i * 3).padStart(2, '0')}T10:00:00`, i % 2 ? 85 : 80),
    );
    const data = buildData(specs);
    // Odd sessions (heavier) after good sleep, even ones after poor sleep.
    data.workouts.forEach((w, i) => {
      w.readiness = { sleep: i % 2 ? 5 : 1, energy: 3, soreness: 2 };
    });
    const sessions = buildSessions(data);
    const p = readinessPattern(sessions, performanceByExercise(sessions))!;
    expect(p.factor).toBe('sleep');
    expect(p.good.sessions).toBe(4);
    expect(p.good.change).toBeGreaterThan(0);
    expect(p.poor.change).toBeLessThan(0);
    data.workouts.forEach((w) => (w.readiness = null));
    expect(
      readinessPattern(buildSessions(data), performanceByExercise(buildSessions(data))),
    ).toBeNull();
  });
});
