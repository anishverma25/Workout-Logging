import { buildData } from '@/test/fixtures';
import { exerciseIdFor } from '@/data/library/exercises';
import type { BodyWeightEntry, TrainingGoal } from '../models/schemas';
import { goalProgress } from './goals';
import { milestones } from './milestones';
import { performanceByExercise } from './performance';
import { buildSessions } from './sessions';

const BENCH = exerciseIdFor('barbell-bench-press');
const NOW = new Date(2026, 9, 7, 20);
const meta = {
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  deletedAt: null,
  origin: 'user' as const,
};
const goal = (g: Partial<TrainingGoal>): TrainingGoal => ({
  ...meta,
  id: crypto.randomUUID(),
  kind: 'exercise_e1rm',
  exerciseId: BENCH,
  targetValue: 100,
  startValue: 80,
  targetDate: null,
  achievedAt: null,
  ...g,
});
const weekly = (from: number, step: number, weeks = 6) =>
  Array.from({ length: weeks }, (_, i) => ({
    at: `2026-${String(8 + Math.floor((26 + i * 7) / 31)).padStart(2, '0')}-${String(((26 + i * 7 - 1) % 31) + 1).padStart(2, '0')}T10:00:00`,
    exercises: [{ key: 'barbell-bench-press', sets: [{ w: from + i * step, r: 1 }] }],
  }));
const weigh = (day: number, kg: number): BodyWeightEntry => ({
  ...meta,
  id: crypto.randomUUID(),
  measuredAt: new Date(2026, 8, day, 7).toISOString(),
  weightKg: kg,
  enteredUnit: 'kg',
  note: null,
});

describe('goal progress', () => {
  it('measures a lift goal and projects the date at the current rate', () => {
    const history = performanceByExercise(buildSessions(buildData(weekly(80, 2.5))));
    const p = goalProgress(goal({ targetDate: '2027-01-01' }), history, [], NOW);
    expect(p.current).toBe(92.5);
    expect(p.fraction).toBeCloseTo(12.5 / 20, 6);
    expect(p.ratePerWeek).toBeCloseTo(2.5, 6);
    expect(p.reached).toBe(false);
    // 7.5 kg left at 2.5 kg a week: 3 weeks.
    expect(p.projected!.getTime()).toBe(new Date(2026, 9, 28, 20).getTime());
    expect(p.pace).toBe('ahead');
  });

  it('marks a goal reached and never projects a lift that is not moving', () => {
    const history = performanceByExercise(buildSessions(buildData(weekly(80, 0))));
    expect(goalProgress(goal({ targetValue: 80 }), history, [], NOW).reached).toBe(true);
    const stuck = goalProgress(goal({ targetDate: '2026-12-01' }), history, [], NOW);
    expect(stuck.projected).toBeNull();
    expect(stuck.pace).toBe('behind');
  });

  it('handles body weight goals in either direction', () => {
    const cutting = Array.from({ length: 20 }, (_, i) => weigh(1 + i, 80 - i * 0.1));
    const p = goalProgress(
      goal({ kind: 'body_weight', exerciseId: null, targetValue: 76, startValue: 80 }),
      new Map(),
      cutting,
      new Date(2026, 8, 21, 9),
    );
    expect(p.current).toBeLessThan(80);
    expect(p.ratePerWeek).toBeGreaterThan(0);
    expect(p.projected).not.toBeNull();
  });
});

describe('milestones', () => {
  it('finds counts, plate milestones and body-weight lifts from the log', () => {
    const data = buildData(weekly(55, 5));
    const list = milestones(buildSessions(data), [weigh(1, 70)], NOW, 1, 1);
    const ids = list.map((m) => m.id);
    expect(ids).toContain('workouts-1');
    expect(ids).toContain('plates-barbell-bench-press-60');
    expect(ids).toContain('bw-barbell-bench-press-1');
    expect(ids).toContain('streak-4');
    expect(ids).not.toContain('plates-barbell-bench-press-100');
    // In order, each reached once.
    expect(new Set(ids).size).toBe(ids.length);
    const times = list.map((m) => m.achievedAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('recaps', () => {
  it('sums up last month and finds the lift that rose most', async () => {
    const { monthRecap, yearRecap } = await import('./recap');
    const { SYSTEM_EXERCISES } = await import('@/data/library/exercises');
    const sessions = buildSessions(
      buildData([
        {
          at: '2026-08-20T10:00:00',
          exercises: [{ key: 'barbell-bench-press', sets: [{ w: 80, r: 5 }] }],
        },
        {
          at: '2026-09-03T10:00:00',
          exercises: [
            {
              key: 'barbell-bench-press',
              sets: [
                { w: 82.5, r: 5 },
                { w: 82.5, r: 5 },
              ],
            },
          ],
        },
        {
          at: '2026-09-17T10:00:00',
          exercises: [{ key: 'barbell-bench-press', sets: [{ w: 85, r: 5 }] }],
        },
        {
          at: '2026-10-02T10:00:00',
          exercises: [{ key: 'barbell-bench-press', sets: [{ w: 90, r: 5 }] }],
        },
      ]),
    );
    const r = monthRecap(sessions, SYSTEM_EXERCISES, NOW)!;
    expect(r.start).toEqual(new Date(2026, 8, 1));
    expect(r.workouts).toBe(2);
    expect(r.workingSets).toBe(3);
    expect(r.volumeKg).toBe(82.5 * 10 + 85 * 5);
    expect(r.topLift!.toKg).toBeCloseTo(85 * (35 / 30), 6);
    expect(r.favourite?.sets).toBe(3);
    expect(yearRecap(sessions, SYSTEM_EXERCISES, NOW)).toBeNull();
    expect(yearRecap(sessions, SYSTEM_EXERCISES, new Date(2027, 0, 5))!.workouts).toBe(4);
  });
});
