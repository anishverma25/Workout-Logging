import { addDays } from '@/lib/dates';
import type { BodyWeightEntry, TrainingGoal } from '../models/schemas';
import { weeklyRate, weightTrend } from './body';
import type { ExercisePerformance } from './performance';
import { e1rmRate } from './standards';

export interface GoalProgress {
  goal: TrainingGoal;
  /** Where you are now, in kg. Null without recent data. */
  current: number | null;
  start: number | null;
  /** 0 to 1 from the start value to the target. */
  fraction: number | null;
  reached: boolean;
  /** kg per week toward (positive) or away from (negative) the target. */
  ratePerWeek: number | null;
  /** When the current rate reaches the target. Null when it never would, or within 3 years. */
  projected: Date | null;
  /** Compared with the target date, when both exist. */
  pace: 'ahead' | 'on_track' | 'behind' | null;
}

/** Lifts count from the last 8 weeks: a goal is about what you can do now. */
export const GOAL_WINDOW_WEEKS = 8;
/** A projection needs this many data points... */
export const PROJECTION_MIN_POINTS = 4;
/** ...spread over at least this many weeks. */
export const PROJECTION_MIN_WEEKS = 3;

function slope(points: { date: Date; value: number }[]): number | null {
  if (points.length < PROJECTION_MIN_POINTS) return null;
  const span = (points[points.length - 1]!.date.getTime() - points[0]!.date.getTime()) / 86_400_000;
  if (span < PROJECTION_MIN_WEEKS * 7) return null;
  const xs = points.map((p) => p.date.getTime() / (7 * 86_400_000));
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i]! - my);
    den += (x - mx) ** 2;
  });
  return den === 0 ? null : num / den;
}

/**
 * Progress toward one goal. Lift goals use the best estimated 1RM (or heaviest load) of the
 * last 8 weeks and the trend fitted to every session of the lift; body weight goals use the
 * smoothed weight trend. The projection simply extends the current rate in a straight line.
 */
export function goalProgress(
  goal: TrainingGoal,
  history: Map<string, ExercisePerformance[]>,
  bodyWeights: BodyWeightEntry[],
  now: Date,
): GoalProgress {
  let current: number | null = null;
  let rate: number | null = null;
  if (goal.kind === 'body_weight') {
    const trend = weightTrend(bodyWeights);
    current = trend[trend.length - 1]?.trendKg ?? null;
    rate = weeklyRate(trend, now);
  } else if (goal.exerciseId) {
    const from = addDays(now, -GOAL_WINDOW_WEEKS * 7);
    const list = (history.get(goal.exerciseId) ?? []).filter((p) => p.date <= now);
    const recent = list.filter((p) => p.date >= from);
    if (goal.kind === 'exercise_e1rm') {
      const values = recent.map((p) => p.bestE1rm ?? 0).filter((v) => v > 0);
      current = values.length ? Math.max(...values) : null;
      rate = e1rmRate(list, now, GOAL_WINDOW_WEEKS);
    } else {
      const points = recent
        .filter((p) => (p.heaviestLoad ?? 0) > 0)
        .map((p) => ({ date: p.date, value: p.heaviestLoad! }));
      current = points.length ? Math.max(...points.map((p) => p.value)) : null;
      rate = slope(points);
    }
  }

  const start = goal.startValue ?? current;
  const up = goal.kind !== 'body_weight' || (start !== null && goal.targetValue >= start);
  const reached =
    !!goal.achievedAt ||
    (current !== null &&
      (up ? current >= goal.targetValue - 1e-9 : current <= goal.targetValue + 1e-9));
  const fraction =
    current !== null && start !== null && goal.targetValue !== start
      ? Math.min(1, Math.max(0, (current - start) / (goal.targetValue - start)))
      : reached
        ? 1
        : null;
  // Rate toward the target: positive when moving the right way.
  const toward = rate === null ? null : up ? rate : -rate;
  let projected: Date | null = null;
  if (!reached && current !== null && toward !== null && toward > 0.01) {
    const weeks = Math.abs(goal.targetValue - current) / toward;
    if (weeks <= 156) projected = addDays(now, Math.ceil(weeks * 7));
  }
  let pace: GoalProgress['pace'] = null;
  if (!reached && goal.targetDate) {
    const [y, m, d] = goal.targetDate.split('-').map(Number) as [number, number, number];
    const due = new Date(y, m - 1, d);
    if (!projected) pace = 'behind';
    else {
      const diff = (due.getTime() - projected.getTime()) / 86_400_000;
      pace = diff > 14 ? 'ahead' : diff >= -7 ? 'on_track' : 'behind';
    }
  }
  return {
    goal,
    current,
    start,
    fraction,
    reached,
    ratePerWeek: toward,
    projected,
    pace,
  };
}
