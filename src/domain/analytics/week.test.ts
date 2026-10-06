import { buildData } from '@/test/fixtures';
import type { Profile, RoutineDay, RoutineExercise } from '../models/schemas';
import { buildSessions } from './sessions';
import { cycleNext, plannedWeeklySets, weekRings, weeklyStreak } from './week';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  origin: 'user' as const,
};
const day = (id: string, order: number, weekdays: number[]): RoutineDay => ({
  ...meta,
  id,
  routineId: 'r',
  name: id,
  order,
  weekdays,
});
const slot = (dayId: string, sets: number): RoutineExercise => ({
  ...meta,
  id: crypto.randomUUID(),
  routineDayId: dayId,
  exerciseId: crypto.randomUUID(),
  order: 0,
  targetSets: sets,
  repMin: 6,
  repMax: 10,
  targetRir: 2,
  restSeconds: 120,
  notes: null,
});
const profile = (p: Partial<Profile>): Profile => ({
  ...meta,
  id: 'p',
  displayName: 'A',
  birthDate: null,
  goal: 'hypertrophy',
  experience: 'intermediate',
  ...p,
});
const bench = (at: string, minutes = 60, routineDayId: string | null = null) => ({
  at,
  minutes,
  routineDayId,
  exercises: [
    {
      key: 'barbell-bench-press',
      sets: [
        { w: 60, r: 8 },
        { w: 60, r: 8 },
      ],
    },
  ],
});

// Wednesday 7 October 2026; weeks start on Monday.
const NOW = new Date(2026, 9, 7, 18);

describe('weekly rings', () => {
  const days = [day('push', 0, [1, 4]), day('pull', 1, [2, 5])];
  const slots = [slot('push', 3), slot('push', 3), slot('pull', 4)];

  it('plans sets from each day times its weekdays', () => {
    expect(plannedWeeklySets(days, slots)).toBe(6 * 2 + 4 * 2);
    expect(plannedWeeklySets([], slots)).toBeNull();
  });

  it('counts this calendar week against the targets the person set', () => {
    const data = buildData([
      bench('2026-10-04T10:00:00'), // Sunday: last week
      bench('2026-10-05T10:00:00', 50),
      bench('2026-10-06T10:00:00', 40),
    ]);
    const rings = weekRings(
      buildSessions(data),
      profile({ trainingDays: 4, sessionMinutes: 60 }),
      days,
      slots,
      NOW,
      1,
    );
    expect(rings.sessions).toEqual({ value: 2, target: 4, source: 'profile' });
    expect(rings.sets).toEqual({ value: 4, target: 20, source: 'routine' });
    expect(rings.minutes).toEqual({ value: 90, target: 240, source: 'profile' });
  });

  it('falls back to the routine for sessions and shows no target it cannot back up', () => {
    const rings = weekRings([], profile({}), days, slots, NOW, 1);
    expect(rings.sessions).toEqual({ value: 0, target: 4, source: 'routine' });
    expect(rings.minutes.target).toBeNull();
    const bare = weekRings([], null, [], [], NOW, 1);
    expect([bare.sessions.target, bare.sets.target, bare.minutes.target]).toEqual([
      null,
      null,
      null,
    ]);
  });
});

describe('weekly streak', () => {
  it('counts whole weeks that met the target, and the current one once it does', () => {
    const data = buildData([
      bench('2026-09-21T10:00:00'),
      bench('2026-09-23T10:00:00'),
      bench('2026-09-28T10:00:00'),
      bench('2026-09-30T10:00:00'),
      bench('2026-10-05T10:00:00'),
    ]);
    const sessions = buildSessions(data);
    expect(weeklyStreak(sessions, 2, NOW, 1)).toEqual({ weeks: 2, currentWeekMet: false });
    expect(weeklyStreak(sessions, 1, NOW, 1)).toEqual({ weeks: 3, currentWeekMet: true });
    expect(weeklyStreak(sessions, 3, NOW, 1).weeks).toBe(0);
    expect(weeklyStreak([], 3, NOW, 1).weeks).toBe(0);
  });
});

describe('cycle', () => {
  it('suggests the day after the last one done, wrapping around', () => {
    const days = [day('push', 0, [1]), day('pull', 1, [3]), day('legs', 2, [5])];
    const s1 = buildSessions(buildData([bench('2026-10-05T10:00:00', 60, 'push')]));
    expect(cycleNext(s1, days)?.id).toBe('pull');
    const s2 = buildSessions(buildData([bench('2026-10-05T10:00:00', 60, 'legs')]));
    expect(cycleNext(s2, days)?.id).toBe('push');
    expect(cycleNext([], days)).toBeNull();
  });
});
