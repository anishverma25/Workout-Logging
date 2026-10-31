import { SYSTEM_EXERCISES, SYSTEM_EXERCISE_KEYS } from './exercises';
import {
  estimateMinutes,
  GOAL_SCHEMES,
  personalizeTemplate,
  recommendProgram,
  swapFor,
  type PlanOptions,
} from './programs';
import { RECOMMENDED_TEMPLATES, ROUTINE_TEMPLATES, templateByKey } from './templates';

const meta = new Map(SYSTEM_EXERCISE_KEYS.map((k, i) => [k, SYSTEM_EXERCISES[i]!]));
const base: PlanOptions = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  equipment: 'full_gym',
  sessionMinutes: null,
};

describe('recommended programme', () => {
  it('follows the days a week, for every level', () => {
    const pick = (trainingDays: number, experience: PlanOptions['experience'] = 'intermediate') =>
      recommendProgram({ trainingDays, experience, goal: 'hypertrophy' })!.template.key;
    expect(pick(1)).toBe('rec-full-body-2');
    expect(pick(2)).toBe('rec-full-body-2');
    expect(pick(3, 'beginner')).toBe('rec-full-body-3');
    expect(pick(3, 'advanced')).toBe('rec-full-body-3');
    expect(pick(4)).toBe('rec-full-body-4');
    expect(pick(5)).toBe('rec-ul-ppl-5');
    expect(pick(6)).toBe('rec-upper-lower-6');
    expect(pick(7)).toBe('rec-upper-lower-6');
    expect(
      recommendProgram({ trainingDays: null, experience: 'beginner', goal: 'strength' }),
    ).toBeNull();
  });

  it('plans the days the way each split asks', () => {
    const weekdays = (key: string) =>
      Object.fromEntries(templateByKey(key)!.days.map((d) => [d.name, d.weekdays]));
    expect(weekdays('rec-upper-lower-6')).toEqual({
      'Upper 1': [1, 5],
      'Lower 1': [2, 6],
      'Upper 2': [3],
      'Lower 2': [4],
    });
    // Every other day: Monday, Wednesday, Friday, Sunday.
    expect(weekdays('rec-full-body-4')).toEqual({
      'Full body A': [1, 5],
      'Full body B': [3, 0],
    });
  });

  it('trains every muscle group at least twice a week in every recommended plan', () => {
    const groups = [
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'quads',
      'hamstrings',
      'glutes',
      'adductors',
      'calves',
      'abs',
    ];
    for (const t of RECOMMENDED_TEMPLATES) {
      const sessions = t.days.flatMap((d) => d.weekdays);
      expect(new Set(sessions).size, t.key).toBe(sessions.length);
      expect(sessions.length, t.key).toBe(t.daysPerWeek);
      const hits = new Map<string, number>();
      for (const day of t.days) {
        const muscles = new Set(
          day.exercises.flatMap((e) => {
            const m = meta.get(e.key);
            expect(m, `${t.key} ${e.key}`).toBeDefined();
            return [m!.primaryMuscle, ...m!.secondaryMuscles];
          }),
        );
        muscles.forEach((m) => hits.set(m, (hits.get(m) ?? 0) + day.weekdays.length));
      }
      for (const m of groups) expect(hits.get(m) ?? 0, `${t.key} ${m}`).toBeGreaterThanOrEqual(2);
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
