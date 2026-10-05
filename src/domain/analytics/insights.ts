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

/** Thresholds are deliberately conservative so small fluctuations are not reported as trends. */
export const STRENGTH_CHANGE_THRESHOLD = 0.02;
export const BELOW_BEST_THRESHOLD = 0.04;
export const VOLUME_CHANGE_THRESHOLD = 0.05;

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
    if (Math.abs(trend.change) < STRENGTH_CHANGE_THRESHOLD) continue;
    if (flagged.has(trend.exerciseId)) continue; // one insight per exercise
    const up = trend.change > 0;
    const first = trend.points[0]!;
    const last = trend.points[trend.points.length - 1]!;
    insights.push({
      id: `trend:${trend.exerciseId}`,
      tone: up ? 'positive' : 'attention',
      title: `Your ${trend.exerciseName} estimated 1RM ${up ? 'rose' : 'fell'} ${formatSignedPercent(trend.change).replace(/^[+−]/, '')} since ${formatDayMonth(first.date)}.`,
      basis: `Best e1RM per session: ${formatWeight(first.e1rm, unit)} on ${formatDayMonth(first.date)} to ${formatWeight(last.e1rm, unit)} on ${formatDayMonth(last.date)}, across ${trend.points.length} sessions.`,
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
        basis: `${Math.round(input.volumeThisPeriod).toLocaleString()} kg vs ${Math.round(input.volumePreviousPeriod).toLocaleString()} kg of load x reps on working sets. Volume load tracks work done; it is not a direct measure of muscle growth.`,
        priority: 4 + Math.abs(change) * 10,
      });
    }
  }

  // Adherence for the recent period.
  const { planned, completed } = input.recentAdherence;
  if (planned >= 2) {
    insights.push({
      id: 'adherence',
      tone: completed === planned ? 'positive' : 'neutral',
      title: `You completed ${completed} of ${planned} planned sessions in the last ${input.periodDays} days.`,
      basis: `Planned sessions come from your routine's training days. Today only counts once you log it.`,
      priority: completed === planned ? 5 : 3,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
