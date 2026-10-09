import { SYSTEM_EXERCISES, exerciseIdFor } from '@/data/library/exercises';
import { buildData } from '@/test/fixtures';
import { muscleRecency, muscleWorkload } from './muscles';
import { progressionSuggestions } from './progression';
import { buildSessions, type TrainingData } from './sessions';

const CURL = exerciseIdFor('dumbbell-curl');

describe('muscle workload', () => {
  const data = buildData([
    {
      // Local time, so calendar-day counts hold in every time zone.
      at: new Date(2026, 8, 1, 18).toISOString(),
      exercises: [
        // primary chest, secondary triceps and shoulders
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 40, r: 10, type: 'warmup' },
            { w: 80, r: 8 },
            { w: 80, r: 8 },
            { w: 80, r: 8, done: false },
            // Logged as 6 reps in reserve: not a hard set, so it does not count.
            { w: 60, r: 8, rir: 6 },
          ],
        },
        {
          key: 'triceps-rope-pushdown',
          sets: [
            { w: 30, r: 12 },
            { w: 30, r: 12 },
          ],
        },
        { key: 'pull-up', sets: [{ w: null, r: 10 }] },
        { key: 'plank', sets: [{ w: null, r: 1 }] },
      ],
    },
  ]);
  const sessions = buildSessions(data);
  const of = (m: string) => muscleWorkload(sessions).find((w) => w.muscle === m)!;

  it('counts working sets fully for the primary muscle and half for secondaries', () => {
    expect(of('chest')).toEqual({ muscle: 'chest', direct: 2, indirect: 0, weighted: 2 });
    expect(of('triceps')).toEqual({ muscle: 'triceps', direct: 2, indirect: 2, weighted: 3 });
    expect(of('shoulders').weighted).toBe(1);
    expect(of('back').direct).toBe(1);
    expect(of('biceps').weighted).toBe(0.5); // pull-up secondary
    expect(of('abs').direct).toBe(1); // timed sets count too
    expect(of('calves').weighted).toBe(0);
  });

  it('reports days since each muscle was last trained directly', () => {
    const r = muscleRecency(sessions, new Date(2026, 8, 4, 9));
    expect(r.find((x) => x.muscle === 'chest')?.daysSince).toBe(3);
    // Trained only as a secondary muscle does not count as trained directly.
    expect(r.find((x) => x.muscle === 'shoulders')?.daysSince).toBeNull();
  });

  it('handles no sessions', () => {
    expect(muscleWorkload([]).every((w) => w.weighted === 0)).toBe(true);
  });
});

describe('progression suggestions', () => {
  function curlSession(
    reps: number[],
    rir: (number | null)[],
    over: Partial<{ weight: number; targetRir: number | null; sets: number }> = {},
  ): TrainingData {
    const data = buildData([
      {
        at: '2026-09-04T18:00:00Z',
        exercises: [{ key: 'dumbbell-curl', sets: reps.map((r) => ({ w: over.weight ?? 14, r })) }],
      },
    ]);
    data.workoutExercises[0]!.target = {
      sets: over.sets ?? 3,
      repMin: 8,
      repMax: 12,
      rir: over.targetRir === undefined ? 2 : over.targetRir,
      rest: 90,
    };
    data.sets.forEach((s, i) => (s.rir = rir[i] ?? null));
    return data;
  }
  const suggest = (d: TrainingData) => progressionSuggestions(buildSessions(d), SYSTEM_EXERCISES);

  it('suggests more load when every target set hit the top of the range at target effort', () => {
    const [s] = suggest(curlSession([12, 12, 12], [2, 2, 1.5]));
    expect(s).toMatchObject({ exerciseId: CURL, effort: 'met' });
    expect(s!.sets).toHaveLength(3);
  });

  it('does not suggest when a set fell short of the top of the range', () => {
    expect(suggest(curlSession([12, 12, 11], [2, 2, 2]))).toEqual([]);
  });

  it('does not suggest when the reps came from grinding past the effort target', () => {
    expect(suggest(curlSession([12, 12, 12], [2, 1, 0]))).toEqual([]);
  });

  it('says effort is unknown when no RIR was logged', () => {
    expect(suggest(curlSession([12, 12, 12], [null, null, null]))[0]?.effort).toBe('unknown');
  });

  it('treats a target without RIR as met and needs the full number of sets', () => {
    expect(suggest(curlSession([12, 12, 12], [], { targetRir: null }))[0]?.effort).toBe('met');
    expect(suggest(curlSession([12, 12], [2, 2]))).toEqual([]);
  });

  it('ignores exercises without a routine target', () => {
    const d = curlSession([12, 12, 12], [2, 2, 2]);
    d.workoutExercises[0]!.target = null;
    expect(suggest(d)).toEqual([]);
  });

  it('only looks at the latest session of each exercise', () => {
    const d = curlSession([12, 12, 12], [2, 2, 2]);
    const later = buildData([
      {
        at: '2026-09-08T18:00:00Z',
        exercises: [
          {
            key: 'dumbbell-curl',
            sets: [
              { w: 16, r: 9 },
              { w: 16, r: 8 },
              { w: 16, r: 8 },
            ],
          },
        ],
      },
    ]);
    later.workoutExercises[0]!.target = d.workoutExercises[0]!.target;
    d.workouts.push(...later.workouts);
    d.workoutExercises.push(...later.workoutExercises);
    d.sets.push(...later.sets);
    expect(suggest(d)).toEqual([]);
  });
});
