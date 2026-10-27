import type { Experience, Goal } from '../models/schemas';
import { GOAL_PROTEIN, targetRate } from './body';
import { kcalForRate, rateForKcal } from './targets';

/**
 * Daily calories and protein for reaching a target body weight, and when the person gets there.
 * Pure, fixed rules (topic `targets` on the science page):
 *
 * - The weekly rate is the middle of the evidence range for the direction of the target: losing
 *   0.5 to 1% of body weight a week keeps muscle (Helms 2014), so the plan aims for 0.75%;
 *   recomposition aims for the middle of 0 to 0.5%; gaining uses the lean-gain range for the
 *   person's training age (Iraki 2019). A goal that points the other way from the target uses
 *   the range for the target's direction.
 * - Calories: maintenance plus the rate × 7,700 kcal per kg ÷ 7, never under 1,200 kcal or the
 *   person's resting energy (BMR).
 * - Protein: the middle of the goal's g/kg range (Morton 2018, Helms 2014), the cutting range
 *   when losing weight.
 * - Timeline: the weight to change ÷ the weekly rate. The 7,700 kcal rule is a first-weeks
 *   guide; the body adapts as weight changes (Hall 2008), so the date is an estimate.
 */

/** Within this of the target, the person is already there. */
export const AT_TARGET_KG = 0.5;
/** No plan goes below this, whatever the maths says. */
export const MIN_DAILY_KCAL = 1200;
/** A predicted change slower than this (kg a week) is treated as no change. */
export const NO_CHANGE_KG = 0.02;

export type Direction = 'lose' | 'gain' | 'hold';

export interface TargetInput {
  weightKg: number;
  targetKg: number;
  goal: Goal;
  experience: Experience;
  /** Estimated maintenance (TDEE). */
  maintenanceKcal: number;
  bmrKcal: number;
  /** yyyy-mm-dd. */
  today: string;
}

export interface TargetPlan {
  direction: Direction;
  kcal: number;
  proteinG: number;
  /** The weekly rate the plan aims for, kg (negative when losing). */
  rateKgPerWeek: number;
  /** True when the goal chosen points the other way from the target weight. */
  goalOverridden: boolean;
  /** True when the calorie floor made the plan slower than the evidence rate. */
  floored: boolean;
  outcome: IntakeOutcome;
}

export type IntakeStatus =
  | 'at_target'
  | 'on_track'
  | 'too_fast'
  | 'slow'
  | 'no_change'
  | 'wrong_way'
  | 'too_low';

export interface IntakeOutcome {
  status: IntakeStatus;
  /** Predicted weekly change, kg (negative when losing). */
  rateKgPerWeek: number;
  /** Weeks to the target, when the intake gets there. */
  weeks: number | null;
  /** yyyy-mm-dd the target is reached, when the intake gets there. */
  date: string | null;
  /** Protein per kg of body weight, and whether it is under the goal's range. */
  proteinPerKg: number | null;
  proteinLow: boolean;
  /** The least protein the goal's range calls for, g a day. */
  proteinMinG: number;
}

const round = (v: number, step: number) => Math.round(v / step) * step;

export function direction(weightKg: number, targetKg: number): Direction {
  const diff = targetKg - weightKg;
  if (Math.abs(diff) < AT_TARGET_KG) return 'hold';
  return diff < 0 ? 'lose' : 'gain';
}

/** The goal whose ranges apply: the person's own, or the one for the target's direction. */
function effectiveGoal(goal: Goal, dir: Direction): { goal: Goal; overridden: boolean } {
  const [lo, hi] = targetRate(goal, 'intermediate');
  const mid = (lo + hi) / 2;
  if (dir === 'lose')
    return mid < 0 ? { goal, overridden: false } : { goal: 'fat_loss', overridden: true };
  if (dir === 'gain')
    return mid > 0.001
      ? { goal, overridden: false }
      : { goal: 'hypertrophy', overridden: goal !== 'general_fitness' };
  return { goal, overridden: false };
}

/** The share of body weight a week the plan aims for: the middle of the goal's range. */
function planShare(dir: Direction, lo: number, hi: number) {
  return dir === 'hold' ? 0 : (lo + hi) / 2;
}

function floorKcal(bmrKcal: number) {
  return Math.max(MIN_DAILY_KCAL, round(bmrKcal, 50));
}

function addDaysKey(today: string, days: number) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** What eating `kcal` a day (with `proteinG` protein) does for the target weight. */
export function intakeOutcome(
  input: TargetInput & { kcal: number; proteinG: number | null },
): IntakeOutcome {
  const { weightKg, targetKg, maintenanceKcal, kcal, proteinG, today, experience } = input;
  const dir = direction(weightKg, targetKg);
  const eff = effectiveGoal(input.goal, dir).goal;
  const [pLo] = GOAL_PROTEIN[eff];
  const proteinPerKg = proteinG !== null ? Math.round((proteinG / weightKg) * 10) / 10 : null;
  const proteinLow = proteinPerKg !== null && proteinPerKg < pLo - 0.05;
  const rate = rateForKcal(kcal, maintenanceKcal);
  const base = {
    rateKgPerWeek: rate,
    proteinPerKg,
    proteinLow,
    proteinMinG: Math.round(pLo * weightKg),
  };
  if (dir === 'hold') return { ...base, status: 'at_target', weeks: null, date: null };
  if (kcal < MIN_DAILY_KCAL) return { ...base, status: 'too_low', weeks: null, date: null };
  const towards = dir === 'lose' ? -rate : rate;
  if (towards < -NO_CHANGE_KG) return { ...base, status: 'wrong_way', weeks: null, date: null };
  if (towards < NO_CHANGE_KG) return { ...base, status: 'no_change', weeks: null, date: null };
  const weeks = Math.abs(targetKg - weightKg) / towards;
  const share = rate / weightKg;
  const [lo, hi] = targetRate(eff, experience);
  const aim = Math.abs(planShare(dir, lo, hi));
  // Past the evidence range is too fast; under half the planned rate is slow.
  const tooFast = dir === 'lose' ? share < lo - 0.0005 : share > hi + 0.0005;
  const status: IntakeStatus = tooFast
    ? 'too_fast'
    : Math.abs(share) < aim / 2
      ? 'slow'
      : 'on_track';
  return { ...base, status, weeks, date: addDaysKey(today, Math.ceil(weeks * 7)) };
}

/** The suggested calories and protein for the target, with the timeline they give. */
export function targetPlan(input: TargetInput): TargetPlan {
  const { weightKg, targetKg, experience, maintenanceKcal, bmrKcal } = input;
  const dir = direction(weightKg, targetKg);
  const { goal: eff, overridden } = effectiveGoal(input.goal, dir);
  const [lo, hi] = targetRate(eff, experience);
  let rateKg = planShare(dir, lo, hi) * weightKg;
  let kcal = dir === 'hold' ? round(maintenanceKcal, 50) : kcalForRate(maintenanceKcal, rateKg);
  let floored = false;
  if (dir === 'lose' && kcal < floorKcal(bmrKcal)) {
    kcal = floorKcal(bmrKcal);
    rateKg = rateForKcal(kcal, maintenanceKcal);
    floored = true;
  }
  const [pLo, pHi] = GOAL_PROTEIN[eff];
  const proteinG = round(((pLo + pHi) / 2) * weightKg, 5);
  return {
    direction: dir,
    kcal,
    proteinG,
    rateKgPerWeek: rateKg,
    goalOverridden: overridden,
    floored,
    outcome: intakeOutcome({ ...input, kcal, proteinG }),
  };
}

