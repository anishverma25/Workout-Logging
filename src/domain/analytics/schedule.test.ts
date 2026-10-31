import type { RoutineDay } from '@/domain/models/schemas';
import { buildData } from '@/test/fixtures';
import { adherence, dayStatuses, nextPlannedDay, weeklySessionCounts } from './schedule';
import { buildSessions } from './sessions';

const ROUTINE = '11111111-1111-4111-8111-111111111111';
const day = (name: string, weekdays: number[]): RoutineDay => ({
  id: `22222222-2222-4222-8222-${String(weekdays[0]).padStart(12, '0')}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  origin: 'user',
  routineId: ROUTINE,
  name,
  order: 0,
  weekdays,
});
// Mon/Thu push, Tue/Fri pull
const DAYS = [day('Push', [1, 4]), day('Pull', [2, 5])];

// Local times: Monday 7 Sep 2026 to Sunday 13 Sep 2026
const at = (d: number, h = 18) => new Date(2026, 8, d, h).toISOString();
const sessionsOn = (...dates: number[]) =>
  buildSessions(buildData(dates.map((d) => ({ at: at(d), routineId: ROUTINE, exercises: [] }))));

describe('adherence', () => {
  const start = new Date(2026, 8, 7);
  const end = new Date(2026, 8, 14);

  it('counts completed planned sessions over planned sessions', () => {
    const result = adherence(
      sessionsOn(7, 8, 10),
      DAYS,
      ROUTINE,
      start,
      end,
      new Date(2026, 8, 13, 12),
    );
    expect(result).toEqual({ planned: 4, completed: 3, rate: 0.75 });
  });

  it('does not count today as missed before it is logged', () => {
    const now = new Date(2026, 8, 10, 9); // Thursday morning, Push planned tonight
    expect(adherence(sessionsOn(7, 8), DAYS, ROUTINE, start, end, now)).toEqual({
      planned: 2,
      completed: 2,
      rate: 1,
    });
  });

  it('counts a planned day once when the session is repeated the same day (B1)', () => {
    // Monday 7 Sep logged twice (a repeat), Tuesday 8 Sep once; Thursday 10 and Friday 11 missed.
    const repeated = buildSessions(
      buildData([
        { at: at(7, 9), routineId: ROUTINE, exercises: [] },
        { at: at(7, 19), routineId: ROUTINE, exercises: [] },
        { at: at(8), routineId: ROUTINE, exercises: [] },
      ]),
    );
    expect(adherence(repeated, DAYS, ROUTINE, start, end, new Date(2026, 8, 13, 12))).toEqual({
      planned: 4,
      completed: 2,
      rate: 0.5,
    });
  });

  it('has no rate without a plan', () => {
    expect(
      adherence(sessionsOn(7), [], ROUTINE, start, end, new Date(2026, 8, 13)).rate,
    ).toBeNull();
  });

  it('caps completion at the number planned', () => {
    const result = adherence(
      sessionsOn(7, 8, 9, 10, 11, 12),
      DAYS,
      ROUTINE,
      start,
      end,
      new Date(2026, 8, 13, 12),
    );
    expect(result.completed).toBe(4);
    expect(result.rate).toBe(1);
  });
});

describe('day statuses', () => {
  it('labels completed, missed, rest, extra and planned days', () => {
    const now = new Date(2026, 8, 11, 9); // Friday morning
    const states = dayStatuses(sessionsOn(7, 9), DAYS, new Date(2026, 8, 7), 5, now).map(
      (d) => d.state,
    );
    // Mon done, Tue missed, Wed extra (unplanned), Thu missed, Fri planned today
    expect(states).toEqual(['completed', 'missed', 'extra', 'missed', 'planned']);
  });

  it('plans nothing before the routine existed', () => {
    const now = new Date(2026, 8, 11, 9);
    const created = new Date(2026, 8, 10, 18); // Thursday evening
    const states = dayStatuses([], DAYS, new Date(2026, 8, 7), 5, now, created).map((d) => d.state);
    expect(states).toEqual(['rest', 'rest', 'rest', 'missed', 'planned']);
    const result = adherence([], DAYS, ROUTINE, new Date(2026, 8, 7), now, now, created);
    expect(result.planned).toBe(1);
  });
});

describe('scheduling helpers', () => {
  it('finds the next planned day', () => {
    const next = nextPlannedDay(new Date(2026, 8, 11, 20), DAYS); // Friday evening
    expect(next?.day.name).toBe('Push');
    expect(next?.date.getDate()).toBe(14);
  });

  it('counts sessions per calendar week', () => {
    const weeks = weeklySessionCounts(sessionsOn(1, 3, 7, 8, 10), 2, new Date(2026, 8, 12), 1);
    expect(weeks.map((w) => w.sessions)).toEqual([2, 3]);
  });
});
