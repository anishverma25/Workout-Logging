import { generateDemoDataset } from '@/data/demo/generate';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { DEFAULT_PREFERENCES } from '@/domain/models/schemas';
import { buildDashboard } from './dashboard';
import { historyEntries } from './history';
import { buildProgress } from './progress';
import { buildSessions, type TrainingData } from './sessions';
import { detectPersonalRecords } from './prs';

/**
 * A heavy, realistic user: the 5-week demo history repeated back over two years (about 550
 * workouts and 10,000 sets). Every screen recomputes from all sets, so this guards against
 * accidental quadratic work. Limits are generous so slow CI machines do not flake.
 */
function twoYears(now: Date): TrainingData {
  const out: TrainingData = {
    profile: null,
    exercises: SYSTEM_EXERCISES,
    routines: [],
    routineDays: [],
    routineExercises: [],
    workouts: [],
    workoutExercises: [],
    sets: [],
    bodyWeights: [],
  };
  for (let block = 0; block < 21; block++) {
    const shifted = new Date(now.getTime() - block * 35 * 86_400_000);
    const d = generateDemoDataset(shifted, 1000 + block);
    if (block === 0) {
      out.routines = d.routines;
      out.routineDays = d.routineDays;
      out.routineExercises = d.routineExercises;
    }
    out.workouts.push(...d.workouts);
    out.workoutExercises.push(...d.workoutExercises);
    out.sets.push(...d.sets);
    out.bodyWeights.push(...d.bodyWeights);
  }
  return out;
}

const time = (fn: () => unknown) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

describe('analytics on two years of training', () => {
  const now = new Date('2026-09-10T12:00:00');
  const data = twoYears(now);

  it('is a realistic heavy dataset', () => {
    expect(data.workouts.length).toBeGreaterThan(500);
    expect(data.sets.length).toBeGreaterThan(9000);
  });

  it('builds every screen quickly', () => {
    const timings = {
      sessions: time(() => buildSessions(data)),
      records: time(() => detectPersonalRecords(buildSessions(data), data.exercises)),
      home: time(() => buildDashboard(data, DEFAULT_PREFERENCES, now)),
      history: time(() => historyEntries(data)),
      progressAll: time(() =>
        buildProgress(data, { range: 'all', exerciseId: null, now, weekStartsOn: 1, unit: 'kg' }),
      ),
      progress30: time(() =>
        buildProgress(data, { range: '30d', exerciseId: null, now, weekStartsOn: 1, unit: 'kg' }),
      ),
    };
    console.warn(
      'timings (ms)',
      JSON.stringify(timings, (_k, v) => (typeof v === 'number' ? Math.round(v) : v)),
    );
    for (const [screen, ms] of Object.entries(timings)) expect(ms, screen).toBeLessThan(1500);
  });
});
