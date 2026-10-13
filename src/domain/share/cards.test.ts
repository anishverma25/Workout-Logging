import { buildData } from '@/test/fixtures';
import { compareVolume, prCard, streakCard, workoutCard } from './cards';

const bench = (at: string, w: number, r = 5) => ({
  at,
  minutes: 50,
  name: 'Push',
  exercises: [
    {
      key: 'barbell-bench-press',
      sets: [
        { w, r },
        { w, r },
        { w: w - 10, r: r + 2 },
      ],
    },
  ],
});

describe('story cards', () => {
  const data = buildData([
    bench('2026-09-01T10:00:00', 80),
    bench('2026-09-08T10:00:00', 82.5),
    bench('2026-09-15T10:00:00', 85),
    bench('2026-09-22T10:00:00', 85),
    bench('2026-09-29T10:00:00', 90),
  ]);
  const last = data.workouts[data.workouts.length - 1]!.id;

  it('sums up a workout for the receipt', () => {
    const w = workoutCard(data, last)!;
    expect(w).toMatchObject({ title: 'Push', number: 5, workingSets: 3, minutes: 50 });
    expect(w.volumeKg).toBe(90 * 5 * 2 + 80 * 7);
    expect(w.lines).toEqual([
      { name: 'barbell-bench-press', weightKg: 90, reps: 5, durationSec: null, distanceM: null },
    ]);
  });

  it('picks the heaviest-load record and its ladder from where the lift started', () => {
    const pr = prCard(data, last)!;
    expect(pr).toMatchObject({ kind: 'load', weightKg: 90, reps: 5, gain: 5 });
    expect(pr.ladder.map((l) => l.value)).toEqual([80, 82.5, 85, 90]);
    expect(pr.ladder[0]!.start).toBe(true);
    expect(pr.e1rmKg).toBeCloseTo(105, 5);
    // A workout with no record has no PR card.
    expect(prCard(data, data.workouts[3]!.id)).toBeNull();
  });

  it('counts weeks in a row with a workout', () => {
    const s = streakCard(data, new Date(2026, 9, 1), 1)!;
    expect(s.weeks).toBe(5);
    expect(s.workouts).toBe(5);
    expect(s.grid).toHaveLength(84);
    expect(s.grid.filter(Boolean)).toHaveLength(5);
    // A week off breaks it.
    expect(streakCard(data, new Date(2026, 9, 20), 1)).toBeNull();
  });

  it('compares the total with something heavy it beat', () => {
    expect(compareVolume(50)).toBeNull();
    expect(compareVolume(6686)).toMatchObject({
      beat: { label: 'An elephant' },
      smaller: { label: 'A pickup truck' },
    });
  });
});
