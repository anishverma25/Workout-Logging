import { BENCH, buildData, PULL_UP } from '@/test/fixtures';
import { summarizeWorkout } from './summary';

const DAY = '00000000-0000-4000-8000-00000000d001';

describe('workout summary', () => {
  const data = buildData([
    {
      at: '2026-09-01T18:00:00Z',
      routineDayId: DAY,
      minutes: 50,
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 40, r: 10, type: 'warmup' },
            { w: 80, r: 8 },
            { w: 80, r: 7 },
          ],
        },
        {
          key: 'pull-up',
          sets: [
            { w: null, r: 8 },
            { w: null, r: 7 },
          ],
        },
      ],
    },
    {
      at: '2026-09-04T18:00:00Z',
      routineDayId: DAY,
      minutes: 55,
      pausedMinutes: 10,
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 40, r: 10, type: 'warmup' },
            { w: 82.5, r: 8 },
            { w: 80, r: 8 },
            { w: 60, r: 5, done: false },
          ],
        },
        {
          key: 'pull-up',
          sets: [
            { w: null, r: 10 },
            { w: null, r: 8 },
          ],
        },
        { key: 'plank', sets: [] },
      ],
    },
  ]);
  const second = data.workouts[1]!;

  it('counts duration without pauses, working sets, warm-ups and volume', () => {
    const s = summarizeWorkout(data, second.id)!;
    expect(s.minutes).toBe(55);
    expect(s.workingSets).toBe(4);
    expect(s.warmupSets).toBe(1);
    // Warm-ups, unfinished sets and bodyweight exercises add no volume.
    expect(s.volumeKg).toBe(82.5 * 8 + 80 * 8);
  });

  it('compares each exercise with its previous session using the same metric', () => {
    const s = summarizeWorkout(data, second.id)!;
    const bench = s.exercises.find((e) => e.exerciseId === BENCH)!;
    expect(bench.change?.kind).toBe('e1rm');
    if (bench.change?.kind === 'e1rm') {
      expect(bench.change.previous).toBeCloseTo(80 * (1 + 8 / 30), 6);
      expect(bench.change.today).toBeCloseTo(82.5 * (1 + 8 / 30), 6);
      expect(bench.change.change).toBeCloseTo(0.03125, 6);
    }
    const pull = s.exercises.find((e) => e.exerciseId === PULL_UP)!;
    expect(pull.change).toMatchObject({ kind: 'reps', today: 10, previous: 8, change: 0.25 });
  });

  it('lists the records set in this workout only', () => {
    const s = summarizeWorkout(data, second.id)!;
    expect(s.prs.map((p) => `${p.exerciseName}:${p.type}`).sort()).toEqual([
      'Barbell bench press:e1rm',
      'Barbell bench press:load',
      'Pull-up:reps',
    ]);
    expect(summarizeWorkout(data, data.workouts[0]!.id)!.prs).toEqual([]);
  });

  it('marks first-time exercises instead of inventing a comparison', () => {
    const s = summarizeWorkout(data, data.workouts[0]!.id)!;
    expect(s.exercises.every((e) => e.change?.kind === 'first')).toBe(true);
    expect(s.volumeVsLast).toBeNull();
  });

  it('compares volume with the previous session of the same routine day', () => {
    const s = summarizeWorkout(data, second.id)!;
    expect(s.volumeVsLast?.previousKg).toBe(80 * 8 + 80 * 7);
    expect(s.volumeVsLast?.change).toBeCloseTo((1300 - 1200) / 1200, 6);
  });

  it('skips exercises with nothing completed and returns null for unknown workouts', () => {
    const s = summarizeWorkout(data, second.id)!;
    expect(s.exercises.map((e) => e.name)).not.toContain('plank');
    expect(summarizeWorkout(data, 'missing')).toBeNull();
  });
});
