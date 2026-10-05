import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import { BENCH, buildData, PULL_UP } from '@/test/fixtures';
import { exerciseRecords } from './records';
import { buildSessions } from './sessions';

const PLANK = exerciseIdFor('plank');
const WEIGHTED_PULL_UP = exerciseIdFor('weighted-pull-up');

describe('exercise records', () => {
  const data = buildData([
    {
      at: '2026-09-01T18:00:00Z',
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 40, r: 12, type: 'warmup' },
            { w: 80, r: 8 },
            { w: 80, r: 7 },
          ],
        },
        { key: 'pull-up', sets: [{ w: null, r: 9 }] },
        { key: 'weighted-pull-up', sets: [{ w: 10, r: 6 }] },
      ],
    },
    {
      at: '2026-09-04T18:00:00Z',
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 85, r: 5 },
            { w: 80, r: 9 },
            { w: 100, r: 1, done: false },
          ],
        },
        {
          key: 'pull-up',
          sets: [
            { w: null, r: 9 },
            { w: null, r: 11 },
          ],
        },
        { key: 'weighted-pull-up', sets: [{ w: 15, r: 4 }] },
      ],
    },
  ]);
  // Add a plank with durations by hand.
  const plankSession = buildData([
    { at: '2026-09-02T18:00:00Z', exercises: [{ key: 'plank', sets: [{ w: null, r: 0 }] }] },
    { at: '2026-09-05T18:00:00Z', exercises: [{ key: 'plank', sets: [{ w: null, r: 0 }] }] },
  ]);
  plankSession.sets[0]!.durationSec = 45;
  plankSession.sets[1]!.durationSec = 70;
  data.workouts.push(...plankSession.workouts);
  data.workoutExercises.push(...plankSession.workoutExercises);
  data.sets.push(...plankSession.sets);

  const records = exerciseRecords(buildSessions(data), SYSTEM_EXERCISES);
  const of = (id: string) => records.find((r) => r.exerciseId === id)!;

  it('keeps the heaviest actual load and the best estimate separate', () => {
    const bench = of(BENCH);
    expect(bench.heaviest).toMatchObject({ value: 85, reps: 5 });
    // 80 x 9 (104) beats 85 x 5 (99.2); the unfinished 100 x 1 never counts.
    expect(bench.bestE1rm?.weightKg).toBe(80);
    expect(bench.bestE1rm?.reps).toBe(9);
    expect(bench.bestE1rm?.value).toBeCloseTo(104, 6);
    expect(bench.sessions).toBe(2);
  });

  it('lists the best reps at each load, heaviest first, ignoring warm-ups', () => {
    expect(of(BENCH).repsAtLoad.map((r) => [r.weightKg, r.reps])).toEqual([
      [85, 5],
      [80, 9],
    ]);
  });

  it('tracks most reps for bodyweight and added load for weighted bodyweight moves', () => {
    expect(of(PULL_UP).mostReps?.value).toBe(11);
    expect(of(PULL_UP).heaviest).toBeNull();
    expect(of(WEIGHTED_PULL_UP).heaviest?.value).toBe(15);
    expect(of(WEIGHTED_PULL_UP).bestE1rm).toBeNull();
    expect(of(WEIGHTED_PULL_UP).history.map((h) => h.type)).toEqual(['load']);
  });

  it('tracks the longest hold and records it as an event', () => {
    expect(of(PLANK).longestDuration?.value).toBe(70);
    expect(of(PLANK).history[0]).toMatchObject({ type: 'duration', value: 70, previousBest: 45 });
  });

  it('attaches each exercise’s record history, newest first', () => {
    const types = of(BENCH)
      .history.map((h) => h.type)
      .sort();
    expect(types).toEqual(['e1rm', 'load']);
  });
});

describe('isolation lifts', () => {
  it('get load and reps-at-load records but never an estimated 1RM', () => {
    const d = buildData([
      {
        at: '2026-09-01T18:00:00Z',
        exercises: [{ key: 'triceps-rope-pushdown', sets: [{ w: 25, r: 12 }] }],
      },
      {
        at: '2026-09-04T18:00:00Z',
        exercises: [{ key: 'triceps-rope-pushdown', sets: [{ w: 27.5, r: 10 }] }],
      },
    ]);
    const [r] = exerciseRecords(buildSessions(d), SYSTEM_EXERCISES);
    expect(r!.bestE1rm).toBeNull();
    expect(r!.heaviest?.value).toBe(27.5);
    expect(r!.repsAtLoad).toHaveLength(2);
    expect(r!.history.map((h) => h.type)).toEqual(['load']);
  });
});
