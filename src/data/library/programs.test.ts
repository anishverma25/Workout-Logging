import { SYSTEM_EXERCISES, SYSTEM_EXERCISE_KEYS } from './exercises';
import {
  estimateMinutes,
  GOAL_SCHEMES,
  personalizeTemplate,
  recommendProgram,
  swapFor,
  type PlanOptions,
} from './programs';
import { ROUTINE_TEMPLATES, templateByKey } from './templates';

const meta = new Map(SYSTEM_EXERCISE_KEYS.map((k, i) => [k, SYSTEM_EXERCISES[i]!]));
const base: PlanOptions = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  equipment: 'full_gym',
  sessionMinutes: null,
};

describe('recommended programme', () => {
  it('follows the days a week', () => {
    const pick = (trainingDays: number, experience: PlanOptions['experience'] = 'intermediate') =>
      recommendProgram({ trainingDays, experience, goal: 'hypertrophy' })!.template.key;
    expect(pick(2)).toBe('full-body');
    expect(pick(3, 'beginner')).toBe('beginner-full-body');
    expect(pick(3)).toBe('full-body');
    expect(pick(4)).toBe('upper-lower');
    expect(pick(5)).toBe('pplul');
    expect(pick(6)).toBe('ppl');
    expect(pick(7)).toBe('ppl');
    expect(
      recommendProgram({ trainingDays: null, experience: 'beginner', goal: 'strength' }),
    ).toBeNull();
  });

  it('offers PPLUL and ULPPL as five-day options', () => {
    const r = recommendProgram({ trainingDays: 5, experience: 'advanced', goal: 'hypertrophy' })!;
    expect([r.template.key, ...r.alternatives.map((t) => t.key)]).toEqual(
      expect.arrayContaining(['pplul', 'ulppl']),
    );
  });

  it('trains every major muscle twice a week in the five-day hybrids', () => {
    for (const key of ['pplul', 'ulppl']) {
      const t = templateByKey(key)!;
      expect(t.days.flatMap((d) => d.weekdays)).toHaveLength(5);
      const hits = new Map<string, number>();
      for (const day of t.days) {
        const muscles = new Set(day.exercises.map((e) => meta.get(e.key)!.primaryMuscle));
        muscles.forEach((m) => hits.set(m, (hits.get(m) ?? 0) + 1));
      }
      for (const m of ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'biceps', 'triceps'])
        expect(hits.get(m) ?? 0, `${key} ${m}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('personalising a template', () => {
  it('uses the goal for reps, effort and rest', () => {
    const t = templateByKey('ppl')!;
    const strength = personalizeTemplate(t, { ...base, goal: 'strength' });
    const bench = strength.days[0]!.exercises[0]!;
    expect([bench.repMin, bench.repMax, bench.rest]).toEqual([3, 5, 210]);
    const muscle = personalizeTemplate(t, base);
    const lateral = muscle.days[0]!.exercises.find((e) => e.key === 'cable-lateral-raise')!;
    expect([lateral.repMin, lateral.repMax]).toEqual(
      GOAL_SCHEMES.hypertrophy.isolation.slice(0, 2),
    );
  });

  it('gives beginners fewer sets and advanced lifters more on the main lifts', () => {
    const t = templateByKey('ppl')!;
    const beginner = personalizeTemplate(t, { ...base, experience: 'beginner' });
    expect(beginner.days.flatMap((d) => d.exercises).every((e) => e.sets <= 3)).toBe(true);
    const advanced = personalizeTemplate(t, { ...base, experience: 'advanced' });
    expect(advanced.days[0]!.exercises[0]!.sets).toBe(t.days[0]!.exercises[0]!.sets + 1);
  });

  it('swaps every exercise for the equipment, never repeating one in a day', () => {
    for (const equipment of ['dumbbells', 'home'] as const) {
      for (const t of ROUTINE_TEMPLATES) {
        const p = personalizeTemplate(t, { ...base, equipment });
        for (const day of p.days) {
          const keys = day.exercises.map((e) => e.key);
          expect(new Set(keys).size, `${t.key} ${day.name}`).toBe(keys.length);
          for (const k of keys) {
            const eq = meta.get(k)!.equipment;
            const ok =
              equipment === 'dumbbells'
                ? ['dumbbell', 'bodyweight', 'kettlebell', 'band', 'other'].includes(eq)
                : ['bodyweight', 'band', 'other'].includes(eq) ||
                  ['bulgarian-split-squat', 'walking-lunge', 'step-up'].includes(k);
            expect(ok, `${equipment}: ${k} in ${t.key}`).toBe(true);
          }
          // Home has fewer movements, so a body-part day can end up shorter.
          if (t.key !== 'custom')
            expect(keys.length, `${t.key} ${day.name}`).toBeGreaterThanOrEqual(
              equipment === 'home' ? 2 : 3,
            );
        }
      }
    }
    expect(swapFor('barbell-bench-press', 'dumbbells', new Set())).toBe('dumbbell-bench-press');
    expect(swapFor('barbell-bench-press', 'home', new Set(['push-up']))).toBeNull();
  });

  it('trims a day to the session length, isolation work first', () => {
    const t = templateByKey('pplul')!;
    const short = personalizeTemplate(t, { ...base, sessionMinutes: 45 });
    for (const day of short.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(3);
      if (day.exercises.length > 3)
        expect(estimateMinutes(day.exercises)).toBeLessThanOrEqual(45 * 1.1);
    }
    const full = personalizeTemplate(t, base);
    expect(full.days[3]!.exercises.length).toBe(t.days[3]!.exercises.length);
  });
});
