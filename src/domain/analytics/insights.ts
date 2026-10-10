import type { WeightUnit } from '@/lib/units';
import { formatWeight } from '@/lib/units';
import { formatDayMonth } from '@/lib/dates';
import { formatSignedPercent } from '@/lib/format';
import type { Adherence } from './schedule';
import type { ExercisePerformance } from './performance';
import type { StrengthTrend } from './strength';

export type InsightTone = 'positive' | 'attention' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  /** Plain statement of the data the insight is computed from. */
  basis: string;
  priority: number;
}

/**
 * What counts as real change (Evidence Corner, metric 13). A tested 1RM varies about 4.2% from
 * test to test (median coefficient of variation, Grgic et al. 2020), and an estimate from a rep
 * set is noisier, so strength changes are only called above 5%.
 */
export const STRENGTH_CHANGE_THRESHOLD = 0.05;
export const BELOW_BEST_THRESHOLD = 0.05;
export const VOLUME_CHANGE_THRESHOLD = 0.05;
/**
 * Strength scaled for body size: e1RM ÷ body weight^0.67 (Jaric 2002). Force scales with muscle
 * cross-section, which scales with mass to the two-thirds power.
 */
export const SIZE_EXPONENT = 0.67;
export const sizeAdjustedStrength = (e1rmKg: number, bodyKg: number) =>
  e1rmKg / Math.pow(bodyKg, SIZE_EXPONENT);

interface InsightInput {
  trends: StrengthTrend[];
  /** Per exercise, all-time chronological performances. */
  history: Map<string, ExercisePerformance[]>;
  exerciseNames: Map<string, string>;
  compoundIds: Set<string>;
  recentAdherence: Adherence;
  volumeThisPeriod: number;
  volumePreviousPeriod: number;
  periodDays: number;
  unit: WeightUnit;
  /** Only flag drops in sessions after this date. */
  recentSince: Date;
  /** Body weight on a date, for the size-adjusted trend. */
  bodyKgAt?: (date: Date) => number | null;
}

export function generateInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const { unit } = input;

  // Latest session clearly below the best estimated 1RM on record.
  // Compound lifts only: high-rep isolation work makes e1RM too noisy to flag a single session.
  for (const [exerciseId, perfs] of input.history) {
    if (!input.compoundIds.has(exerciseId)) continue;
    const withE1rm = perfs.filter((p) => p.bestE1rm !== null);
    const latest = withE1rm[withE1rm.length - 1];
    if (!latest || latest.date < input.recentSince || withE1rm.length < 3) continue;
    const earlier = withE1rm.slice(0, -1);
    const previous = earlier[earlier.length - 1]!;
    // A heavier load with fewer reps is normal progression, not a decline.
    if ((latest.heaviestLoad ?? 0) > (previous.heaviestLoad ?? 0)) continue;
    const best = Math.max(...earlier.map((p) => p.bestE1rm as number));
    const drop = (best - (latest.bestE1rm as number)) / best;
    if (drop >= BELOW_BEST_THRESHOLD) {
      const name = input.exerciseNames.get(exerciseId) ?? 'This exercise';
      insights.push({
        id: `below-best:${exerciseId}`,
        tone: 'attention',
        title: `Your last ${name} session was ${Math.round(drop * 100)}% below your best estimated 1RM.`,
        basis: `Best e1RM ${formatWeight(best, unit)}, last session ${formatWeight(latest.bestE1rm as number, unit)} on ${formatDayMonth(latest.date)}. One session is not a trend; sleep, food and fatigue all affect a single day.`,
        priority: 10 + drop * 100,
      });
    }
  }

  // Strength trend for the most-trained lifts.
  const flagged = new Set(insights.map((i) => i.id.split(':')[1]));
  for (const trend of input.trends.slice(0, 3)) {
    if (flagged.has(trend.exerciseId)) continue; // one insight per exercise
    const first = trend.points[0]!;
    const last = trend.points[trend.points.length - 1]!;
    // Size-adjusted change, when body weight is known at both ends and moved.
    const b0 = input.bodyKgAt?.(first.date) ?? null;
    const b1 = input.bodyKgAt?.(last.date) ?? null;
    const adjusted =
      b0 && b1 && Math.abs(b1 - b0) / b0 >= 0.02
        ? sizeAdjustedStrength(last.e1rm, b1) / sizeAdjustedStrength(first.e1rm, b0) - 1
        : null;
    if (Math.abs(trend.change) < STRENGTH_CHANGE_THRESHOLD) {
      // Flat on the bar but clearly stronger for your size, e.g. while losing weight.
      if (adjusted !== null && adjusted >= STRENGTH_CHANGE_THRESHOLD) {
        insights.push({
          id: `relative:${trend.exerciseId}`,
          tone: 'positive',
          title: `For your body weight, your ${trend.exerciseName} is ${Math.round(adjusted * 100)}% stronger since ${formatDayMonth(first.date)}.`,
          basis: `Estimated 1RM ÷ body weight^0.67, which accounts for body size: body weight ${formatWeight(b0!, unit)} to ${formatWeight(b1!, unit)}, e1RM ${formatWeight(first.e1rm, unit)} to ${formatWeight(last.e1rm, unit)}.`,
          priority: 6 + adjusted * 50,
        });
      }
      continue;
    }
    const up = trend.change > 0;
    insights.push({
      id: `trend:${trend.exerciseId}`,
      tone: up ? 'positive' : 'attention',
      title: `Your ${trend.exerciseName} estimated 1RM ${up ? 'rose' : 'fell'} ${formatSignedPercent(trend.change).replace(/^[+−]/, '')} since ${formatDayMonth(first.date)}.`,
      basis: `Best e1RM per session: ${formatWeight(first.e1rm, unit)} on ${formatDayMonth(first.date)} to ${formatWeight(last.e1rm, unit)} on ${formatDayMonth(last.date)}, across ${trend.points.length} sessions.${adjusted !== null ? ` Adjusted for body weight: ${formatSignedPercent(adjusted)}.` : ''}`,
      priority: 6 + Math.abs(trend.change) * 50,
    });
  }

  // Volume compared with the previous equal-length period.
  if (input.volumeThisPeriod > 0 && input.volumePreviousPeriod > 0) {
    const change =
      (input.volumeThisPeriod - input.volumePreviousPeriod) / input.volumePreviousPeriod;
    if (Math.abs(change) >= VOLUME_CHANGE_THRESHOLD) {
      insights.push({
        id: 'volume-change',
        tone: 'neutral',
        title: `Your volume load was ${Math.round(Math.abs(change) * 100)}% ${change > 0 ? 'higher' : 'lower'} than the previous ${input.periodDays} days.`,
        basis: `${formatWeight(input.volumeThisPeriod, unit, 0)} vs ${formatWeight(input.volumePreviousPeriod, unit, 0)} of load × reps on working sets. Volume load tracks work done; it is not a direct measure of muscle growth.`,
        priority: 4 + Math.abs(change) * 10,
      });
    }
  }

  // Adherence is not an insight (decision D7): Home and Progress show it as a stat already,
  // with the same wording, so repeating it here would duplicate it.

  return insights.sort((a, b) => b.priority - a.priority);
}
