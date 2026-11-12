import { describe, expect, it } from 'vitest';
import { decideWeek, proteinRange, type Change, type DecideInput, type Temporary } from './engine';
import type { WeekFacts } from './facts';
import {
  EVENT_KINDS,
  PAIN_AREAS,
  RED_FLAGS,
  needsProfessional,
  type LifeEvent,
  type PainReport,
} from './life';
import {
  EVENT_MIN_DAYS,
  KCAL_PER_KG,
  MAX_KCAL_STEP,
  MAX_SET_STEP,
  MAX_SETS_PER_EXERCISE,
  MAX_VOLUME_CHANGES,
  MIN_FOOD_DAYS,
  MIN_WEIGH_INS,
  SETS_CEILING,
  SETS_FLOOR,
  calorieFloor,
} from './limits';
import { findingFor, responseModel, setBand } from './response';
import { plannedMuscleSets, rewriteRoutine, type DayPlan, type Slot } from './rewrite';
import { emptyWeek, mondayKey, rng, week } from './sim';

/**
 * Simulation tests (plan, build order step 3): generated people with a known true body. The
 * brain has to find the truth from their logs, and no decision for any of them may step outside
 * the safety limits.
 */

const exercise = {
  name: (id: string) => id,
  keyOf: (id: string) => id,
  idOf: (key: string) => key,
};

function baseInput(weeks: WeekFacts[], over: Partial<DecideInput> = {}): DecideInput {
  return {
    nextWeekStart: mondayKey(weeks.length),
    weeks,
    model: responseModel({ weeks, recovery: [], researchMaintenance: 2400 }),
    person: {
      goal: 'fat_loss',
      experience: 'intermediate',
      weightKg: 70,
      bmrKcal: 1500,
      targetKg: null,
      ownProtein: false,
    },
    plan: { kcal: 2000, proteinG: 140, muscleSets: {}, exerciseIds: [], sessionMinutes: 60 },
    events: [],
    pains: [],
    stalls: [],
    temporaries: [],
    lastDeload: null,
    exercise,
    ...over,
  };
}

describe('the brain finds a person’s true maintenance and steers their pace', () => {
  const PEOPLE = 300;
  const WEEKS = 16;
  const results: {
    truth: number;
    formula: number;
    learned: number;
    paceOk: boolean;
    dir: 'lose' | 'gain';
  }[] = [];
  const violations: string[] = [];

  for (let p = 0; p < PEOPLE; p++) {
    const r = rng(1000 + p);
    const truth = r.between(1800, 3300);
    const formula = truth * (1 + 0.1 * r.normal());
    const cutting = r.next() < 0.7;
    const bmr = truth / r.between(1.4, 1.8);
    let weight = r.between(52, 105);
    let kcal = Math.round((cutting ? formula * 0.8 : formula * 1.1) / 50) * 50;
    kcal = Math.max(kcal, calorieFloor(bmr));
    const weeks: WeekFacts[] = [];
    const rates: number[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const intake = kcal + 60 * r.normal();
      const start = weight;
      weight += ((intake - truth) * 7) / KCAL_PER_KG;
      rates.push((weight - start) / start);
      weeks.push(
        week(w, {
          meanKcal: intake,
          // The week's mean sits near the middle of the week, with day-to-day water noise.
          meanWeightKg: (start + weight) / 2 + 0.15 * r.normal(),
          foodDays: r.next() < 0.9 ? 7 : r.int(3, 6),
          weighIns: r.next() < 0.9 ? 6 : r.int(1, 5),
        }),
      );
      const model = responseModel({ weeks, recovery: [], researchMaintenance: formula });
      const decision = decideWeek(
        baseInput(weeks, {
          model,
          person: {
            goal: cutting ? 'fat_loss' : 'hypertrophy',
            experience: 'intermediate',
            weightKg: weight,
            bmrKcal: bmr,
            targetKg: null,
            ownProtein: false,
          },
          plan: {
            kcal,
            proteinG: Math.round(weight * 1.8),
            muscleSets: {},
            exerciseIds: [],
            sessionMinutes: 60,
          },
        }),
      );
      const last = weeks.at(-1)!;
      for (const c of decision.changes) {
        if (c.kind !== 'calories') continue;
        if (c.to < calorieFloor(bmr)) violations.push(`person ${p}: ${c.to} under the floor`);
        if (c.cause === 'pace') {
          if (Math.abs(c.to - c.from) > MAX_KCAL_STEP)
            violations.push(`person ${p}: step ${c.to - c.from}`);
          if (last.foodDays < MIN_FOOD_DAYS || last.weighIns < MIN_WEIGH_INS)
            violations.push(`person ${p}: changed on thin data`);
        }
        kcal = c.to;
      }
    }
    const model = responseModel({ weeks, recovery: [], researchMaintenance: formula });
    const pace = rates.slice(-4).reduce((a, b) => a + b, 0) / 4;
    results.push({
      truth,
      formula,
      learned: model.maintenance!.value,
      dir: cutting ? 'lose' : 'gain',
      paceOk: cutting ? pace <= -0.004 && pace >= -0.011 : pace >= 0.001 && pace <= 0.005,
    });
  }

  it('never breaks a calorie limit for anyone', () => {
    expect(violations).toEqual([]);
  });

  it('learns maintenance better than the body formula', () => {
    const err = (v: number, t: number) => Math.abs(v / t - 1);
    const formulaErr = results.reduce((n, x) => n + err(x.formula, x.truth), 0) / results.length;
    const learnedErr = results.reduce((n, x) => n + err(x.learned, x.truth), 0) / results.length;
    expect(learnedErr).toBeLessThan(formulaErr * 0.6);
    const close = results.filter((x) => err(x.learned, x.truth) <= 0.1).length / results.length;
    expect(close).toBeGreaterThan(0.9);
  });

  it('brings most people to the planned pace within 16 weeks', () => {
    const cutters = results.filter((x) => x.dir === 'lose');
    const ok = cutters.filter((x) => x.paceOk).length / cutters.length;
    expect(ok).toBeGreaterThan(0.75);
    const gainers = results.filter((x) => x.dir === 'gain');
    expect(gainers.filter((x) => x.paceOk).length / gainers.length).toBeGreaterThan(0.6);
  });
});

describe('the response model finds the weekly sets a muscle answers to', () => {
  const BANDS = { low: 7, mid: 13, high: 19 } as const;

  function person(seed: number, best: keyof typeof BANDS | null) {
    const r = rng(seed);
    const order = [
      ...Array(8).fill('low'),
      ...Array(8).fill('mid'),
      ...Array(8).fill('high'),
    ] as (keyof typeof BANDS)[];
    // Shuffled in blocks of four weeks, as a real plan changes.
    const blocks = [0, 1, 2, 3, 4, 5].map((i) => order.slice(i * 4, i * 4 + 4));
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = r.int(0, i);
      [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
    }
    const plan = blocks.flat();
    const weeks: WeekFacts[] = [];
    let e1rm = 100;
    for (let w = 0; w < plan.length; w++) {
      const band = plan[w]!;
      weeks.push(
        week(w, {
          muscles: { quads: BANDS[band] + r.int(-1, 1) },
          lifts: { squat: { muscle: 'quads', e1rm, topReps: 6, sessions: 2 } },
        }),
      );
      const gain = (best === null ? 0.003 : band === best ? 0.009 : 0.001) + 0.006 * r.normal();
      e1rm *= 1 + gain;
    }
    return responseModel({ weeks, recovery: [], researchMaintenance: 2400 });
  }

  it('names the right range for people who have one, and is rarely wrong', () => {
    let claimed = 0;
    let right = 0;
    const N = 300;
    for (let p = 0; p < N; p++) {
      const best = (['low', 'mid', 'high'] as const)[p % 3]!;
      const f = findingFor(person(5000 + p, best), 'sets', 'quads')!;
      if (f.confidence === 'personal') {
        claimed += 1;
        if (f.best === best) right += 1;
      }
    }
    // The gate is strict on purpose: it would rather stay quiet than name the wrong range.
    expect(claimed / N).toBeGreaterThan(0.35);
    expect(right / claimed).toBeGreaterThan(0.97);
  });

  it('says nothing personal for people whose sets make no difference', () => {
    let claimed = 0;
    const N = 400;
    for (let p = 0; p < N; p++) {
      if (findingFor(person(9000 + p, null), 'sets', 'quads')!.confidence === 'personal')
        claimed += 1;
    }
    expect(claimed / N).toBeLessThan(0.05);
  });

  it('claims nothing in the first weeks', () => {
    const weeks = Array.from({ length: 5 }, (_, w) =>
      week(w, {
        muscles: { quads: w % 2 ? 8 : 18 },
        lifts: { squat: { muscle: 'quads', e1rm: 100 + w * 3, topReps: 5, sessions: 2 } },
      }),
    );
    const model = responseModel({ weeks, recovery: [], researchMaintenance: 2400 });
    expect(model.stage.learning).toBe(true);
    expect(model.findings.every((f) => f.confidence === 'learning' && f.best === null)).toBe(true);
    expect(setBand(8)).toBe('low');
  });
});

describe('no decision for anyone steps outside the limits', () => {
  const MUSCLES = [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
  ];
  const LIFTS: [string, string][] = [
    ['barbell-bench-press', 'chest'],
    ['overhead-press', 'shoulders'],
    ['back-squat', 'quads'],
    ['deadlift', 'hamstrings'],
    ['barbell-row', 'back'],
  ];

  function randomCase(seed: number) {
    const r = rng(seed);
    const n = r.int(1, 14);
    const weeks: WeekFacts[] = [];
    const base = Object.fromEntries(LIFTS.map(([id]) => [id, r.between(40, 160)]));
    for (let w = 0; w < n; w++) {
      if (r.next() < 0.1) {
        weeks.push(emptyWeek(w));
        continue;
      }
      for (const [id] of LIFTS) base[id]! *= 1 + 0.03 * r.normal();
      weeks.push(
        week(w, {
          sessions: r.int(0, 6),
          foodDays: r.int(0, 7),
          weighIns: r.int(0, 7),
          meanKcal: r.between(900, 4200),
          meanWeightKg: r.between(45, 120),
          medianRir: r.next() < 0.3 ? null : r.int(0, 4),
          muscles: Object.fromEntries(MUSCLES.map((m) => [m, r.int(0, 28)])),
          lifts: Object.fromEntries(
            LIFTS.filter(() => r.next() < 0.8).map(([id, muscle]) => [
              id,
              { muscle, e1rm: base[id]!, topReps: r.int(1, 10), sessions: r.int(1, 3) },
            ]),
          ),
        }),
      );
    }
    const next = mondayKey(n);
    const events: LifeEvent[] =
      r.next() < 0.4
        ? [
            {
              id: 'e',
              kind: r.pick(EVENT_KINDS),
              start: next,
              end: new Date(Date.parse(`${next}T12:00:00Z`) + r.int(0, 9) * 86_400_000)
                .toISOString()
                .slice(0, 10),
            },
          ]
        : [];
    const pains: PainReport[] =
      r.next() < 0.4
        ? [
            {
              id: 'p',
              area: r.pick(PAIN_AREAS),
              severity: r.pick(['mild', 'moderate', 'severe'] as const),
              redFlags: r.next() < 0.3 ? [r.pick(RED_FLAGS)] : [],
              date: next,
              exerciseId: null,
            },
          ]
        : [];
    const temporaries: Temporary[] =
      r.next() < 0.3
        ? [
            {
              id: 't',
              cause: r.pick(['event', 'pain', 'deload'] as const),
              until: mondayKey(n + r.int(-1, 2)),
              muscles: r.next() < 0.5 ? [r.pick(MUSCLES)] : [],
              calories: r.next() < 0.5,
              label: { en: 'Exams', hi: 'Exams' },
            },
          ]
        : [];
    const weightKg = r.next() < 0.1 ? null : r.between(45, 120);
    const bmr = r.next() < 0.15 ? null : r.between(1100, 2300);
    const input: DecideInput = {
      nextWeekStart: next,
      weeks,
      model: responseModel({
        weeks,
        recovery: [],
        researchMaintenance: r.next() < 0.15 ? null : r.between(1600, 3600),
      }),
      person: {
        goal: r.pick([
          'fat_loss',
          'hypertrophy',
          'strength',
          'recomposition',
          'general_fitness',
          'strength_hypertrophy',
        ] as const),
        experience: r.pick(['beginner', 'intermediate', 'advanced'] as const),
        weightKg,
        bmrKcal: bmr,
        targetKg: r.next() < 0.5 ? r.between(45, 110) : null,
        ownProtein: r.next() < 0.3,
      },
      plan: {
        kcal: r.next() < 0.1 ? null : Math.round(r.between(800, 4200) / 50) * 50,
        proteinG: r.next() < 0.1 ? null : r.int(30, 320),
        muscleSets: Object.fromEntries(MUSCLES.map((m) => [m, r.int(0, 26)])),
        exerciseIds: LIFTS.map(([id]) => id),
        sessionMinutes: r.int(30, 110),
      },
      events,
      pains,
      stalls:
        r.next() < 0.3
          ? [{ exerciseId: 'back-squat', cause: 'variation', variationId: 'front-squat' }]
          : [],
      temporaries,
      lastDeload: r.next() < 0.3 ? mondayKey(n - r.int(1, 8)) : null,
      exercise,
    };
    return input;
  }

  it('holds for 4,000 random people, plans and weeks', () => {
    const broken: string[] = [];
    for (let i = 0; i < 4000; i++) {
      const input = randomCase(20_000 + i);
      const d = decideWeek(input);
      const floor = calorieFloor(input.person.bmrKcal);
      const last = input.weeks.at(-1);
      const say = (m: string) => broken.push(`case ${i}: ${m}`);
      const bigEvent = input.events.some((e) => {
        const from = Math.max(Date.parse(e.start), Date.parse(input.nextWeekStart));
        const to = Math.min(Date.parse(e.end), Date.parse(input.nextWeekStart) + 6 * 86_400_000);
        return (to - from) / 86_400_000 + 1 >= EVENT_MIN_DAYS;
      });
      const ids = d.changes.map((c) => c.id);
      if (new Set(ids).size !== ids.length) say('two changes with one id');
      let volume = 0;
      for (const c of d.changes) {
        if (c.kind === 'calories') {
          if (c.to < floor) say(`calories ${c.to} under the floor ${floor}`);
          if (c.to === c.from) say('a change that changes nothing');
          if (c.cause === 'pace') {
            if (Math.abs(c.to - c.from) > MAX_KCAL_STEP) say(`calorie step ${c.to - c.from}`);
            if (!last || last.foodDays < MIN_FOOD_DAYS || last.weighIns < MIN_WEIGH_INS)
              say('calories moved on thin data');
            if (bigEvent) say('pace change during an event');
          }
          if (bigEvent && c.to < c.from) say('a deficit pushed during an event');
        }
        if (c.kind === 'protein') {
          if (input.person.ownProtein) say('own protein target changed');
          const [lo, hi] = proteinRange(input.person.goal, input.person.weightKg!);
          if (c.to < lo || c.to > hi) say(`protein ${c.to} outside ${lo} to ${hi}`);
        }
        if (c.kind === 'sets') {
          if (Math.abs(c.to - c.from) > MAX_SET_STEP) say(`sets step ${c.to - c.from}`);
          if (c.to < c.from && c.to < SETS_FLOOR) say(`sets cut to ${c.to}, under the floor`);
          if (c.to > c.from && c.to > SETS_CEILING) say(`sets ${c.to} over the ceiling`);
          if (c.cause !== 'pain') volume += 1;
          if (c.to > c.from && bigEvent) say('sets added during an event');
        }
        if (c.kind === 'deload' && bigEvent) say('deload called during an event');
        if (c.cause === 'pain' && input.pains.every(needsProfessional))
          say('trained around pain that needs a professional');
      }
      if (volume > MAX_VOLUME_CHANGES) say(`${volume} volume changes`);
      if (
        d.changes.some((c) => c.kind === 'deload') &&
        d.changes.some((c) => c.kind === 'sets' && c.cause !== 'pain')
      )
        say('deload with other volume changes');
      for (const p of input.pains)
        if (needsProfessional(p) && !d.warnings.some((w) => w.area === p.area))
          say('no warning for a red flag');
    }
    expect(broken.slice(0, 10)).toEqual([]);
  });

  it('turns every decision into routine edits that can be put back exactly', () => {
    const broken: string[] = [];
    for (let i = 0; i < 1500; i++) {
      const r = rng(70_000 + i);
      const days: DayPlan[] = Array.from({ length: r.int(2, 6) }, (_, d) => ({
        id: `d${d}`,
        perWeek: r.int(1, 2),
      }));
      const slots: Slot[] = days.flatMap((day) =>
        Array.from({ length: r.int(3, 8) }, (_, s) => {
          const [id, muscle] = r.pick(LIFTS);
          return {
            id: `${day.id}-${s}`,
            dayId: day.id,
            exerciseId: `${id}-${day.id}-${s}`,
            order: s,
            targetSets: r.int(1, 5),
            restSeconds: r.pick([60, 90, 120, 180]),
            primaryMuscle: muscle,
            secondaryMuscles: r.next() < 0.5 ? [r.pick(MUSCLES)] : [],
            category: r.next() < 0.6 ? ('compound' as const) : ('isolation' as const),
          };
        }),
      );
      const before = plannedMuscleSets(slots, days);
      const muscle = r.pick(LIFTS)[1];
      const delta = r.pick([-2, 2]);
      const from = Math.round(before[muscle] ?? 0);
      const changes: Change[] = [
        r.next() < 0.6
          ? {
              id: 's',
              kind: 'sets',
              muscle,
              from,
              to: from + delta,
              cause: 'progress',
              topic: 't',
              until: null,
              title: { en: '', hi: '' },
              reason: { en: '', hi: '' },
            }
          : r.next() < 0.5
            ? {
                id: 'd',
                kind: 'deload',
                share: 0.6,
                cause: 'deload',
                topic: 't',
                until: null,
                title: { en: '', hi: '' },
                reason: { en: '', hi: '' },
              }
            : {
                id: 'm',
                kind: 'session',
                minutes: 40,
                cause: 'event',
                topic: 't',
                until: null,
                title: { en: '', hi: '' },
                reason: { en: '', hi: '' },
              },
      ];
      const { patches, undo } = rewriteRoutine(slots, days, changes);
      const apply = (list: Slot[], ps: typeof patches) =>
        list.map((s) => {
          const p = ps.find((x) => x.slotId === s.id);
          return p
            ? {
                ...s,
                targetSets: p.targetSets ?? s.targetSets,
                exerciseId: p.exerciseId ?? s.exerciseId,
              }
            : s;
        });
      const after = apply(slots, patches);
      if (after.some((s) => s.targetSets < 1)) broken.push(`case ${i}: an exercise with no sets`);
      if (changes[0]!.kind === 'sets') {
        const moved = (plannedMuscleSets(after, days)[muscle] ?? 0) - (before[muscle] ?? 0);
        // Helping sets from other exercises can move with it, never by more than the step.
        if (Math.abs(moved) > MAX_SET_STEP + 1e-9 + 2)
          broken.push(`case ${i}: ${muscle} moved ${moved}`);
        if (Math.sign(moved) === -Math.sign(delta) && moved !== 0)
          broken.push(`case ${i}: moved the wrong way`);
        if (
          delta > 0 &&
          after.some((s, k) => s.targetSets > Math.max(MAX_SETS_PER_EXERCISE, slots[k]!.targetSets))
        )
          broken.push(`case ${i}: an exercise over ${MAX_SETS_PER_EXERCISE} sets`);
      }
      if (JSON.stringify(apply(after, undo)) !== JSON.stringify(slots))
        broken.push(`case ${i}: undo did not restore the routine`);
    }
    expect(broken.slice(0, 10)).toEqual([]);
  });
});
