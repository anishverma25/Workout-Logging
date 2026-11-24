import type { Session } from '@/domain/analytics/sessions';
import { detailedVolume } from './volume';
import { EMPTY_FILTERS, filterExercises } from '@/domain/exercises/search';
import { SYSTEM_EXERCISES, SYSTEM_EXERCISE_KEYS } from '@/data/library/exercises';
import { MUSCLE_GROUPS } from '@/domain/models/schemas';
import { EXERCISE_TARGETS, targetsFor, worksMuscle } from './targets';
import { MUSCLES, MUSCLE_BY_ID, MUSCLE_COUNTS, groupOf, within } from './taxonomy';

describe('the muscle taxonomy', () => {
  it('has one record per muscle, each with a parent one level up', () => {
    expect(new Set(MUSCLES.map((m) => m.id)).size).toBe(MUSCLES.length);
    for (const m of MUSCLES) {
      if (m.level === 1) {
        expect(m.parent, m.id).toBeNull();
        continue;
      }
      const parent = MUSCLE_BY_ID.get(m.parent!);
      expect(parent, m.id).toBeDefined();
      expect(parent!.level, m.id).toBe(m.level - 1);
      for (const g of m.alsoIn ?? []) expect(MUSCLE_BY_ID.get(g)?.level, `${m.id} in ${g}`).toBe(2);
    }
    // No two muscles share a gym name or an anatomical name.
    const level3 = MUSCLES.filter((m) => m.level === 3);
    expect(new Set(level3.map((m) => m.name)).size).toBe(level3.length);
  });

  it('covers 8 regions, the gym groups and the anatomical muscles asked for', () => {
    expect(MUSCLE_COUNTS.regions).toBe(8);
    expect(MUSCLE_COUNTS.groups).toBeGreaterThanOrEqual(20);
    expect(MUSCLE_COUNTS.muscles).toBe(88);
    for (const id of [
      'pec-clavicular',
      'trap-lower',
      'serratus-anterior',
      'delt-rear',
      'subscapularis',
      'biceps-long',
      'brachialis',
      'triceps-long',
      'wrist-extensors',
      'quadratus-lumborum',
      'glute-med',
      'psoas',
      'piriformis',
      'rectus-femoris',
      'biceps-femoris-short',
      'soleus',
      'tibialis-anterior',
      'fibularis',
      'sternocleidomastoid',
      'splenius',
    ])
      expect(MUSCLE_BY_ID.has(id), id).toBe(true);
  });

  it('keeps the app’s 12 stored groups: every group says which it counts toward', () => {
    for (const g of MUSCLES.filter((m) => m.level === 2)) {
      expect(g.legacy === null || MUSCLE_GROUPS.includes(g.legacy!), g.id).toBe(true);
    }
  });

  it('a muscle in two groups is found from both, and counted once', () => {
    expect(within('hip-flexors').has('rectus-femoris')).toBe(true);
    expect(within('quads').has('rectus-femoris')).toBe(true);
    expect(groupOf('rectus-femoris')?.id).toBe('quads');
    expect(MUSCLES.filter((m) => m.id === 'rectus-femoris')).toHaveLength(1);
  });
});

const NO_STORED_GROUP = [
  'Seated wrist curl',
  'Reverse wrist curl',
  'Wrist pronation',
  'Neck flexion',
  'Neck extension',
  'Barbell wrist curl',
  'Cable wrist curl',
  'Reverse barbell wrist curl',
  'Reverse cable wrist curl',
  'Wrist roller',
  'Plate pinch hold',
];

describe('what each exercise works', () => {
  it('every library exercise has been reviewed, and names only real muscles', () => {
    expect(Object.keys(EXERCISE_TARGETS).sort()).toEqual([...SYSTEM_EXERCISE_KEYS].sort());
    for (const [key, t] of Object.entries(EXERCISE_TARGETS)) {
      for (const id of [...t.primary, ...t.secondary, ...t.stabilizers]) {
        expect(MUSCLE_BY_ID.get(id)?.level, `${key}: ${id}`).toBe(3);
      }
      // Never in two lists at once.
      const all = [...t.primary, ...t.secondary, ...t.stabilizers];
      expect(new Set(all).size, key).toBe(all.length);
    }
  });

  it('agrees with each exercise’s stored main muscle group', () => {
    for (const e of SYSTEM_EXERCISES) {
      const t = targetsFor(e);
      if (e.primaryMuscle === 'cardio') {
        expect(t.primary, e.name).toEqual([]);
        continue;
      }
      expect(t.primary.length, e.name).toBeGreaterThan(0);
      const legacy = new Set(
        [...t.primary, ...t.secondary].map((m) => groupOf(m)?.legacy).filter(Boolean),
      );
      // Forearm, neck and hip-flexor exercises work no muscle in the 12 stored groups: they are
      // stored under the nearest one and listed here on purpose (docs/muscles.md).
      if (legacy.size === 0) {
        expect(NO_STORED_GROUP, e.name).toContain(e.name);
        continue;
      }
      expect(legacy.has(e.primaryMuscle), `${e.name}: ${e.primaryMuscle}`).toBe(true);
    }
  });

  it('finds exercises for the detailed searches people use', () => {
    const works = (id: string) =>
      SYSTEM_EXERCISES.filter((e) => worksMuscle(targetsFor(e), id) === 2).map((e) => e.name);
    expect(works('pec-clavicular')).toContain('Incline barbell bench press');
    expect(works('trap-lower')).toContain('Chest-supported row');
    expect(works('delt-rear')).toContain('Reverse pec deck');
    expect(works('biceps-long')).toContain('Incline dumbbell curl');
    expect(works('brachialis')).toContain('Hammer curl');
    expect(works('triceps-long')).toContain('Overhead triceps extension');
    expect(works('rectus-femoris')).toContain('Leg extension');
    expect(works('glute-med')).toContain('Hip abduction machine');
    expect(works('hip-flexors')).toContain('Hanging leg raise');
    expect(works('adductors')).toContain('Hip adduction machine');
    expect(works('soleus')).toContain('Seated calf raise');
    // The serratus is trained as a helper, never alone: found among the assistants.
    expect(
      SYSTEM_EXERCISES.filter((e) => worksMuscle(targetsFor(e), 'serratus-anterior') === 1).length,
    ).toBeGreaterThan(3);
  });

  it('your own exercises keep the groups you chose, with no head guessed', () => {
    const t = targetsFor({ id: 'x', primaryMuscle: 'chest', secondaryMuscles: ['triceps'] });
    expect(t.primary).toEqual(['pecs']);
    expect(t.secondary).toEqual(['triceps']);
    expect(worksMuscle(t, 'chest')).toBe(2);
    expect(worksMuscle(t, 'pec-clavicular')).toBe(0);
  });
});

describe('searching exercises by muscle', () => {
  const search = (q: string) =>
    filterExercises(SYSTEM_EXERCISES, { ...EMPTY_FILTERS, query: q }).map((e) => e.name);

  it('muscle names, gym words and partial words find the exercises that train them', () => {
    expect(search('upper chest')[0]).toMatch(/^Incline/);
    expect(search('rear delts')[0]).toMatch(/[Rr]ear delt|Reverse pec deck|Face pull/);
    expect(search('biceps long head').slice(0, 4)).toContain('Incline dumbbell curl');
    expect(search('soleus')[0]).toBe('Seated calf raise');
    expect(search('lower traps').length).toBeGreaterThan(0);
    expect(search('glute med').slice(0, 3)).toContain('Hip abduction machine');
    expect(search('brachial').slice(0, 3)).toContain('Hammer curl');
  });

  it('an exercise typed by name still comes first', () => {
    expect(search('hammer curl')[0]).toBe('Hammer curl');
    expect(search('leg extension')[0]).toBe('Leg extension');
  });

  it('the advanced filter keeps only exercises that work the muscle, main work first', () => {
    const list = filterExercises(SYSTEM_EXERCISES, { ...EMPTY_FILTERS, detail: 'triceps-long' });
    expect(list.length).toBeGreaterThan(3);
    expect(worksMuscle(targetsFor(list[0]!), 'triceps-long')).toBe(2);
  });
});

describe('sets per muscle in detail', () => {
  const ex = (name: string) => SYSTEM_EXERCISES.find((e) => e.name === name)!;
  const set = (rir: number | null = 2) =>
    ({ completedAt: '2026-11-20T10:00:00.000Z', setType: 'normal', rir, rpe: null }) as never;
  const session = (items: [string, number][]) =>
    ({
      workout: {} as never,
      date: new Date('2026-11-20'),
      exercises: items.map(([name, n]) => ({
        workoutExercise: {} as never,
        exercise: ex(name),
        sets: Array.from({ length: n }, () => set()),
      })),
    }) as Session;

  it('groups count direct sets fully and supporting sets at half; heads only direct sets', () => {
    const v = detailedVolume([
      session([
        ['Barbell bench press', 3],
        ['Triceps rope pushdown', 3],
      ]),
    ]);
    const by = new Map(v.map((g) => [g.group, g]));
    expect(by.get('pecs')).toMatchObject({ direct: 3, indirect: 0, weighted: 3 });
    // Bench helps the triceps (3 indirect), pushdowns train them (3 direct).
    expect(by.get('triceps')).toMatchObject({ direct: 3, indirect: 3, weighted: 4.5 });
    const heads = new Map(by.get('triceps')!.muscles.map((m) => [m.id, m.direct]));
    expect(heads.get('triceps-lateral')).toBe(3);
    // The pushdown only assists the long head: no direct set is credited to it.
    expect(heads.get('triceps-long')).toBeUndefined();
    // Stabilizers are never counted.
    expect(by.get('rotator-cuff')).toBeUndefined();
  });

  it('easy sets (5+ reps left) and warm-ups do not count, as everywhere else', () => {
    const s = session([['Leg extension', 2]]);
    s.exercises[0]!.sets.push({ ...(set(6) as object), setType: 'normal' } as never);
    s.exercises[0]!.sets.push({ ...(set(2) as object), setType: 'warmup' } as never);
    expect(detailedVolume([s]).find((g) => g.group === 'quads')?.direct).toBe(2);
  });
});
