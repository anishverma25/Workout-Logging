import type {
  BodyMeasurement,
  BodyWeightEntry,
  DailyActivity,
  Experience,
  Goal,
  Sex,
} from '../models/schemas';
import { isAlive } from './sessions';

/**
 * Body composition and energy, from published formulas. Every function is pure, takes metric
 * units (kg, cm, years) and returns null when an input it needs is missing, so a number is
 * never guessed. The methodology page lists each formula and its source.
 */

const round = (v: number, step = 1) => Math.round(v / step) * step;

// ---------------------------------------------------------------------------------------------
// BMI
// ---------------------------------------------------------------------------------------------

/** Body mass index: kg / m². */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiBand = 'under' | 'healthy' | 'over' | 'obese';

/**
 * WHO bands: under 18.5, 18.5 to 24.9, 25 to 29.9, 30 and over. The WHO expert consultation on
 * Asian populations suggests action from 23 (and 27.5), because risk starts at a lower BMI.
 */
export function bmiBand(value: number, asianCutoffs = false): BmiBand {
  if (value < 18.5) return 'under';
  if (value < (asianCutoffs ? 23 : 25)) return 'healthy';
  if (value < (asianCutoffs ? 27.5 : 30)) return 'over';
  return 'obese';
}

// ---------------------------------------------------------------------------------------------
// Body fat (US Navy tape method) and lean mass
// ---------------------------------------------------------------------------------------------

/**
 * US Navy circumference method (Hodgdon and Beckett, 1984), metric form:
 *   men:   495 / (1.0324 - 0.19077 log10(waist - neck) + 0.15456 log10(height)) - 450
 *   women: 495 / (1.29579 - 0.35004 log10(waist + hip - neck) + 0.22100 log10(height)) - 450
 * Waist at the navel for men, at the narrowest point for women; hip at the widest point.
 * Typically within 3 to 4 percentage points of lab methods.
 */
export function navyBodyFat(input: {
  sex: Sex | null | undefined;
  heightCm: number | null | undefined;
  waistCm: number | null;
  neckCm: number | null;
  hipCm: number | null;
}): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = input;
  if (!heightCm || !waistCm || !neckCm) return null;
  let pct: number;
  if (sex === 'male') {
    if (waistCm - neckCm <= 0) return null;
    pct =
      495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) -
      450;
  } else if (sex === 'female') {
    if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
    pct =
      495 /
        (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) -
      450;
  } else return null;
  if (!Number.isFinite(pct) || pct < 2 || pct > 70) return null;
  return pct;
}

export const leanMassKg = (weightKg: number, bodyFatPct: number) =>
  weightKg * (1 - bodyFatPct / 100);

/** Fat-free mass index: lean kg / m². */
export function ffmi(leanKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return leanKg / (m * m);
}

/** FFMI adjusted to a 1.8 m height (Kouri et al., 1995): FFMI + 6.1 × (1.8 - height in m). */
export function normalizedFfmi(leanKg: number, heightCm: number): number {
  return ffmi(leanKg, heightCm) + 6.1 * (1.8 - heightCm / 100);
}

// ---------------------------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------------------------

/** Mifflin-St Jeor (1990): 10 × kg + 6.25 × cm - 5 × age + 5 (men) or - 161 (women). */
export function bmrMifflin(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
): number | null {
  if (sex === 'unspecified') return null;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Katch-McArdle: 370 + 21.6 × lean kg. Needs no sex or age, so it is used when body fat is known. */
export const bmrKatch = (leanKg: number) => 370 + 21.6 * leanKg;

/** The standard activity factors (Harris-Benedict tradition), lightest to heaviest. */
export const ACTIVITY_STEPS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;

const DAILY_STEP: Record<DailyActivity, number> = {
  sitting: 0,
  mixed: 0.5,
  on_feet: 1,
  physical: 2,
};

/**
 * Activity factor from training days a week and the rest of the day:
 * 0 to 1 days 1.2, 2 to 3 days 1.375, 4 to 5 days 1.55, 6 to 7 days 1.725, then up by half a
 * step for a mixed day, one step for a day on your feet, two for physical work (at most 1.9).
 */
export function activityFactor(trainingDays: number, daily: DailyActivity | null | undefined) {
  const base = trainingDays <= 1 ? 0 : trainingDays <= 3 ? 1 : trainingDays <= 5 ? 2 : 3;
  const position = Math.min(base + DAILY_STEP[daily ?? 'sitting'], ACTIVITY_STEPS.length - 1);
  const lo = ACTIVITY_STEPS[Math.floor(position)]!;
  const hi = ACTIVITY_STEPS[Math.ceil(position)]!;
  return lo + (hi - lo) * (position - Math.floor(position));
}

/** Change to daily energy for each goal, as a share of maintenance. */
export const GOAL_ENERGY: Record<Goal, number> = {
  hypertrophy: 0.1,
  strength_hypertrophy: 0.1,
  strength: 0.05,
  fat_loss: -0.2,
  recomposition: -0.1,
  general_fitness: 0,
};

/**
 * Protein in g per kg of body weight. 1.6 is where the benefit for muscle gain levels off and
 * 2.2 the upper end of the range in the largest meta-analysis (Morton et al., 2018). Higher in
 * a deficit to protect muscle (Helms et al., 2014).
 */
export const GOAL_PROTEIN: Record<Goal, [number, number]> = {
  hypertrophy: [1.6, 2.2],
  strength_hypertrophy: [1.6, 2.2],
  strength: [1.6, 2.2],
  fat_loss: [2.0, 2.4],
  recomposition: [2.0, 2.4],
  general_fitness: [1.2, 1.6],
};

export interface EnergyPlan {
  bmr: number;
  method: 'mifflin' | 'katch';
  factor: number;
  /** Maintenance: BMR × activity factor. */
  tdee: number;
  /** Daily target for the goal, rounded to 50 kcal. */
  targetKcal: number;
  adjustment: number;
  proteinG: [number, number];
  /** At least 0.8 g per kg, to support hormones. */
  fatMinG: number;
  /** What is left for carbohydrate at the protein midpoint and minimum fat. */
  carbsG: number;
  /** Training days the factor used, and where they came from. */
  trainingDays: number;
  trainingDaysSource: 'logged' | 'planned';
}

export interface EnergyInput {
  sex: Sex | null | undefined;
  age: number | null;
  heightCm: number | null | undefined;
  weightKg: number | null;
  bodyFatPct: number | null;
  goal: Goal;
  dailyActivity: DailyActivity | null | undefined;
  plannedDays: number | null | undefined;
  /** Average sessions a week over the last 4 weeks, when there are 4 weeks of history. */
  loggedDaysPerWeek: number | null;
}

export function energyPlan(input: EnergyInput): EnergyPlan | null {
  const { weightKg } = input;
  if (!weightKg) return null;
  let bmr: number | null = null;
  let method: EnergyPlan['method'] = 'mifflin';
  if (input.bodyFatPct !== null) {
    bmr = bmrKatch(leanMassKg(weightKg, input.bodyFatPct));
    method = 'katch';
  } else if (input.sex && input.heightCm && input.age !== null) {
    bmr = bmrMifflin(input.sex, weightKg, input.heightCm, input.age);
  }
  if (bmr === null) return null;
  const trainingDays =
    input.loggedDaysPerWeek !== null ? input.loggedDaysPerWeek : (input.plannedDays ?? null);
  if (trainingDays === null) return null;
  const factor = activityFactor(Math.round(trainingDays), input.dailyActivity);
  const tdee = bmr * factor;
  const adjustment = GOAL_ENERGY[input.goal];
  const targetKcal = round(tdee * (1 + adjustment), 50);
  const [pLo, pHi] = GOAL_PROTEIN[input.goal];
  const proteinG: [number, number] = [round(pLo * weightKg, 5), round(pHi * weightKg, 5)];
  const fatMinG = round(0.8 * weightKg, 5);
  const proteinMid = (proteinG[0] + proteinG[1]) / 2;
  const carbsG = Math.max(0, round((targetKcal - proteinMid * 4 - fatMinG * 9) / 4, 5));
  return {
    bmr: round(bmr),
    method,
    factor: Math.round(factor * 1000) / 1000,
    tdee: round(tdee, 10),
    targetKcal,
    adjustment,
    proteinG,
    fatMinG,
    carbsG,
    trainingDays,
    trainingDaysSource: input.loggedDaysPerWeek !== null ? 'logged' : 'planned',
  };
}

// ---------------------------------------------------------------------------------------------
// Smoothed weight trend
// ---------------------------------------------------------------------------------------------

/** Share of the gap to each new weigh-in that the trend moves, per day (Hacker's Diet). */
export const TREND_ALPHA = 0.1;

export interface TrendPoint {
  date: Date;
  kg: number;
  trendKg: number;
}

/**
 * Exponentially smoothed weight. Each weigh-in pulls the trend 10% of the way toward it per
 * day elapsed (1 - 0.9^days for gaps), so a salty dinner barely moves it but a real change
 * shows within a couple of weeks.
 */
export function weightTrend(entries: BodyWeightEntry[]): TrendPoint[] {
  const sorted = entries.filter(isAlive).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const out: TrendPoint[] = [];
  let trend: number | null = null;
  let last: Date | null = null;
  for (const e of sorted) {
    const date = new Date(e.measuredAt);
    if (trend === null || last === null) trend = e.weightKg;
    else {
      const days = Math.max((date.getTime() - last.getTime()) / 86_400_000, 1 / 24);
      const alpha = 1 - Math.pow(1 - TREND_ALPHA, Math.min(days, 30));
      trend = trend + alpha * (e.weightKg - trend);
    }
    last = date;
    out.push({ date, kg: e.weightKg, trendKg: trend });
  }
  return out;
}

export const RATE_MIN_DAYS = 14;
export const RATE_MIN_ENTRIES = 6;

/**
 * Weekly rate of change of the trend: least-squares slope over the last 28 days of trend points.
 * Needs at least 14 days and 6 weigh-ins, otherwise it is noise.
 */
export function weeklyRate(points: TrendPoint[], now: Date): number | null {
  const from = now.getTime() - 28 * 86_400_000;
  const recent = points.filter((p) => p.date.getTime() >= from);
  if (recent.length < RATE_MIN_ENTRIES) return null;
  const span = (recent[recent.length - 1]!.date.getTime() - recent[0]!.date.getTime()) / 86_400_000;
  if (span < RATE_MIN_DAYS) return null;
  const xs = recent.map((p) => p.date.getTime() / 86_400_000);
  const ys = recent.map((p) => p.trendKg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i]! - my);
    den += (x - mx) ** 2;
  });
  return den === 0 ? null : (num / den) * 7;
}

/**
 * Healthy weekly change for a goal, as a share of body weight per week. Losing 0.5 to 1% a
 * week keeps muscle in a deficit (Helms et al., 2014); gaining 0.25 to 0.5% a week limits fat
 * gain, less for experienced lifters who build muscle more slowly.
 */
export function targetRate(goal: Goal, experience: Experience): [number, number] {
  switch (goal) {
    case 'fat_loss':
      return [-0.01, -0.005];
    case 'recomposition':
      return [-0.005, 0];
    case 'hypertrophy':
    case 'strength_hypertrophy':
      return experience === 'beginner'
        ? [0.0025, 0.005]
        : experience === 'intermediate'
          ? [0.002, 0.004]
          : [0.001, 0.0025];
    case 'strength':
      return [0, 0.0025];
    case 'general_fitness':
      return [-0.0025, 0.0025];
  }
}

export type RateVerdict = 'on_track' | 'too_fast' | 'too_slow' | 'wrong_way';

export function rateVerdict(
  rateKgPerWeek: number,
  weightKg: number,
  goal: Goal,
  experience: Experience,
): RateVerdict {
  const [lo, hi] = targetRate(goal, experience);
  const pct = rateKgPerWeek / weightKg;
  // A twentieth of a percent of slack: scales and trends are not that precise.
  const slack = 0.0005;
  if (pct >= lo - slack && pct <= hi + slack) return 'on_track';
  const mid = (lo + hi) / 2;
  if (mid < 0) return pct < lo ? 'too_fast' : pct > slack ? 'wrong_way' : 'too_slow';
  if (mid > 0) return pct > hi ? 'too_fast' : pct < -slack ? 'wrong_way' : 'too_slow';
  return 'too_fast';
}

// ---------------------------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------------------------

/** The most recent value of each measurement, each from the newest entry that has it. */
export function latestMeasurements(entries: BodyMeasurement[]) {
  const sorted = entries.filter(isAlive).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const pick = <K extends keyof BodyMeasurement>(key: K) => {
    const e = sorted.find((m) => m[key] !== null && m[key] !== undefined);
    return e ? { value: e[key] as number, at: new Date(e.measuredAt) } : null;
  };
  return {
    waistCm: pick('waistCm'),
    neckCm: pick('neckCm'),
    hipCm: pick('hipCm'),
    chestCm: pick('chestCm'),
    armCm: pick('armCm'),
    thighCm: pick('thighCm'),
    calfCm: pick('calfCm'),
    bodyFatPct: pick('bodyFatPct'),
  };
}
