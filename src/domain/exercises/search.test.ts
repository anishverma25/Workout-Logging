import { exerciseIdFor, SYSTEM_EXERCISES, SYSTEM_EXERCISE_KEYS } from '@/data/library/exercises';
import { MUSCLE_GROUPS, type Exercise } from '../models/schemas';
import {
  EMPTY_FILTERS,
  exerciseUsage,
  filterExercises,
  hasActiveFilters,
  matchScore,
  normalize,
  recentExercises,
} from './search';

const byKey = (key: string) => SYSTEM_EXERCISES.find((e) => e.id === exerciseIdFor(key))!;
const names = (list: Exercise[]) => list.map((e) => e.name);

describe('built-in library', () => {
  it('has unique keys, ids and names', () => {
    expect(new Set(SYSTEM_EXERCISE_KEYS).size).toBe(SYSTEM_EXERCISE_KEYS.length);
    expect(new Set(SYSTEM_EXERCISES.map((e) => e.id)).size).toBe(SYSTEM_EXERCISES.length);
    expect(new Set(SYSTEM_EXERCISES.map((e) => e.name)).size).toBe(SYSTEM_EXERCISES.length);
  });

  it('keeps every key the demo data and earlier releases depend on', () => {
    for (const key of [
      'barbell-bench-press',
      'incline-dumbbell-press',
      'cable-fly',
      'dips',
      'pull-up',
      'barbell-row',
      'lat-pulldown',
      'seated-cable-row',
      'deadlift',
      'overhead-press',
      'cable-lateral-raise',
      'face-pull',
      'dumbbell-curl',
      'hammer-curl',
      'triceps-rope-pushdown',
      'overhead-triceps-extension',
      'back-squat',
      'romanian-deadlift',
      'leg-press',
      'bulgarian-split-squat',
      'lying-leg-curl',
      'hip-thrust',
      'standing-calf-raise',
      'hanging-leg-raise',
      'cable-crunch',
      'plank',
    ]) {
      expect(SYSTEM_EXERCISE_KEYS, key).toContain(key);
    }
  });

  it('covers every muscle group with compound and isolation work where it makes sense', () => {
    for (const muscle of MUSCLE_GROUPS) {
      // Adductors are a small group: the machine trains them directly, squats and lunges help.
      if (muscle === 'adductors') continue;
      const list = SYSTEM_EXERCISES.filter((e) => e.primaryMuscle === muscle);
      expect(list.length, muscle).toBeGreaterThanOrEqual(4);
    }
    for (const muscle of ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'] as const) {
      const cats = new Set(
        SYSTEM_EXERCISES.filter((e) => e.primaryMuscle === muscle).map((e) => e.category),
      );
      expect(cats, muscle).toEqual(new Set(['compound', 'isolation']));
    }
  });

  it('gives every exercise instructions and never lists the primary muscle as secondary', () => {
    for (const e of SYSTEM_EXERCISES) {
      expect(e.instructions?.length ?? 0, e.name).toBeGreaterThan(20);
      expect(e.secondaryMuscles, e.name).not.toContain(e.primaryMuscle);
      expect(e.isCustom).toBe(false);
      expect(e.origin).toBe('system');
    }
  });

  it('uses no em dashes in names or instructions', () => {
    for (const e of SYSTEM_EXERCISES) {
      expect(e.name + (e.instructions ?? ''), e.name).not.toMatch(/—/);
    }
  });
});

describe('normalize', () => {
  it('folds case, accents and punctuation', () => {
    expect(normalize('Pull-Up')).toBe('pull up');
    expect(normalize("  Farmer's   carry ")).toBe('farmer s carry');
    expect(normalize('Crème')).toBe('creme');
  });
});

describe('matchScore', () => {
  it('ranks exact > prefix > compact > word matches > metadata', () => {
    const bench = byKey('barbell-bench-press');
    expect(matchScore(bench, 'barbell bench press')).toBe(1000);
    expect(matchScore(bench, 'barbell')).toBe(800);
    expect(matchScore(byKey('pull-up'), 'pullup')).toBe(600);
    expect(matchScore(bench, 'bench')).toBeGreaterThan(matchScore(bench, 'chest'));
    expect(matchScore(bench, 'chest')).toBeGreaterThan(0);
  });

  it('requires every word to match somewhere', () => {
    expect(matchScore(byKey('barbell-bench-press'), 'bench curl')).toBe(0);
  });

  it('matches everything for an empty query', () => {
    expect(matchScore(byKey('plank'), '   ')).toBe(1);
  });
});

describe('filterExercises', () => {
  it('returns the whole library alphabetically with no filters', () => {
    const all = filterExercises(SYSTEM_EXERCISES, EMPTY_FILTERS);
    expect(all).toHaveLength(SYSTEM_EXERCISES.length);
    expect(names(all)).toEqual([...names(all)].sort((a, b) => a.localeCompare(b)));
  });

  it('puts the best name match first', () => {
    const results = filterExercises(SYSTEM_EXERCISES, { ...EMPTY_FILTERS, query: 'squat' });
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results.every((e) => normalize(e.name).includes('squat'))).toBe(true);
    expect(
      filterExercises(SYSTEM_EXERCISES, { ...EMPTY_FILTERS, query: 'leg press' })[0]?.name,
    ).toBe('Leg press');
  });

  it('filters by primary muscle, equipment and category together', () => {
    const results = filterExercises(SYSTEM_EXERCISES, {
      ...EMPTY_FILTERS,
      muscle: 'chest',
      equipment: 'dumbbell',
      category: 'isolation',
    });
    expect(names(results)).toEqual(['Dumbbell fly']);
  });

  it('separates custom from built-in exercises and skips deleted ones', () => {
    const custom: Exercise = {
      ...byKey('cable-fly'),
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Low-to-high cable fly',
      origin: 'user',
      isCustom: true,
    };
    const deleted: Exercise = {
      ...custom,
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Old fly',
      deletedAt: '2026-02-01T00:00:00.000Z',
    };
    const list = [...SYSTEM_EXERCISES, custom, deleted];
    expect(names(filterExercises(list, { ...EMPTY_FILTERS, source: 'custom' }))).toEqual([
      'Low-to-high cable fly',
    ]);
    expect(filterExercises(list, { ...EMPTY_FILTERS, source: 'library' })).toHaveLength(
      SYSTEM_EXERCISES.length,
    );
    expect(names(filterExercises(list, { ...EMPTY_FILTERS, query: 'old fly' }))).toEqual([]);
  });

  it('reports whether any filter is active', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, source: 'custom' })).toBe(true);
  });
});

describe('recent exercises', () => {
  const meta = (at: string) => ({
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    origin: 'user' as const,
  });
  const workout = (id: string, at: string, status: 'completed' | 'cancelled' | 'in_progress') => ({
    id,
    ...meta(at),
    name: 'W',
    routineId: null,
    routineDayId: null,
    status,
    startedAt: at,
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    notes: null,
    timeZone: 'UTC',
  });
  const we = (id: string, workoutId: string, key: string) => ({
    id,
    ...meta('2026-01-01T00:00:00.000Z'),
    workoutId,
    exerciseId: exerciseIdFor(key),
    exerciseName: key,
    order: 0,
    notes: null,
    target: null,
  });
  const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  it('orders by last use and ignores cancelled workouts', () => {
    const workouts = [
      workout(u(1), '2026-01-01T10:00:00.000Z', 'completed'),
      workout(u(2), '2026-01-03T10:00:00.000Z', 'completed'),
      workout(u(3), '2026-01-05T10:00:00.000Z', 'cancelled'),
      workout(u(4), '2026-01-04T10:00:00.000Z', 'in_progress'),
    ];
    const wes = [
      we(u(11), u(1), 'back-squat'),
      we(u(12), u(2), 'barbell-bench-press'),
      we(u(13), u(1), 'barbell-bench-press'),
      we(u(14), u(3), 'deadlift'),
      we(u(15), u(4), 'pull-up'),
    ];
    const usage = exerciseUsage(workouts, wes);
    expect(usage.map((x) => x.exerciseId)).toEqual([
      exerciseIdFor('pull-up'),
      exerciseIdFor('barbell-bench-press'),
      exerciseIdFor('back-squat'),
    ]);
    expect(usage[1]?.workouts).toBe(2);
    expect(names(recentExercises(SYSTEM_EXERCISES, usage, 2))).toEqual([
      'Pull-up',
      'Barbell bench press',
    ]);
  });
});

describe('gym words', () => {
  const search = (query: string) =>
    names(filterExercises(SYSTEM_EXERCISES, { ...EMPTY_FILTERS, query })).slice(0, 3);

  it('finds the adductor and abductor machines by the names people use', () => {
    expect(search('adductor')[0]).toBe('Hip adduction machine');
    expect(search('abductor')[0]).toBe('Hip abduction machine');
    expect(search('abductor machine')[0]).toBe('Hip abduction machine');
    expect(search('inner thigh')).toContain('Hip adduction machine');
  });

  it('understands common short forms', () => {
    expect(search('rdl')[0]).toBe('Romanian deadlift');
    expect(search('ohp')[0]).toBe('Overhead press');
    expect(search('db row')).toContain(byKey('one-arm-dumbbell-row').name);
  });
});
