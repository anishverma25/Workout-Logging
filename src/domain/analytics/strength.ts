import type { Exercise } from '../models/schemas';
import { performanceByExercise } from './performance';
import type { Session } from './sessions';

export interface StrengthTrend {
  exerciseId: string;
  exerciseName: string;
  /** Best e1RM per session, chronological. */
  points: { date: Date; e1rm: number; workoutId: string }[];
  first: number;
  latest: number;
  best: number;
  /** (latest - first) / first */
  change: number;
}

/** Minimum sessions before a trend is shown. Fewer points would be noise. */
export const MIN_TREND_SESSIONS = 3;

/**
 * e1RM trends for load-tracked exercises with enough sessions in [start, end).
 * Ordered by session count, then compound lifts first, then by e1RM.
 */
export function strengthTrends(
  sessions: Session[],
  exercises: Exercise[],
  start: Date,
  end: Date,
): StrengthTrend[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const inWindow = sessions.filter((s) => s.date >= start && s.date < end);
  const trends: StrengthTrend[] = [];

  for (const [exerciseId, perfs] of performanceByExercise(inWindow)) {
    const exercise = byId.get(exerciseId);
    if (!exercise || exercise.trackingType !== 'weight_reps') continue;
    const points = perfs
      .filter((p) => p.chartE1rm !== null)
      .map((p) => ({ date: p.date, e1rm: p.chartE1rm as number, workoutId: p.workoutId }));
    if (points.length < MIN_TREND_SESSIONS) continue;
    const first = points[0]!.e1rm;
    const latest = points[points.length - 1]!.e1rm;
    trends.push({
      exerciseId,
      exerciseName: exercise.name,
      points,
      first,
      latest,
      best: Math.max(...points.map((p) => p.e1rm)),
      change: (latest - first) / first,
    });
  }

  // Headline lifts first: free-weight compounds are the clearest strength signal.
  // Machine loads (a leg press) are not comparable to barbell loads, so magnitude is not used to rank.
  const rank = (t: StrengthTrend) => {
    const e = byId.get(t.exerciseId);
    if (!e) return 3;
    if (e.category === 'compound' && e.equipment === 'barbell') return 0;
    if (e.category === 'compound') return 1;
    return 2;
  };
  return trends.sort((a, b) => rank(a) - rank(b) || b.points.length - a.points.length);
}
