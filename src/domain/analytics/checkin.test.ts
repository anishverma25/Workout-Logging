import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { buildData } from '@/test/fixtures';
import { weeklyCheckin } from './checkin';
import { buildSessions } from './sessions';

// Wednesday 7 October 2026. Last week: Monday 28 September to Sunday 4 October.
const NOW = new Date(2026, 9, 7, 18);
const bench = (at: string, w: number, n = 3) => ({
  at,
  exercises: [{ key: 'barbell-bench-press', sets: Array(n).fill({ w, r: 5 }) }],
});

const run = (specs: Parameters<typeof buildData>[0], target: number | null = 3) =>
  weeklyCheckin({
    sessions: buildSessions(buildData(specs)),
    exercises: SYSTEM_EXERCISES,
    target,
    experience: 'intermediate',
    now: NOW,
    weekStartsOn: 1,
  });

describe('weekly check-in', () => {
  it('reviews last week: sessions, lifts that improved and records', () => {
    const c = run([
      bench('2026-09-21T10:00:00', 80),
      bench('2026-09-29T10:00:00', 82.5),
      bench('2026-10-01T10:00:00', 80),
      bench('2026-10-03T10:00:00', 80),
    ])!;
    expect(c.sessions).toBe(3);
    expect(c.workingSets).toBe(9);
    expect(c.improved).toHaveLength(1);
    expect(c.improved[0]!.gainKg).toBeCloseTo(2.5 * (35 / 30), 6);
    expect(c.records).toBeGreaterThan(0);
    expect(c.focus.kind).toBe('keep_going');
  });

  it('puts missed sessions first, and says so when nothing was logged', () => {
    expect(
      run([bench('2026-09-21T10:00:00', 80), bench('2026-09-29T10:00:00', 80)])!.focus.kind,
    ).toBe('consistency');
    expect(run([bench('2026-09-21T10:00:00', 80)])!.focus.kind).toBe('start');
  });

  it('waits for a full week of history', () => {
    expect(run([bench('2026-10-05T10:00:00', 80)])).toBeNull();
    expect(run([])).toBeNull();
  });
});
