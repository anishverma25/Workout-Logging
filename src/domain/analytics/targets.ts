import type { Experience, Goal } from '../models/schemas';
import { GOAL_PROTEIN, targetRate, type EnergyPlan } from './body';

/**
 * Checks on the calorie and protein targets the person sets themselves, against their estimated
 * maintenance, their goal, their measured weight trend and their lifts. Pure, fixed rules:
 *
 * - Energy: about 7,700 kcal per kg of body weight change (the classic figure for mixed tissue;
 *   a first-weeks guide, since the body adapts as weight changes; Hall 2008). The rate this
 *   predicts is compared with the evidence range for the goal (`targetRate`: 0.5 to 1% of body
 *   weight a week to lose fat while keeping muscle, Helms 2014; small surpluses to gain,
 *   Iraki 2019).
 * - Real maintenance: when the 7-day weight trend has 2 weeks and 6 weigh-ins, eating the target
 *   and changing at rate r means maintenance is target − r × 7,700 / 7.
 * - Protein in g per kg against the goal's range (Morton 2018, Helms 2014).
 * - Strength in a deficit: falling estimated 1RM on most lifts means the deficit is costing
 *   strength.
 */

export const KCAL_PER_KG = 7700;
/** A trend this far from the prediction (kg a week) says the maintenance estimate is off. */
export const RATE_MISMATCH = 0.2;
/** Above this, extra protein has no evidence of benefit. */
export const PROTEIN_HIGH = 3.0;

export interface NutritionTargets {
  kcal: number | null;
  proteinG: number | null;
}

export type TargetTone = 'good' | 'warn' | 'info';

export interface TargetInsight {
  id: 'energy_rate' | 'energy_goal' | 'maintenance' | 'protein' | 'strength';
  tone: TargetTone;
  title: string;
  body: string;
  /** A target that would fix it, when there is one. */
  suggestKcal?: number;
  suggestProteinG?: number;
}

const round = (v: number, step = 1) => Math.round(v / step) * step;
const kgText = (kg: number) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${Math.abs(kg).toFixed(2)} kg`;
const pct = (v: number) => `${(Math.abs(v) * 100).toFixed(1)}%`;
const kcalText = (v: number) => Math.round(v).toLocaleString('en-GB');

/** The daily energy that changes weight at `rate` kg a week from maintenance. */
export const kcalForRate = (maintenance: number, rateKgPerWeek: number) =>
  round(maintenance + (rateKgPerWeek * KCAL_PER_KG) / 7, 50);

/** Predicted weekly change from eating `kcal` a day at `maintenance`. */
export const rateForKcal = (kcal: number, maintenance: number) =>
  ((kcal - maintenance) * 7) / KCAL_PER_KG;

export function targetInsights(input: {
  targets: NutritionTargets;
  energy: EnergyPlan | null;
  /** Smoothed body weight now. */
  weightKg: number | null;
  /** Measured change of the 7-day trend, kg a week, when there is enough data. */
  rateKgPerWeek: number | null;
  goal: Goal;
  experience: Experience;
  /** Weekly change of estimated 1RM on each lift trained in the last 8 weeks. */
  liftRates: number[];
}): TargetInsight[] {
  const { targets, energy, weightKg, rateKgPerWeek, goal, experience, liftRates } = input;
  const out: TargetInsight[] = [];
  const [lo, hi] = targetRate(goal, experience);

  if (targets.kcal !== null && energy && weightKg) {
    const diff = targets.kcal - energy.tdee;
    const expected = rateForKcal(targets.kcal, energy.tdee);
    const share = expected / weightKg;
    const mid = (lo + hi) / 2;
    const suggest = kcalForRate(energy.tdee, mid * weightKg);
    out.push({
      id: 'energy_rate',
      tone: 'info',
      title:
        Math.abs(diff) < 100
          ? 'Your target is about maintenance'
          : `${kcalText(Math.abs(diff))} kcal ${diff < 0 ? 'below' : 'above'} maintenance`,
      body:
        Math.abs(diff) < 100
          ? `Your target of ${kcalText(targets.kcal)} kcal is within 100 of your estimated maintenance (${kcalText(energy.tdee)}), so your weight should hold steady.`
          : `Your target of ${kcalText(targets.kcal)} kcal against an estimated maintenance of ${kcalText(energy.tdee)} predicts about ${kgText(expected)} a week (${pct(share)} of your body weight), from about 7,700 kcal per kg.`,
    });

    const slack = 0.0005;
    const inRange = share >= lo - slack && share <= hi + slack;
    if (inRange) {
      out.push({
        id: 'energy_goal',
        tone: 'good',
        title: 'The right size for your goal',
        body: `That rate is inside the ${pct(lo)} to ${pct(hi)} of body weight a week that the evidence supports for your goal.`,
      });
    } else if (goal === 'fat_loss' && share < lo) {
      out.push({
        id: 'energy_goal',
        tone: 'warn',
        title: 'A deficit this big costs muscle',
        body: `Losing more than 1% of body weight a week loses more muscle and strength in lifters. About ${kcalText(suggest)} kcal would aim for ${pct(mid)} a week instead.`,
        suggestKcal: suggest,
      });
    } else if ((goal === 'fat_loss' || goal === 'recomposition') && share > hi) {
      out.push({
        id: 'energy_goal',
        tone: 'warn',
        title: diff >= 0 ? 'No deficit for fat loss' : 'A very small deficit',
        body: `Your goal needs your weight to come down, but this target ${diff >= 0 ? 'is at or above maintenance' : 'predicts very little loss'}. About ${kcalText(suggest)} kcal would aim for ${pct(mid)} a week.`,
        suggestKcal: suggest,
      });
    } else if (share > hi) {
      out.push({
        id: 'energy_goal',
        tone: 'warn',
        title: 'More surplus than you can build',
        body: `Gaining faster than about ${pct(hi)} of body weight a week at your training age adds mostly fat, not more muscle. About ${kcalText(suggest)} kcal would aim for ${pct(mid)} a week.`,
        suggestKcal: suggest,
      });
    } else {
      out.push({
        id: 'energy_goal',
        tone: 'warn',
        title: share < 0 ? 'A deficit while trying to build' : 'Less than your goal needs',
        body: `For your goal, about ${pct(lo)} to ${pct(hi)} of body weight a week is the aim. This target predicts ${share < 0 ? 'losing weight' : 'slower gains'}. About ${kcalText(suggest)} kcal would aim for ${pct(mid)} a week.`,
        suggestKcal: suggest,
      });
    }

    if (rateKgPerWeek !== null) {
      const implied = targets.kcal - (rateKgPerWeek * KCAL_PER_KG) / 7;
      if (Math.abs(rateKgPerWeek - expected) > RATE_MISMATCH) {
        const better = kcalForRate(implied, mid * weightKg);
        out.push({
          id: 'maintenance',
          tone: 'info',
          title: 'Your weight says your maintenance is different',
          body: `Your 7-day average is changing ${kgText(rateKgPerWeek)} a week, where your target predicts ${kgText(expected)}. If you have been eating close to ${kcalText(targets.kcal)} kcal, your real maintenance is about ${kcalText(round(implied, 50))}, not ${kcalText(energy.tdee)}. For your goal that means about ${kcalText(better)} kcal.`,
          suggestKcal: better,
        });
      } else {
        out.push({
          id: 'maintenance',
          tone: 'good',
          title: 'Your weight matches your target',
          body: `Your 7-day average is changing ${kgText(rateKgPerWeek)} a week, close to the ${kgText(expected)} your target predicts. The maintenance estimate fits you.`,
        });
      }
    }

    if (diff <= -100 && liftRates.length >= 2) {
      const falling = liftRates.filter((r) => r < 0).length;
      if (falling > liftRates.length / 2) {
        out.push({
          id: 'strength',
          tone: 'warn',
          title: 'Your lifts are dropping in this deficit',
          body: `Estimated 1RM is falling on ${falling} of ${liftRates.length} lifts over the last 8 weeks. A smaller deficit (about ${kcalText(round(targets.kcal + 250, 50))} kcal) or a week at maintenance usually stops the slide; keep protein high.`,
          suggestKcal: round(targets.kcal + 250, 50),
        });
      } else {
        out.push({
          id: 'strength',
          tone: 'good',
          title: 'Strength is holding in the deficit',
          body: `Estimated 1RM is steady or rising on ${liftRates.length - falling} of ${liftRates.length} lifts over the last 8 weeks, so the deficit is not costing you strength.`,
        });
      }
    }
  }

  if (targets.proteinG !== null && weightKg) {
    const perKg = targets.proteinG / weightKg;
    const [pLo, pHi] = GOAL_PROTEIN[goal];
    const at = (g: number) => `${perKg.toFixed(1)} g per kg (${round(g)} g a day)`;
    if (perKg < pLo - 0.05) {
      const need = round(pLo * weightKg, 5);
      out.push({
        id: 'protein',
        tone: 'warn',
        title: 'Protein below the useful range',
        body: `Your target is ${at(targets.proteinG)}. For your goal the evidence points to ${pLo} to ${pHi} g per kg; below ${pLo} you build less muscle${goal === 'fat_loss' ? ' and keep less of it in a deficit' : ''}. Aim for at least ${need} g.`,
        suggestProteinG: need,
      });
    } else if (perKg > PROTEIN_HIGH) {
      out.push({
        id: 'protein',
        tone: 'info',
        title: 'More protein than you need',
        body: `Your target is ${at(targets.proteinG)}. No study found extra benefit above about ${pHi} g per kg. It does no harm in healthy people, but those calories could be carbohydrate for training.`,
      });
    } else {
      out.push({
        id: 'protein',
        tone: 'good',
        title: 'Protein in range',
        body: `Your target is ${at(targets.proteinG)}, inside or near the ${pLo} to ${pHi} g per kg the evidence supports for your goal.`,
      });
    }
  }
  return out;
}
