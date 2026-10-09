import type { BodyMeasurement, BodyWeightEntry } from '../models/schemas';
import {
  LIFESTYLE_PAL,
  trainingKcalPerDay,
  bmi,
  bodySnapshot,
  bmiBand,
  bmrKatch,
  bmrMifflin,
  energyPlan,
  ffmi,
  latestMeasurements,
  leanMassKg,
  navyBodyFat,
  normalizedFfmi,
  rateVerdict,
  weeklyRate,
  weightTrend,
} from './body';

const entry = (day: number, kg: number): BodyWeightEntry => ({
  id: crypto.randomUUID(),
  createdAt: new Date(2026, 8, day).toISOString(),
  updatedAt: new Date(2026, 8, day).toISOString(),
  deletedAt: null,
  origin: 'user',
  measuredAt: new Date(2026, 8, day, 7).toISOString(),
  weightKg: kg,
  enteredUnit: 'kg',
  note: null,
});

describe('BMI', () => {
  it('is kg over metres squared, with WHO and Asian bands', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.857, 3);
    expect(bmiBand(24)).toBe('healthy');
    expect(bmiBand(24, true)).toBe('over');
    expect(bmiBand(17)).toBe('under');
    expect(bmiBand(31)).toBe('obese');
    expect(bmiBand(28, true)).toBe('obese');
  });
});

describe('US Navy body fat', () => {
  it('matches the published formula for men and women', () => {
    expect(
      navyBodyFat({ sex: 'male', heightCm: 178, waistCm: 85, neckCm: 38, hipCm: null }),
    ).toBeCloseTo(16.44, 1);
    expect(
      navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32, hipCm: 98 }),
    ).toBeCloseTo(27.43, 1);
  });

  it('needs every input it uses and never guesses the sex', () => {
    const m = { heightCm: 178, waistCm: 85, neckCm: 38, hipCm: null };
    expect(navyBodyFat({ ...m, sex: 'unspecified' })).toBeNull();
    expect(navyBodyFat({ ...m, sex: null })).toBeNull();
    expect(navyBodyFat({ ...m, sex: 'female' })).toBeNull(); // no hip
    expect(navyBodyFat({ ...m, sex: 'male', neckCm: null })).toBeNull();
    expect(navyBodyFat({ ...m, sex: 'male', waistCm: 30 })).toBeNull(); // waist below neck
  });
});

describe('lean mass and FFMI', () => {
  it('computes lean mass, FFMI and the height-normalised FFMI', () => {
    const lean = leanMassKg(80, 15);
    expect(lean).toBe(68);
    expect(ffmi(lean, 180)).toBeCloseTo(20.99, 2);
    expect(normalizedFfmi(lean, 180)).toBeCloseTo(20.99, 2);
    expect(normalizedFfmi(lean, 170)).toBeCloseTo(68 / 1.7 ** 2 + 0.61, 2);
  });
});

describe('energy', () => {
  it('uses Mifflin-St Jeor and Katch-McArdle as published', () => {
    expect(bmrMifflin('male', 80, 180, 30)).toBe(1780);
    expect(bmrMifflin('female', 60, 165, 25)).toBeCloseTo(1345.25, 2);
    expect(bmrMifflin('unspecified', 60, 165, 25)).toBeNull();
    expect(bmrKatch(64)).toBeCloseTo(1752.4, 1);
  });

  it('uses the FAO/WHO/UNU lifestyle levels and net MET energy for training', () => {
    expect(LIFESTYLE_PAL.sitting).toBe(1.4);
    expect(LIFESTYLE_PAL.physical).toBe(1.8);
    // 4 × 1 h × (3.5 − 1) MET × 80 kg ÷ 7 days
    expect(trainingKcalPerDay(4, 60, 80)).toBeCloseTo(114.29, 2);
    expect(trainingKcalPerDay(0, 60, 80)).toBe(0);
  });

  const base = {
    sex: 'male' as const,
    age: 30,
    heightCm: 180,
    weightKg: 80,
    bodyFatPct: null,
    goal: 'hypertrophy' as const,
    dailyActivity: 'sitting' as const,
    plannedDays: 4,
    loggedDaysPerWeek: null,
  };

  it('sets calories and protein for the goal', () => {
    const plan = energyPlan(base)!;
    expect(plan.bmr).toBe(1780);
    expect(plan.pal).toBe(1.4);
    expect(plan.dailyKcal).toBe(2490); // 1780 × 1.4 = 2492, to the nearest 10
    expect(plan.trainingKcal).toBe(110); // 114, to the nearest 10
    expect(plan.tdee).toBe(2600);
    expect(plan.targetKcal).toBe(2850); // +10% = 2860, to the nearest 50
    expect(plan.proteinG).toEqual([128, 176]); // 1.6 and 2.2 g/kg, exact to one decimal
    const cut = energyPlan({ ...base, goal: 'fat_loss' })!;
    expect(cut.targetKcal).toBe(2100); // -20% = 2080, to the nearest 50
    expect(cut.proteinG).toEqual([160, 192]);
  });

  it('uses session length, prefers logged training days, and lean mass without sex', () => {
    const long = energyPlan({ ...base, sessionMinutes: 90 })!;
    expect(long.trainingKcal).toBe(170); // 4 × 1.5 h × 2.5 × 80 ÷ 7 = 171
    const logged = energyPlan({ ...base, loggedDaysPerWeek: 2.4 })!;
    expect(logged.trainingDaysSource).toBe('logged');
    expect(logged.trainingKcal).toBe(70); // 2.4 × 1 h × 2.5 × 80 ÷ 7 = 69
    const both = energyPlan({ ...base, bodyFatPct: 20 })!;
    expect(both.method).toBe('mifflin');
    const katch = energyPlan({ ...base, bodyFatPct: 20, sex: 'unspecified' })!;
    expect(katch.method).toBe('katch');
    expect(katch.bmr).toBe(Math.round(370 + 21.6 * 64));
  });

  it('shows nothing rather than guessing', () => {
    expect(energyPlan({ ...base, weightKg: null })).toBeNull();
    expect(energyPlan({ ...base, sex: 'unspecified' })).toBeNull();
    expect(energyPlan({ ...base, age: null })).toBeNull();
    expect(energyPlan({ ...base, plannedDays: null })).toBeNull();
  });
});

describe('weight trend', () => {
  it('averages the weigh-ins of the last 7 days', () => {
    const t = weightTrend([entry(1, 80), entry(2, 82), entry(3, 80), entry(9, 78)]);
    expect(t[0]!.trendKg).toBe(80);
    expect(t[1]!.trendKg).toBeCloseTo(81, 5);
    expect(t[2]!.trendKg).toBeCloseTo(80.6667, 3);
    // Day 9 looks back to day 3: days 1 and 2 have left the window.
    expect(t[3]!.trendKg).toBeCloseTo(79, 5);
  });

  it('measures the weekly rate only with enough history', () => {
    const steady = Array.from({ length: 22 }, (_, i) => entry(1 + i, 80 - i * 0.1));
    const rate = weeklyRate(weightTrend(steady), new Date(2026, 8, 23))!;
    expect(rate).toBeLessThan(-0.3);
    expect(rate).toBeGreaterThan(-0.75);
    expect(weeklyRate(weightTrend(steady.slice(0, 5)), new Date(2026, 8, 6))).toBeNull();
  });

  it('judges the rate against the goal', () => {
    expect(rateVerdict(-0.6, 80, 'fat_loss', 'intermediate')).toBe('on_track');
    expect(rateVerdict(-1.2, 80, 'fat_loss', 'intermediate')).toBe('too_fast');
    expect(rateVerdict(-0.1, 80, 'fat_loss', 'intermediate')).toBe('too_slow');
    expect(rateVerdict(0.3, 80, 'fat_loss', 'intermediate')).toBe('wrong_way');
    expect(rateVerdict(0.3, 80, 'hypertrophy', 'beginner')).toBe('on_track');
    expect(rateVerdict(0.8, 80, 'hypertrophy', 'advanced')).toBe('too_fast');
    expect(rateVerdict(-0.4, 80, 'hypertrophy', 'beginner')).toBe('wrong_way');
  });
});

describe('latest measurements', () => {
  it('takes each value from the newest entry that has it', () => {
    const base = {
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      deletedAt: null,
      origin: 'user' as const,
      neckCm: null,
      hipCm: null,
      chestCm: null,
      armCm: null,
      thighCm: null,
      calfCm: null,
      bodyFatPct: null,
      note: null,
    };
    const latest = latestMeasurements([
      {
        ...base,
        id: crypto.randomUUID(),
        measuredAt: '2026-09-01T07:00:00.000Z',
        waistCm: 84,
        neckCm: 38,
      },
      { ...base, id: crypto.randomUUID(), measuredAt: '2026-09-08T07:00:00.000Z', waistCm: 83 },
    ]);
    expect(latest.waistCm?.value).toBe(83);
    expect(latest.neckCm?.value).toBe(38);
    expect(latest.armCm).toBeNull();
  });
});

describe('body snapshot', () => {
  const m = (day: number, fields: Partial<BodyMeasurement>) => ({
    id: crypto.randomUUID(),
    createdAt: new Date(2026, 8, day).toISOString(),
    updatedAt: new Date(2026, 8, day).toISOString(),
    deletedAt: null,
    origin: 'user' as const,
    measuredAt: new Date(2026, 8, day, 7).toISOString(),
    waistCm: null,
    neckCm: null,
    hipCm: null,
    chestCm: null,
    armCm: null,
    thighCm: null,
    calfCm: null,
    bodyFatPct: null,
    note: null,
    ...fields,
  });
  const profile = {
    sex: 'male' as const,
    heightCm: 178,
    goal: 'hypertrophy' as const,
    experience: 'intermediate' as const,
    dailyActivity: 'sitting' as const,
    trainingDays: 4,
  };
  const weights = Array.from({ length: 20 }, (_, i) => entry(1 + i, 80));
  const now = new Date(2026, 8, 21, 9);

  it('combines the formulas and says which inputs are missing', () => {
    const s = bodySnapshot({
      profile,
      age: 30,
      bodyWeights: weights,
      measurements: [m(10, { waistCm: 85, neckCm: 38 })],
      loggedDaysPerWeek: null,
      now,
    });
    expect(s.weightKg).toBe(80);
    expect(s.bmi!.value).toBeCloseTo(25.25, 2);
    expect(s.bmi!.band).toBe('over');
    expect(s.bodyFat).toMatchObject({ source: 'navy' });
    expect(s.bodyFat!.pct).toBeCloseTo(16.44, 1);
    expect(s.leanKg).toBeCloseTo(80 * (1 - s.bodyFat!.pct / 100), 5);
    expect(s.energy!.method).toBe('mifflin'); // sex, age and height are known;
    // Only the fat loss goal has an evidence-based pace (Helms 2014), so no verdict here.
    expect(s.rate?.verdict ?? null).toBeNull();
    const cutting = bodySnapshot({
      profile: { ...profile, goal: 'fat_loss' },
      age: 30,
      bodyWeights: weights,
      measurements: [],
      loggedDaysPerWeek: null,
      now,
    });
    expect(cutting.rate?.verdict).toBe('too_slow');
    expect(s.missing).toMatchObject({ height: false, sex: false, navy: false });
  });

  it('prefers a recent scale reading and shows nothing it cannot work out', () => {
    const s = bodySnapshot({
      profile,
      age: 30,
      bodyWeights: weights,
      measurements: [m(10, { waistCm: 85, neckCm: 38 }), m(12, { bodyFatPct: 14 })],
      loggedDaysPerWeek: null,
      now,
    });
    expect(s.bodyFat).toMatchObject({ pct: 14, source: 'measured' });
    const empty = bodySnapshot({
      profile: null,
      age: null,
      bodyWeights: [],
      measurements: [],
      loggedDaysPerWeek: null,
      now,
    });
    expect([empty.bmi, empty.bodyFat, empty.energy, empty.rate, empty.ffmi]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(empty.missing.weight).toBe(true);
  });
});
