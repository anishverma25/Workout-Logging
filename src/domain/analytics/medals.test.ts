import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import { buildData } from '@/test/fixtures';
import { bestsBefore, medalsForSet } from './medals';
import { buildSessions } from './sessions';

const bench = SYSTEM_EXERCISES.find((e) => e.id === exerciseIdFor('barbell-bench-press'))!;

describe('live medals', () => {
  const data = buildData([
    {
      at: '2026-09-01T18:00:00Z',
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 80, r: 5 },
            { w: 80, r: 5 },
          ],
        },
      ],
    },
    {
      at: '2026-09-04T18:00:00Z',
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 80, r: 5, done: false },
            { w: 85, r: 5, done: false },
            { w: 85, r: 5, done: false },
          ],
        },
      ],
    },
  ]);
  const today = data.workouts[1]!.id;
  const before = bestsBefore(buildSessions(data), today).get(bench.id);
  const todaySets = data.sets.filter((s) => s.workoutId === today);
  const done = (i: number) => ({ ...todaySets[i]!, completedAt: '2026-09-04T18:10:00Z' });

  it('announces nothing for a set that only matches the old best', () => {
    expect(medalsForSet(done(0), bench, [done(0), todaySets[1]!, todaySets[2]!], before)).toEqual(
      [],
    );
  });

  it('announces heavier weight, a better 1RM and set volume once', () => {
    const sets = [done(0), done(1), todaySets[2]!];
    expect(medalsForSet(done(1), bench, sets, before).map((m) => m.type)).toEqual([
      'load',
      'e1rm',
      'set_volume',
      // 400 + 425 kg today beats the 800 kg session last time.
      'session_volume',
    ]);
    // The same weight again beats nothing new: each record is announced once.
    const all = [done(0), done(1), done(2)];
    expect(medalsForSet(done(2), bench, all, before)).toEqual([]);
  });

  it('a first session is the baseline, not a record', () => {
    expect(medalsForSet(done(1), bench, [done(1)], undefined)).toEqual([]);
  });
});
