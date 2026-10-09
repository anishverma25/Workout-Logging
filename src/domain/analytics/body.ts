import type {
  BodyMeasurement,
  BodyWeightEntry,
  DailyActivity,
  Experience,
  Goal,
  Sex,
} from '../models/schemas';
import { isAlive } from './sessions';
import { startOfDay } from '@/lib/dates';

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

/**
 * Physical activity level of the day without planned exercise (total energy ÷ BMR). From the
 * FAO/WHO/UNU expert consultation on human energy requirements (2004): a sedentary lifestyle is
 * 1.40 to 1.69, an active one 1.70 to 1.99, a vigorous one 2.00 to 2.40. Training is counted
 * separately below, so a desk day uses the bottom of the sedentary band.
 */
export const LIFESTYLE_PAL: Record<DailyActivity, number> = {
  sitting: 1.4,
  mixed: 1.5,
  on_feet: 1.6,
  physical: 1.8,
};

/**
 * Average MET of a resistance training session, rests included: "resistance training, multiple
 * exercises, 8 to 15 repetitions at varied resistance" in the Compendium of Physical Activities.
 */
export const TRAINING_MET = 3.5;
/** Session length when the profile does not say. */
export const DEFAULT_SESSION_MINUTES = 60;

/**
 * Extra energy of training, averaged over the week: one MET is 1 kcal per kg per hour, and the
 * resting MET is subtracted because the lifestyle factor already covers that time.
 */
export function trainingKcalPerDay(daysPerWeek: number, minutes: number, weightKg: number) {
  return (daysPerWeek * (minutes / 60) * (TRAINING_MET - 1) * weightKg) / 7;
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
  /** Lifestyle physical activity level, without training, and the day it describes. */
  pal: number;
  dailyActivity: DailyActivity;
  /** BMR × lifestyle level. */
  dailyKcal: number;
  /** Training energy, averaged per day of the week. */
  trainingKcal: number;
  sessionMinutes: number;
  /** Maintenance: BMR × lifestyle level + training energy. */
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
  sessionMinutes?: number | null | undefined;
}

export function energyPlan(input: EnergyInput): EnergyPlan | null {
  const { weightKg } = input;
  if (!weightKg) return null;
  // Mifflin-St Jeor is the most accurate of the common equations in validation studies
  // (Frankenfield and colleagues, 2005). Katch-McArdle needs only lean mass, so it covers people
  // who did not give their sex but have a body-fat reading.
  let bmr: number | null = null;
  let method: EnergyPlan['method'] = 'mifflin';
  if (input.sex && input.sex !== 'unspecified' && input.heightCm && input.age !== null) {
    bmr = bmrMifflin(input.sex, weightKg, input.heightCm, input.age);
  } else if (input.bodyFatPct !== null) {
    bmr = bmrKatch(leanMassKg(weightKg, input.bodyFatPct));
    method = 'katch';
  }
  if (bmr === null) return null;
  const trainingDays =
    input.loggedDaysPerWeek !== null ? input.loggedDaysPerWeek : (input.plannedDays ?? null);
  if (trainingDays === null) return null;
  const pal = LIFESTYLE_PAL[input.dailyActivity ?? 'sitting'];
  const sessionMinutes = input.sessionMinutes ?? DEFAULT_SESSION_MINUTES;
  // Each part rounded to 10 kcal, so the sum shown on screen adds up exactly.
  const dailyKcal = round(bmr * pal, 10);
  const trainingKcal = round(trainingKcalPerDay(trainingDays, sessionMinutes, weightKg), 10);
  const tdee = dailyKcal + trainingKcal;
  const adjustment = GOAL_ENERGY[input.goal];
  const targetKcal = round(tdee * (1 + adjustment), 50);
  const [pLo, pHi] = GOAL_PROTEIN[input.goal];
  // Exact to one decimal: g/kg × the smoothed body weight, no rounding to 5.
  const tenth = (v: number) => Math.round(v * 10) / 10;
  const proteinG: [number, number] = [tenth(pLo * weightKg), tenth(pHi * weightKg)];
  const fatMinG = round(0.8 * weightKg, 5);
  const proteinMid = (proteinG[0] + proteinG[1]) / 2;
  const carbsG = Math.max(0, round((targetKcal - proteinMid * 4 - fatMinG * 9) / 4, 5));
  return {
    bmr: round(bmr),
    method,
    pal,
    dailyActivity: input.dailyActivity ?? 'sitting',
    dailyKcal,
    trainingKcal,
    sessionMinutes,
    tdee,
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

/**
 * Rolling average window (Evidence Corner, metric 11). Weight swings across the week, higher
 * after the weekend and lowest near Friday (Orsama et al. 2014, who used a 7-day moving
 * average themselves), so a 7-day mean shows the real direction.
 */
export const TREND_DAYS = 7;

export interface TrendPoint {
  date: Date;
  kg: number;
  /** Mean of the weigh-ins in the 7 days ending on this one. */
  trendKg: number;
}

export function weightTrend(entries: BodyWeightEntry[]): TrendPoint[] {
  const sorted = entries.filter(isAlive).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const dated = sorted.map((e) => ({ date: new Date(e.measuredAt), kg: e.weightKg }));
  return dated.map((p, i) => {
    const from = startOfDay(p.date).getTime() - (TREND_DAYS - 1) * 86_400_000;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && dated[j]!.date.getTime() >= from; j--) {
      sum += dated[j]!.kg;
      n++;
    }
    return { date: p.date, kg: p.kg, trendKg: sum / n };
  });
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
 * Weekly change that keeps muscle while cutting (Evidence Corner, metric 12): losing about 0.5
 * to 1% of body weight a week (Helms, Aragon and Fitschen 2014). Only the cutting goal has an
 * evidence-backed target; other goals see their measured rate without a verdict.
 */
export const hasRateTarget = (goal: Goal) => goal === 'fat_loss';

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

// ---------------------------------------------------------------------------------------------
// Everything at once, for the body page
// ---------------------------------------------------------------------------------------------

export interface BodySnapshot {
  weightKg: number | null;
  age: number | null;
  bmi: { value: number; band: BmiBand; asianBand: BmiBand } | null;
  bodyFat: { pct: number; source: 'measured' | 'navy'; at: Date } | null;
  leanKg: number | null;
  ffmi: { value: number; normalized: number } | null;
  energy: EnergyPlan | null;
  trend: TrendPoint[];
  /** Verdict and target only for the cutting goal, the one with an evidence-backed target. */
  rate: {
    kgPerWeek: number;
    verdict: RateVerdict | null;
    target: [number, number] | null;
  } | null;
  /** What to add to unlock each number, for the empty states. */
  missing: {
    weight: boolean;
    height: boolean;
    sex: boolean;
    age: boolean;
    trainingDays: boolean;
    navy: boolean;
  };
}

/** A body-fat reading from a scale or scan counts for 60 days before the tape estimate wins. */
export const MEASURED_FAT_DAYS = 60;

export function bodySnapshot(input: {
  profile: {
    sex?: Sex | null;
    heightCm?: number | null;
    goal: Goal;
    experience: Experience;
    dailyActivity?: DailyActivity | null;
    trainingDays?: number | null;
    sessionMinutes?: number | null;
  } | null;
  age: number | null;
  bodyWeights: BodyWeightEntry[];
  measurements: BodyMeasurement[];
  loggedDaysPerWeek: number | null;
  now: Date;
}): BodySnapshot {
  const { profile, age, now } = input;
  const trend = weightTrend(input.bodyWeights);
  const latest = trend[trend.length - 1] ?? null;
  // The smoothed trend is a steadier basis for the formulas than one weigh-in.
  const weightKg = latest ? latest.trendKg : null;
  const heightCm = profile?.heightCm ?? null;
  const m = latestMeasurements(input.measurements);

  let bodyFat: BodySnapshot['bodyFat'] = null;
  const measured = m.bodyFatPct;
  const navyAt = [m.waistCm?.at, m.neckCm?.at].filter(Boolean) as Date[];
  const navy = navyBodyFat({
    sex: profile?.sex,
    heightCm,
    waistCm: m.waistCm?.value ?? null,
    neckCm: m.neckCm?.value ?? null,
    hipCm: m.hipCm?.value ?? null,
  });
  if (measured && now.getTime() - measured.at.getTime() <= MEASURED_FAT_DAYS * 86_400_000)
    bodyFat = { pct: measured.value, source: 'measured', at: measured.at };
  else if (navy !== null)
    bodyFat = {
      pct: navy,
      source: 'navy',
      at: new Date(Math.min(...navyAt.map((d) => d.getTime()))),
    };
  else if (measured) bodyFat = { pct: measured.value, source: 'measured', at: measured.at };

  const leanKg = weightKg !== null && bodyFat ? leanMassKg(weightKg, bodyFat.pct) : null;
  const rateValue = weeklyRate(trend, now);
  return {
    weightKg,
    age,
    bmi:
      weightKg !== null && heightCm
        ? {
            value: bmi(weightKg, heightCm),
            band: bmiBand(bmi(weightKg, heightCm)),
            asianBand: bmiBand(bmi(weightKg, heightCm), true),
          }
        : null,
    bodyFat,
    leanKg,
    ffmi:
      leanKg !== null && heightCm
        ? { value: ffmi(leanKg, heightCm), normalized: normalizedFfmi(leanKg, heightCm) }
        : null,
    energy: profile
      ? energyPlan({
          sex: profile.sex,
          age,
          heightCm,
          weightKg,
          bodyFatPct: bodyFat?.pct ?? null,
          goal: profile.goal,
          dailyActivity: profile.dailyActivity,
          plannedDays: profile.trainingDays,
          loggedDaysPerWeek: input.loggedDaysPerWeek,
          sessionMinutes: profile.sessionMinutes,
        })
      : null,
    trend,
    rate:
      rateValue !== null && weightKg !== null && profile
        ? {
            kgPerWeek: rateValue,
            verdict: hasRateTarget(profile.goal)
              ? rateVerdict(rateValue, weightKg, profile.goal, profile.experience)
              : null,
            target: hasRateTarget(profile.goal)
              ? targetRate(profile.goal, profile.experience)
              : null,
          }
        : null,
    missing: {
      weight: weightKg === null,
      height: !heightCm,
      sex: !profile?.sex || profile.sex === 'unspecified',
      age: age === null,
      trainingDays: !profile?.trainingDays && input.loggedDaysPerWeek === null,
      navy: !m.waistCm || !m.neckCm || (profile?.sex === 'female' && !m.hipCm),
    },
  };
}
