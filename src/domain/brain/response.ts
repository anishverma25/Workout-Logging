import type { RecoverySample, WeekFacts } from './facts';
import {
  DEFICIT_KCAL,
  KCAL_PER_KG,
  LEARNING_WEEKS,
  MIN_FOOD_DAYS,
  MIN_WEIGH_INS,
  SHRINK_K,
} from './limits';

/**
 * The personal response model: what this person's own logs say about how their body answers to
 * food and training. Every estimate starts at the research default and moves toward the
 * person's data as their weeks add up, and a personal finding is only claimed once the data
 * supports it. Pure: the same weeks always give the same model.
 */

/** research: the default. learning: own data is coming in. personal: own data supports it. */
export type Confidence = 'research' | 'learning' | 'personal';

export interface Estimate {
  value: number;
  /** The research default, when there is one. */
  research: number | null;
  /** What the person's own data says on its own, when there is enough of it. */
  own: number | null;
  /** Weeks of the person's data behind it. */
  n: number;
  confidence: Confidence;
}

export interface ConditionStats {
  cond: string;
  n: number;
  mean: number;
}

export interface Finding {
  kind: 'sets' | 'reps' | 'recovery' | 'energy';
  /** A muscle, or `all`. */
  subject: string;
  /** The condition that did best, only when the data supports saying so. */
  best: string | null;
  confidence: Exclude<Confidence, 'research'>;
  groups: ConditionStats[];
}

export interface LiftTrend {
  /** Change in estimated 1RM a week, as a share (0.01 is 1%). */
  weekly: number;
  /** How far single weeks sit from the trend, as a share. */
  spread: number;
  weeks: number;
  latest: number;
}

export interface ResponseModel {
  weeksLogged: number;
  stage: { learning: boolean; week: number; of: number };
  maintenance: Estimate | null;
  findings: Finding[];
  lifts: Record<string, LiftTrend>;
}

/** Weekly sets per muscle fall in one of three bands. */
export const SET_BANDS = { low: [0, 10], mid: [10, 16], high: [16, Infinity] } as const;
export type SetBand = keyof typeof SET_BANDS;
export const setBand = (sets: number): SetBand => (sets < 10 ? 'low' : sets < 16 ? 'mid' : 'high');
/** Top sets of 1 to 5 reps are heavy, 6 to 10 moderate. */
export const repBand = (reps: number) => (reps <= 5 ? 'heavy' : 'moderate');
/** A muscle trained again within 2 days had a short rest. */
export const restBand = (gapDays: number) => (gapDays <= 2 ? 'short' : 'long');

/** A condition needs this many samples to be compared at all. */
export const MIN_SAMPLES = 5;
/** How clear the gap between the best condition and the next must be (Welch t). */
export const CLEAR_GAP = 2.3;
/** Maintenance is read from this many recent weeks, and needs this many of them complete. */
export const MAINTENANCE_WINDOW = 4;
export const MAINTENANCE_MIN_WEEKS = 3;
const MAX_EVIDENCE_WEEKS = 12;

const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[]) => {
  const m = meanOf(xs);
  return xs.reduce((n, x) => n + (x - m) ** 2, 0) / (xs.length - 1);
};

/**
 * The estimate moves from the research default toward the person's data as their weeks n grow:
 * n / (n + k) of their own, k / (n + k) of the research.
 */
export function shrink(own: number, n: number, research: number, k = SHRINK_K): number {
  return (n / (n + k)) * own + (k / (n + k)) * research;
}

/** A week with enough food and weigh-ins logged to say something about energy. */
export const isCompleteWeek = (w: WeekFacts) =>
  w.foodDays >= MIN_FOOD_DAYS &&
  w.weighIns >= MIN_WEIGH_INS &&
  w.meanKcal !== null &&
  w.meanWeightKg !== null;

/** Least-squares slope of y on x. */
function slope(points: { x: number; y: number }[]): number {
  const mx = meanOf(points.map((p) => p.x));
  const my = meanOf(points.map((p) => p.y));
  const den = points.reduce((n, p) => n + (p.x - mx) ** 2, 0);
  return den === 0 ? 0 : points.reduce((n, p) => n + (p.x - mx) * (p.y - my), 0) / den;
}

/**
 * Maintenance from the person's own intake and weight trend over the last 4 weeks:
 * mean intake less the weekly weight change × 7,700 ÷ 7. Blended with the formula estimate
 * (`research`) by how many complete weeks they have logged.
 */
export function maintenanceEstimate(weeks: WeekFacts[], research: number | null): Estimate | null {
  const recent = weeks.slice(-MAINTENANCE_WINDOW);
  const offset = weeks.length - recent.length;
  const complete = recent
    .map((w, i) => ({ w, x: offset + i }))
    .filter(({ w }) => isCompleteWeek(w));
  const n = Math.min(MAX_EVIDENCE_WEEKS, weeks.filter(isCompleteWeek).length);
  let own: number | null = null;
  if (complete.length >= MAINTENANCE_MIN_WEEKS) {
    const intake = meanOf(complete.map(({ w }) => w.meanKcal!));
    const kgPerWeek = slope(complete.map(({ w, x }) => ({ x, y: w.meanWeightKg! })));
    const value = intake - (kgPerWeek * KCAL_PER_KG) / 7;
    // A value no body has means the logs are off (missed meals, a broken scale), not the person.
    if (value >= 1000 && value <= 5500) own = value;
  }
  if (own === null && research === null) return null;
  if (own === null) return { value: research!, research, own: null, n, confidence: 'research' };
  if (research === null)
    return { value: own, research: null, own, n, confidence: n >= 4 ? 'personal' : 'learning' };
  return {
    value: shrink(own, n, research),
    research,
    own,
    n,
    confidence: n >= 4 ? 'personal' : 'learning',
  };
}

/**
 * Compares the conditions a value was seen under. The best one is named only when it and the
 * next both have enough samples and the gap between them is clear; otherwise it is still
 * learning. The test statistic is a gate, never shown.
 */
export function compare(samples: { cond: string; value: number }[]): {
  best: string | null;
  confidence: Exclude<Confidence, 'research'>;
  groups: ConditionStats[];
} {
  const by = new Map<string, number[]>();
  for (const s of samples) by.set(s.cond, [...(by.get(s.cond) ?? []), s.value]);
  const groups = [...by.entries()].map(([cond, xs]) => ({ cond, n: xs.length, mean: meanOf(xs) }));
  const ready = groups.filter((g) => g.n >= MIN_SAMPLES).sort((a, b) => b.mean - a.mean);
  if (ready.length < 2) return { best: null, confidence: 'learning', groups };
  const [top, next] = ready as [ConditionStats, ConditionStats];
  const a = by.get(top.cond)!;
  const b = by.get(next.cond)!;
  const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
  const clear = se > 0 && (top.mean - next.mean) / se >= CLEAR_GAP;
  return clear
    ? { best: top.cond, confidence: 'personal', groups }
    : { best: null, confidence: 'learning', groups };
}

/** For each week, the next week (within two) and the shared lifts' change between them. */
function weekSteps(weeks: WeekFacts[]) {
  const steps: { week: WeekFacts; byMuscle: Map<string, number[]>; all: number[] }[] = [];
  for (let i = 0; i < weeks.length - 1; i++) {
    const week = weeks[i]!;
    const byMuscle = new Map<string, number[]>();
    const all: number[] = [];
    for (const [id, lift] of Object.entries(week.lifts)) {
      const later = weeks[i + 1]!.lifts[id] ?? weeks[i + 2]?.lifts[id];
      if (!later) continue;
      const change = later.e1rm / lift.e1rm - 1;
      byMuscle.set(lift.muscle, [...(byMuscle.get(lift.muscle) ?? []), change]);
      all.push(change);
    }
    steps.push({ week, byMuscle, all });
  }
  return steps;
}

function liftTrends(weeks: WeekFacts[]): Record<string, LiftTrend> {
  const recent = weeks.slice(-8);
  const out: Record<string, LiftTrend> = {};
  const ids = new Set(recent.flatMap((w) => Object.keys(w.lifts)));
  for (const id of ids) {
    const points = recent
      .map((w, x) => ({ x, y: w.lifts[id] ? Math.log(w.lifts[id].e1rm) : null }))
      .filter((p): p is { x: number; y: number } => p.y !== null);
    if (points.length < 4) continue;
    const k = slope(points);
    const my = meanOf(points.map((p) => p.y));
    const mx = meanOf(points.map((p) => p.x));
    const resid = points.map((p) => p.y - (my + k * (p.x - mx)));
    const spread = Math.sqrt(resid.reduce((n, r) => n + r * r, 0) / Math.max(1, points.length - 2));
    const latest = [...recent].reverse().find((w) => w.lifts[id])!.lifts[id]!.e1rm;
    out[id] = { weekly: Math.exp(k) - 1, spread, weeks: points.length, latest };
  }
  return out;
}

export function responseModel(input: {
  /** Oldest first, ending with the last finished week. */
  weeks: WeekFacts[];
  recovery: RecoverySample[];
  /** Maintenance from the body formulas, when the profile allows one. */
  researchMaintenance: number | null;
}): ResponseModel {
  const { weeks } = input;
  const weeksLogged = weeks.filter((w) => w.sessions > 0 || w.foodDays >= 3).length;
  const maintenance = maintenanceEstimate(weeks, input.researchMaintenance);
  const steps = weekSteps(weeks);
  const findings: Finding[] = [];

  const muscles = new Set(steps.flatMap((s) => [...s.byMuscle.keys()]));
  for (const muscle of muscles) {
    const sets = steps
      .filter((s) => s.byMuscle.has(muscle))
      .map((s) => ({
        cond: setBand(s.week.muscles[muscle] ?? 0),
        value: meanOf(s.byMuscle.get(muscle)!),
      }));
    findings.push({ kind: 'sets', subject: muscle, ...compare(sets) });

    const reps = steps.flatMap((s) =>
      Object.entries(s.week.lifts)
        .filter(([, l]) => l.muscle === muscle)
        .map(([id, l]) => {
          const i = weeks.indexOf(s.week);
          const later = weeks[i + 1]!.lifts[id] ?? weeks[i + 2]?.lifts[id];
          return later ? { cond: repBand(l.topReps), value: later.e1rm / l.e1rm - 1 } : null;
        })
        .filter((v): v is { cond: string; value: number } => v !== null),
    );
    findings.push({ kind: 'reps', subject: muscle, ...compare(reps) });

    const rest = input.recovery
      .filter((r) => r.muscle === muscle)
      .map((r) => ({ cond: restBand(r.gapDays), value: r.change }));
    findings.push({ kind: 'recovery', subject: muscle, ...compare(rest) });
  }

  if (maintenance) {
    const energy = steps
      .filter((s) => s.week.foodDays >= MIN_FOOD_DAYS && s.week.meanKcal !== null && s.all.length)
      .map((s) => ({
        cond: s.week.meanKcal! <= maintenance.value - DEFICIT_KCAL ? 'deficit' : 'fed',
        value: meanOf(s.all),
      }));
    findings.push({ kind: 'energy', subject: 'all', ...compare(energy) });
  }

  return {
    weeksLogged,
    stage: {
      learning: weeksLogged < LEARNING_WEEKS,
      week: Math.min(weeksLogged, LEARNING_WEEKS),
      of: LEARNING_WEEKS,
    },
    maintenance,
    findings,
    lifts: liftTrends(weeks),
  };
}

export const findingFor = (model: ResponseModel, kind: Finding['kind'], subject: string) =>
  model.findings.find((f) => f.kind === kind && f.subject === subject) ?? null;
