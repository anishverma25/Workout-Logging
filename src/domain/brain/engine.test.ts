import { buildData } from '@/test/fixtures';
import { describe, expect, it } from 'vitest';
import { buildSessions } from '../analytics/sessions';
import { decideWeek, type DecideInput } from './engine';
import { buildWeekFacts, recoverySamples, type WeekFacts } from './facts';
import { daysInWeek, weekAfter } from './life';
import { maintenanceEstimate, responseModel, shrink } from './response';
import { longestSession, plannedMuscleSets, rewriteRoutine, type Slot } from './rewrite';
import { mondayKey, week } from './sim';
import { whatIf } from './whatIf';

const exercise = {
  name: (id: string) => id,
  keyOf: (id: string) => id,
  idOf: (key: string) => key,
};

function input(weeks: WeekFacts[], over: Partial<DecideInput> = {}): DecideInput {
  return {
    nextWeekStart: mondayKey(weeks.length),
    weeks,
    model: responseModel({ weeks, recovery: [], researchMaintenance: 2300 }),
    person: {
      goal: 'fat_loss',
      experience: 'intermediate',
      weightKg: 64,
      bmrKcal: 1400,
      targetKg: null,
      ownProtein: false,
    },
    plan: { kcal: 1800, proteinG: 130, muscleSets: {}, exerciseIds: [], sessionMinutes: 70 },
    events: [],
    pains: [],
    stalls: [],
    temporaries: [],
    lastDeload: null,
    exercise,
    ...over,
  };
}

/** Riya: 64 kg, cutting on 1,800 kcal, weight moving `perWeek` kg a week. */
const riya = (perWeek: number, n = 6, over: (w: number) => Partial<WeekFacts> = () => ({})) =>
  Array.from({ length: n }, (_, w) =>
    week(w, { meanKcal: 1800, meanWeightKg: 64 + perWeek * w, ...over(w) }),
  );

describe('calories', () => {
  it('lowers a cut that is too slow, by at most 150 kcal', () => {
    const d = decideWeek(input(riya(-0.05)));
    const c = d.changes.find((x) => x.kind === 'calories');
    expect(c).toMatchObject({ from: 1800, to: 1650, cause: 'pace' });
    expect(c!.reason.en).toContain('fell 0.1% a week');
  });

  it('raises a cut that is too fast', () => {
    const c = decideWeek(input(riya(-0.9))).changes.find((x) => x.kind === 'calories');
    expect(c).toMatchObject({ from: 1800, to: 1950 });
  });

  it('holds when the pace is inside 0.5 to 1% a week', () => {
    const d = decideWeek(input(riya(-0.45)));
    expect(d.changes.find((x) => x.kind === 'calories')).toBeUndefined();
    expect(d.holds[0]!.reason.en).toContain('planned pace');
  });

  it('holds and says why without 5 food days and 4 weigh-ins', () => {
    const weeks = riya(-0.05, 6, (w) => (w === 5 ? { foodDays: 4, weighIns: 2 } : {}));
    const d = decideWeek(input(weeks));
    expect(d.changes.find((x) => x.kind === 'calories')).toBeUndefined();
    expect(d.holds[0]!.reason.en).toContain('this week had 4 and 2');
  });

  it('does not chase a target the person is not eating', () => {
    const weeks = riya(-0.05, 6, () => ({ meanKcal: 2150 }));
    const d = decideWeek(input(weeks));
    expect(d.changes.find((x) => x.kind === 'calories')).toBeUndefined();
    expect(d.holds[0]!.reason.en).toContain('You ate about 2,150');
  });

  it('never goes under the floor, and lifts a target that is already under it', () => {
    const atFloor = decideWeek(
      input(riya(-0.05), {
        plan: { kcal: 1400, proteinG: 130, muscleSets: {}, exerciseIds: [], sessionMinutes: 60 },
      }),
    );
    expect(atFloor.changes.find((x) => x.kind === 'calories')).toBeUndefined();
    const weeks = riya(-0.05, 6, () => ({ meanKcal: 1400 }));
    const under = decideWeek(
      input(weeks, {
        plan: { kcal: 1000, proteinG: 130, muscleSets: {}, exerciseIds: [], sessionMinutes: 60 },
      }),
    );
    expect(under.changes.find((x) => x.kind === 'calories')).toMatchObject({
      to: 1400,
      cause: 'floor',
    });
  });
});

describe('what is coming up', () => {
  const exams = { id: 'e1', kind: 'exams' as const, start: mondayKey(6) };

  it('exam week: maintenance calories and short sessions, both temporary', () => {
    const weeks = riya(-0.45);
    const d = decideWeek(input(weeks, { events: [{ ...exams, end: weekEnd(6) }] }));
    const calories = d.changes.find((x) => x.kind === 'calories')!;
    const m =
      Math.round(
        responseModel({ weeks, recovery: [], researchMaintenance: 2300 }).maintenance!.value / 50,
      ) * 50;
    expect(calories).toMatchObject({ from: 1800, to: m, cause: 'event', until: mondayKey(7) });
    expect(d.changes.find((x) => x.kind === 'session')).toMatchObject({
      minutes: 40,
      until: mondayKey(7),
    });
  });

  it('a vrat never brings a deficit or added work, and suggests foods', () => {
    const d = decideWeek(
      input(riya(-0.05), {
        events: [{ id: 'v', kind: 'vrat', start: mondayKey(6), end: weekEnd(6) }],
        plan: {
          kcal: 1800,
          proteinG: 130,
          muscleSets: { quads: 8 },
          exerciseIds: [],
          sessionMinutes: 60,
        },
      }),
    );
    expect(d.changes.every((c) => c.kind !== 'sets' && c.kind !== 'deload')).toBe(true);
    expect(d.changes.find((x) => x.kind === 'calories')!).toMatchObject({ cause: 'event' });
    expect(d.notes.some((n) => n.en.includes('Sabudana'))).toBe(true);
  });

  it('a two day event changes nothing and says so', () => {
    const d = decideWeek(
      input(riya(-0.45), {
        events: [
          { id: 't', kind: 'travel', start: mondayKey(6), end: mondayKey(6).slice(0, 8) + '17' },
        ],
      }),
    );
    expect(d.changes).toEqual([]);
    expect(d.notes.some((n) => n.en.includes('Travel is in this week'))).toBe(true);
  });

  it('counts the days of a week an event covers', () => {
    expect(daysInWeek({ start: '2026-11-12', end: '2026-11-20' }, '2026-11-09')).toBe(4);
    expect(daysInWeek({ start: '2026-11-01', end: '2026-11-08' }, '2026-11-09')).toBe(0);
    expect(weekAfter({ end: '2026-11-15' }, '2026-11-09')).toBe('2026-11-16');
    expect(weekAfter({ end: '2026-11-16' }, '2026-11-09')).toBe('2026-11-23');
    // A person whose weeks start on Sunday.
    expect(weekAfter({ end: '2026-11-14' }, '2026-11-08')).toBe('2026-11-15');
  });

  function weekEnd(index: number) {
    return new Date(Date.parse(`${mondayKey(index)}T12:00:00Z`) + 6 * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
});

describe('something hurts', () => {
  const plan = {
    kcal: 1800,
    proteinG: 130,
    muscleSets: { shoulders: 12, chest: 14 },
    exerciseIds: ['overhead-press', 'barbell-bench-press', 'back-squat'],
    sessionMinutes: 60,
  };

  it('a mild shoulder swaps the lifts that load it and trims its sets for 2 weeks', () => {
    const d = decideWeek(
      input(riya(-0.45), {
        plan,
        pains: [
          {
            id: 'p',
            area: 'shoulder',
            severity: 'mild',
            redFlags: [],
            date: mondayKey(5),
            exerciseId: 'overhead-press',
          },
        ],
      }),
    );
    expect(d.changes.filter((c) => c.kind === 'swap')).toMatchObject([
      {
        fromExerciseId: 'overhead-press',
        toExerciseId: 'machine-shoulder-press',
        until: mondayKey(8),
      },
      { fromExerciseId: 'barbell-bench-press', toExerciseId: 'machine-chest-press' },
    ]);
    expect(d.changes.filter((c) => c.kind === 'sets')).toMatchObject([
      { muscle: 'shoulders', from: 12, to: 10, cause: 'pain', until: mondayKey(8) },
      { muscle: 'chest', from: 14, to: 12 },
    ]);
    expect(d.notes.some((n) => n.en.includes('not medical advice'))).toBe(true);
  });

  it('a red flag stops the plan around it and points to a professional', () => {
    const d = decideWeek(
      input(riya(-0.45), {
        plan,
        pains: [
          {
            id: 'p',
            area: 'knee',
            severity: 'mild',
            redFlags: ['swelling'],
            date: mondayKey(5),
            exerciseId: null,
          },
        ],
      }),
    );
    expect(d.changes).toEqual([]);
    expect(d.warnings[0]!.text.en).toContain('doctor or physiotherapist');
  });
});

describe('training', () => {
  const lifts = (bench: number, squat: number) => ({
    bench: { muscle: 'chest', e1rm: bench, topReps: 6, sessions: 2 },
    squat: { muscle: 'quads', e1rm: squat, topReps: 5, sessions: 2 },
  });

  it('adds 2 sets to a muscle whose lifts have not moved, when the work is being done', () => {
    const weeks = Array.from({ length: 6 }, (_, w) =>
      week(w, {
        meanKcal: 2300,
        meanWeightKg: 70,
        muscles: { chest: 8, quads: 14 },
        lifts: lifts(100, 140 + w * 2),
      }),
    );
    const d = decideWeek(
      input(weeks, {
        person: {
          goal: 'hypertrophy',
          experience: 'intermediate',
          weightKg: 70,
          bmrKcal: 1600,
          targetKg: null,
          ownProtein: false,
        },
        plan: {
          kcal: 2300,
          proteinG: 130,
          muscleSets: { chest: 8, quads: 14 },
          exerciseIds: [],
          sessionMinutes: 60,
        },
      }),
    );
    expect(d.changes.filter((c) => c.kind === 'sets')).toMatchObject([
      { muscle: 'chest', from: 8, to: 10, cause: 'progress' },
    ]);
  });

  it('adds nothing when the planned sets are not being done', () => {
    const weeks = Array.from({ length: 6 }, (_, w) =>
      week(w, { meanKcal: 2300, meanWeightKg: 70, muscles: { chest: 4 }, lifts: lifts(100, 140) }),
    );
    const d = decideWeek(
      input(weeks, {
        person: {
          goal: 'hypertrophy',
          experience: 'intermediate',
          weightKg: 70,
          bmrKcal: 1600,
          targetKg: null,
          ownProtein: false,
        },
        plan: {
          kcal: 2300,
          proteinG: 130,
          muscleSets: { chest: 10 },
          exerciseIds: [],
          sessionMinutes: 60,
        },
      }),
    );
    expect(d.changes.filter((c) => c.kind === 'sets')).toEqual([]);
  });

  it('calls one lighter week when two lifts drop in a deficit, and not again within 4 weeks', () => {
    const weeks = Array.from({ length: 6 }, (_, w) =>
      week(w, {
        meanKcal: 1700,
        meanWeightKg: 70 - w * 0.5,
        muscles: { chest: 12, quads: 12 },
        lifts: w >= 4 ? lifts(94, 131) : lifts(100, 140),
      }),
    );
    const d = decideWeek(
      input(weeks, {
        plan: {
          kcal: 1700,
          proteinG: 150,
          muscleSets: { chest: 12, quads: 12 },
          exerciseIds: [],
          sessionMinutes: 60,
        },
      }),
    );
    expect(d.changes.find((c) => c.kind === 'deload')).toMatchObject({
      share: 0.6,
      until: mondayKey(7),
    });
    expect(d.changes.some((c) => c.kind === 'sets')).toBe(false);
    const again = decideWeek(
      input(weeks, {
        lastDeload: mondayKey(4),
        plan: {
          kcal: 1700,
          proteinG: 150,
          muscleSets: { chest: 12, quads: 12 },
          exerciseIds: [],
          sessionMinutes: 60,
        },
      }),
    );
    expect(again.changes.some((c) => c.kind === 'deload')).toBe(false);
  });

  it('puts a temporary change back when its time is up, and adds nothing that week', () => {
    const weeks = Array.from({ length: 6 }, (_, w) =>
      week(w, { meanKcal: 2300, muscles: { chest: 8 }, lifts: lifts(100, 140) }),
    );
    const d = decideWeek(
      input(weeks, {
        plan: {
          kcal: 2300,
          proteinG: 130,
          muscleSets: { chest: 8 },
          exerciseIds: [],
          sessionMinutes: 60,
        },
        temporaries: [
          {
            id: 't1',
            cause: 'deload',
            until: mondayKey(6),
            muscles: [],
            calories: false,
            label: { en: 'A lighter week', hi: 'Ek halka hafta' },
          },
        ],
      }),
    );
    expect(d.changes.filter((c) => c.kind !== 'calories').map((c) => c.kind)).toEqual(['restore']);
  });

  it('rotates a lift that stalled for want of a new stimulus', () => {
    const d = decideWeek(
      input(riya(-0.45), {
        plan: {
          kcal: 1800,
          proteinG: 130,
          muscleSets: {},
          exerciseIds: ['back-squat'],
          sessionMinutes: 60,
        },
        stalls: [
          { exerciseId: 'back-squat', cause: 'variation', variationId: 'front-squat' },
          { exerciseId: 'deadlift', cause: 'effort' },
        ],
      }),
    );
    expect(d.changes.filter((c) => c.kind === 'swap')).toMatchObject([
      { fromExerciseId: 'back-squat', toExerciseId: 'front-squat', cause: 'stall', until: null },
    ]);
  });

  it('keeps protein inside the range unless the target is the person’s own', () => {
    const low = decideWeek(
      input(riya(-0.45), {
        plan: { kcal: 1800, proteinG: 70, muscleSets: {}, exerciseIds: [], sessionMinutes: 60 },
      }),
    );
    expect(low.changes.find((c) => c.kind === 'protein')).toMatchObject({ from: 70, to: 105 });
    const own = decideWeek(
      input(riya(-0.45), {
        person: {
          goal: 'fat_loss',
          experience: 'intermediate',
          weightKg: 64,
          bmrKcal: 1400,
          targetKg: null,
          ownProtein: true,
        },
        plan: { kcal: 1800, proteinG: 70, muscleSets: {}, exerciseIds: [], sessionMinutes: 60 },
      }),
    );
    expect(own.changes.find((c) => c.kind === 'protein')).toBeUndefined();
  });

  it('says it is still learning in the first weeks', () => {
    const d = decideWeek(input(riya(-0.45, 3)));
    expect(d.notes.at(-1)!.en).toBe(
      'Learning your patterns, week 3 of 6. Until then the plan uses research defaults.',
    );
  });
});

describe('maintenance and blending', () => {
  it('reads maintenance from intake and the weight trend', () => {
    // Eating 2,000 and losing 0.5 kg a week: 2,000 + 0.5 × 7,700 ÷ 7 = 2,550.
    const weeks = Array.from({ length: 8 }, (_, w) =>
      week(w, { meanKcal: 2000, meanWeightKg: 80 - 0.5 * w }),
    );
    const est = maintenanceEstimate(weeks, 2300)!;
    expect(est.own).toBeCloseTo(2550, 0);
    expect(est.confidence).toBe('personal');
    expect(est.value).toBeCloseTo(shrink(2550, 8, 2300), 5);
    expect(est.value).toBeGreaterThan(2450);
  });

  it('stays on the research default until there are complete weeks', () => {
    const weeks = Array.from({ length: 4 }, (_, w) => week(w, { weighIns: 2 }));
    expect(maintenanceEstimate(weeks, 2300)).toMatchObject({
      value: 2300,
      own: null,
      confidence: 'research',
    });
    expect(maintenanceEstimate(weeks, null)).toBeNull();
  });
});

describe('the programme rewrite', () => {
  const slot = (
    id: string,
    dayId: string,
    exerciseId: string,
    targetSets: number,
    primaryMuscle: string,
    category: Slot['category'] = 'compound',
    order = 0,
  ): Slot => ({
    id,
    dayId,
    exerciseId,
    order,
    targetSets,
    restSeconds: 120,
    primaryMuscle,
    secondaryMuscles: [],
    category,
  });
  const days = [
    { id: 'push', perWeek: 1 },
    { id: 'legs', perWeek: 1 },
  ];
  const slots = [
    slot('a', 'push', 'bench', 3, 'chest', 'compound', 0),
    slot('b', 'push', 'fly', 3, 'chest', 'isolation', 1),
    slot('c', 'push', 'pushdown', 4, 'triceps', 'isolation', 2),
    slot('d', 'legs', 'squat', 4, 'quads', 'compound', 0),
  ];
  const base = {
    cause: 'progress' as const,
    topic: 't',
    until: null,
    title: { en: '', hi: '' },
    reason: { en: '', hi: '' },
  };

  it('spreads 2 more sets over the muscle’s exercises', () => {
    const r = rewriteRoutine(slots, days, [
      { ...base, id: 's', kind: 'sets', muscle: 'chest', from: 6, to: 8 },
    ]);
    expect(r.patches).toEqual([
      { slotId: 'a', targetSets: 4 },
      { slotId: 'b', targetSets: 4 },
    ]);
    expect(r.undo).toEqual([
      { slotId: 'a', targetSets: 3 },
      { slotId: 'b', targetSets: 3 },
    ]);
    expect(plannedMuscleSets(slots, days)).toMatchObject({ chest: 6, triceps: 4, quads: 4 });
  });

  it('reports a change it cannot make', () => {
    const r = rewriteRoutine(slots, days, [
      { ...base, id: 's', kind: 'sets', muscle: 'calves', from: 0, to: 2 },
    ]);
    expect(r.unapplied).toEqual(['s']);
  });

  it('a lighter week keeps every exercise and trims its sets', () => {
    const r = rewriteRoutine(slots, days, [{ ...base, id: 'd', kind: 'deload', share: 0.6 }]);
    expect(r.patches).toEqual([
      { slotId: 'a', targetSets: 2 },
      { slotId: 'b', targetSets: 2 },
      { slotId: 'c', targetSets: 2 },
      { slotId: 'd', targetSets: 2 },
    ]);
  });

  it('short sessions trim the extras first', () => {
    expect(longestSession(slots)).toBe(27);
    const r = rewriteRoutine(slots, days, [{ ...base, id: 'm', kind: 'session', minutes: 20 }]);
    expect(r.patches).toEqual([
      { slotId: 'b', targetSets: 2 },
      { slotId: 'c', targetSets: 2 },
    ]);
  });
});

describe('try a different plan', () => {
  const weeks = Array.from({ length: 8 }, (_, w) =>
    week(w, {
      meanKcal: 2000,
      meanWeightKg: 80 - 0.5 * w,
      lifts: { squat: { muscle: 'quads', e1rm: 100 * 1.01 ** w, topReps: 5, sessions: 2 } },
    }),
  );
  const model = responseModel({ weeks, recovery: [], researchMaintenance: 2550 });

  it('projects weight from the calories and the person’s maintenance', () => {
    const r = whatIf({ model, weightKg: 76.5, bmrKcal: 1700, kcal: 2000, lift: null });
    expect(r.weight!.perWeek).toBeCloseTo(-0.5, 2);
    expect(r.weight!.mid).toBeCloseTo(72.5, 1);
    expect(r.weight!.lo).toBeLessThan(r.weight!.mid);
    expect(r.weight!.hi).toBeGreaterThan(r.weight!.mid);
  });

  it('continues the lift’s own trend, and refuses calories under the floor', () => {
    const r = whatIf({
      model,
      weightKg: 76.5,
      bmrKcal: 1700,
      kcal: 1500,
      lift: { exerciseId: 'squat', muscle: 'quads', sets: 12 },
    });
    expect(r.allowed).toBe(false);
    expect(r.floor).toBe(1700);
    expect(r.lift!.mid / r.lift!.now).toBeCloseTo(1.01 ** 8, 3);
    expect(r.lift!.personal).toBe(false);
  });
});

describe('facts from real logs', () => {
  it('builds weeks of facts from sessions, food and weigh-ins', () => {
    const specs = [];
    for (let w = 0; w < 3; w++)
      for (const d of [0, 2]) {
        const at = new Date(2026, 9, 5 + w * 7 + d, 18);
        specs.push({
          at: at.toISOString(),
          name: 'Push',
          minutes: 60,
          exercises: [
            {
              key: 'barbell-bench-press',
              sets: [
                { w: 80 + w * 2.5, r: 5, rir: 2 },
                { w: 80 + w * 2.5, r: 5, rir: 1 },
              ],
            },
          ],
        });
      }
    const sessions = buildSessions(buildData(specs));
    const food = Array.from({ length: 21 }, (_, i) => {
      const d = new Date(2026, 9, 5 + i);
      return {
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        kcal: i % 7 === 6 ? 500 : 2100,
        proteinG: 120,
      };
    });
    const weights = Array.from({ length: 21 }, (_, i) => ({
      measuredAt: new Date(2026, 9, 5 + i, 7).toISOString(),
      weightKg: 70,
    }));
    const weeks = buildWeekFacts({
      sessions,
      food,
      weights,
      from: new Date(2026, 9, 5),
      to: new Date(2026, 9, 25),
    });
    expect(weeks).toHaveLength(3);
    expect(weeks[0]).toMatchObject({
      weekStart: '2026-10-05',
      sessions: 2,
      foodDays: 6,
      meanKcal: 2100,
      weighIns: 7,
      meanWeightKg: 70,
      medianRir: 1.5,
    });
    expect(weeks[0]!.muscles.chest).toBe(4);
    expect(weeks[0]!.muscles.triceps).toBe(2);
    const lift = Object.values(weeks[2]!.lifts)[0]!;
    expect(lift).toMatchObject({ muscle: 'chest', topReps: 5, sessions: 2 });
    expect(lift.e1rm).toBeCloseTo(85 * (1 + 5 / 30), 5);
    const rec = recoverySamples(sessions);
    expect(rec).toHaveLength(5);
    expect(rec[0]).toMatchObject({ muscle: 'chest', gapDays: 2, change: 0 });
  });
});
