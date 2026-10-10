import {
  addDays,
  differenceInCalendarDays,
  formatDayMonth,
  formatWeekdayShort,
  startOfDay,
  startOfWeek,
  type WeekStartsOn,
} from '@/lib/dates';
import type { WeightUnit } from '@/lib/units';
import { MUSCLE_LABELS } from '../models/labels';
import type { BodyWeightEntry, Exercise, TrackingType } from '../models/schemas';
import {
  bodyWeightSeries,
  bodyWeightTrend,
  type BodyWeightPoint,
  type BodyWeightTrend,
} from './bodyweight';
import { generateInsights, sizeAdjustedStrength, type Insight } from './insights';
import { muscleRecency, muscleWorkload, type MuscleRecency, type MuscleWorkload } from './muscles';
import { performanceByExercise, performanceFor } from './performance';
import {
  balanceRatios,
  detectPlateaus,
  readinessPattern,
  loadSpike,
  strengthProfile,
  type BalanceRatio,
  type Plateau,
  type StrengthProfile,
} from './standards';
import { weightTrend } from './body';
import {
  progressionStyle,
  progressionSuggestions,
  type ProgressionSuggestion,
} from './progression';
import { detectPersonalRecords, type PersonalRecord } from './prs';
import { activeRoutine, adherence, daysForRoutine, type Adherence } from './schedule';
import { buildSessions, isWorkingSet, type Session, type TrainingData } from './sessions';
import { strengthTrends } from './strength';
import { sessionVolumeLoad, setVolumeLoad, totalVolumeLoad } from './volume';

/** A weekly training rate needs at least this many days of history. */
export const FREQUENCY_MIN_DAYS = 7;

export type ProgressRange = '7d' | '30d' | '90d' | 'all';
export type Bucket = 'day' | 'week' | 'month';

export const PROGRESS_RANGE_DAYS: Record<Exclude<ProgressRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export interface Period {
  start: Date;
  end: Date;
  label: string;
  longLabel: string;
  /** The period containing today: may be incomplete. */
  current: boolean;
  /** Starts before the window, so only part of it is counted. */
  partial: boolean;
}

export interface Window {
  start: Date;
  /** Exclusive. */
  end: Date;
  days: number;
}

export interface ExerciseSessionPoint {
  date: Date;
  workoutId: string;
  bestE1rm: number | null;
  /** Heaviest working load and the most reps done with it. */
  topLoad: number | null;
  topLoadReps: number | null;
  workingSets: number;
  volumeKg: number;
  /** Highest estimated 1RM up to and including this session, all time. */
  runningBestE1rm: number | null;
}

export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  trackingType: TrackingType;
  /** Sessions inside the window, oldest first. */
  points: ExerciseSessionPoint[];
  /** e1RM change from the first to the last session in the window; needs 2 sessions. */
  e1rmChange: { first: number; last: number; fraction: number } | null;
  /** e1RM ÷ body weight, and the size-adjusted index e1RM ÷ body weight^0.67 (Jaric 2002). */
  relativeStrength: {
    e1rm: number;
    bodyKg: number;
    ratio: number;
    index: number;
    date: Date;
  } | null;
  records: PersonalRecord[];
}

export interface ExerciseOption {
  id: string;
  name: string;
  sessions: number;
}

export interface ProgressModel {
  range: ProgressRange;
  window: Window;
  previousWindow: Window | null;
  bucket: Bucket;
  sessionsInWindow: number;
  hasAnyData: boolean;
  exerciseOptions: ExerciseOption[];
  selected: ExerciseProgress | null;
  volume: {
    periods: { period: Period; volumeKg: number; workingSets: number }[];
    totalKg: number;
    previousTotalKg: number | null;
    byExercise: { id: string; name: string; volumeKg: number; workingSets: number }[];
  };
  consistency: {
    periods: { period: Period; workouts: number }[];
    total: number;
    perWeek: number | null;
    perMonth: number | null;
    adherence: Adherence;
    minutes: number;
  };
  muscles: { workload: MuscleWorkload[]; weeks: number; recency: MuscleRecency[] };
  body: { points: BodyWeightPoint[]; trend: BodyWeightTrend | null };
  records: PersonalRecord[];
  insights: Insight[];
  progression: ProgressionSuggestion[];
  /** Current state, whatever the date range: levels, plateaus, balance. */
  strength: StrengthProfile;
  plateaus: Plateau[];
  balance: BalanceRatio[];
}

export function progressWindow(range: ProgressRange, now: Date, firstSession: Date | null): Window {
  const end = addDays(startOfDay(now), 1);
  if (range === 'all') {
    const start = startOfDay(firstSession ?? now);
    return { start, end, days: Math.max(1, differenceInCalendarDays(end, start)) };
  }
  const days = PROGRESS_RANGE_DAYS[range];
  return { start: addDays(end, -days), end, days };
}

export function bucketFor(range: ProgressRange, window: Window): Bucket {
  if (range === '7d') return 'day';
  if (range === 'all' && window.days > 7 * 26) return 'month';
  return 'week';
}

const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'short' });
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export function periodsFor(
  window: Window,
  bucket: Bucket,
  weekStartsOn: WeekStartsOn,
  now: Date,
): Period[] {
  const periods: Omit<Period, 'partial'>[] = [];
  const today = startOfDay(now);
  if (bucket === 'day') {
    for (let d = window.start; d < window.end; d = addDays(d, 1)) {
      periods.push({
        start: d,
        end: addDays(d, 1),
        label: formatWeekdayShort(d),
        longLabel: formatDayMonth(d),
        current: d.getTime() === today.getTime(),
      });
    }
  } else if (bucket === 'week') {
    for (let w = startOfWeek(window.start, weekStartsOn); w < window.end; w = addDays(w, 7)) {
      const end = addDays(w, 7);
      periods.push({
        start: w,
        end,
        label: formatDayMonth(w),
        longLabel: `Week of ${formatDayMonth(w)}`,
        current: today >= w && today < end,
      });
    }
  } else {
    let m = new Date(window.start.getFullYear(), window.start.getMonth(), 1);
    while (m < window.end) {
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      periods.push({
        start: m,
        end,
        label: monthLabel.format(m),
        longLabel: monthLong.format(m),
        current: today >= m && today < end,
      });
      m = end;
    }
  }
  return periods.map((p) => ({ ...p, partial: p.start < window.start }));
}

/** Body weight on a date: the latest entry on or before it, else the first entry within 7 days after. */
export function bodyWeightAt(entries: BodyWeightEntry[], date: Date): number | null {
  const alive = entries
    .filter((e) => e.deletedAt === null)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const endOfDay = addDays(startOfDay(date), 1).getTime();
  let before: BodyWeightEntry | null = null;
  for (const e of alive) if (Date.parse(e.measuredAt) < endOfDay) before = e;
  if (before) return before.weightKg;
  const limit = addDays(startOfDay(date), 8).getTime();
  const after = alive.find((e) => Date.parse(e.measuredAt) < limit);
  return after ? after.weightKg : null;
}

/** Load-tracked exercises with sessions in the window, free-weight compounds first. */
export function exerciseOptions(sessions: Session[], exercises: Exercise[]): ExerciseOption[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const counts = new Map<string, { name: string; sessions: number }>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const e = byId.get(ex.workoutExercise.exerciseId);
      if (!e || e.trackingType !== 'weight_reps' || !ex.sets.some(isWorkingSet)) continue;
      const c = counts.get(e.id) ?? { name: e.name, sessions: 0 };
      c.sessions++;
      counts.set(e.id, c);
    }
  }
  const rank = (id: string) => {
    const e = byId.get(id)!;
    if (e.category === 'compound' && e.equipment === 'barbell') return 0;
    if (e.category === 'compound') return 1;
    return 2;
  };
  return [...counts.entries()]
    .map(([id, c]) => ({ id, ...c }))
    .sort(
      (a, b) => rank(a.id) - rank(b.id) || b.sessions - a.sessions || a.name.localeCompare(b.name),
    );
}

function exerciseProgress(
  exerciseId: string,
  allSessions: Session[],
  window: Window,
  exercises: Exercise[],
  bodyWeights: BodyWeightEntry[],
  records: PersonalRecord[],
): ExerciseProgress | null {
  const exercise = exercises.find((e) => e.id === exerciseId);
  if (!exercise) return null;
  const points: ExerciseSessionPoint[] = [];
  let running: number | null = null;
  for (const session of allSessions) {
    const ex = session.exercises.find((e) => e.workoutExercise.exerciseId === exerciseId);
    if (!ex || !ex.sets.some(isWorkingSet)) continue;
    const perf = performanceFor(exercise, exerciseId, session.workout.id, session.date, ex.sets);
    if (perf.bestE1rm !== null) running = Math.max(running ?? 0, perf.bestE1rm);
    if (session.date < window.start || session.date >= window.end) continue;
    const working = ex.sets.filter(isWorkingSet);
    const topLoad = perf.heaviestLoad;
    points.push({
      date: session.date,
      workoutId: session.workout.id,
      // Charts use the best 1 to 6 rep set when there is one (Evidence Corner, metric 1).
      bestE1rm: perf.chartE1rm,
      topLoad,
      topLoadReps:
        topLoad === null
          ? null
          : Math.max(...working.filter((s) => s.weightKg === topLoad).map((s) => s.reps ?? 0)),
      workingSets: working.length,
      volumeKg: working.reduce((sum, s) => sum + setVolumeLoad(s, exercise), 0),
      runningBestE1rm: running,
    });
  }
  const withE1rm = points.filter((p) => p.bestE1rm !== null);
  const first = withE1rm[0];
  const last = withE1rm[withE1rm.length - 1];
  const e1rmChange =
    first && last && withE1rm.length >= 2
      ? {
          first: first.bestE1rm!,
          last: last.bestE1rm!,
          fraction: (last.bestE1rm! - first.bestE1rm!) / first.bestE1rm!,
        }
      : null;
  let relativeStrength: ExerciseProgress['relativeStrength'] = null;
  if (last && exercise.trackingType === 'weight_reps') {
    const bodyKg = bodyWeightAt(bodyWeights, last.date);
    if (bodyKg)
      relativeStrength = {
        e1rm: last.bestE1rm!,
        bodyKg,
        ratio: last.bestE1rm! / bodyKg,
        index: sizeAdjustedStrength(last.bestE1rm!, bodyKg),
        date: last.date,
      };
  }
  return {
    exerciseId,
    name: exercise.name,
    trackingType: exercise.trackingType,
    points,
    e1rmChange,
    relativeStrength,
    records: records.filter((r) => r.exerciseId === exerciseId),
  };
}

export interface ProgressOptions {
  range: ProgressRange;
  exerciseId: string | null;
  now: Date;
  weekStartsOn: WeekStartsOn;
  unit: WeightUnit;
}

/**
 * Everything on the Progress screen, from the logged records only. One function, so every
 * chart, number and insight on the screen comes from the same slice of data and agrees.
 */
export function buildProgress(data: TrainingData, options: ProgressOptions): ProgressModel {
  const { range, now, weekStartsOn, unit } = options;
  const sessions = buildSessions(data);
  const window = progressWindow(range, now, sessions[0]?.date ?? null);
  const previousWindow =
    range === 'all'
      ? null
      : { start: addDays(window.start, -window.days), end: window.start, days: window.days };
  const inWindow = sessions.filter((s) => s.date >= window.start && s.date < window.end);
  const inPrevious = previousWindow
    ? sessions.filter((s) => s.date >= previousWindow.start && s.date < previousWindow.end)
    : [];
  const bucket = bucketFor(range, window);
  const periods = periodsFor(window, bucket, weekStartsOn, now);
  const allRecords = detectPersonalRecords(sessions, data.exercises);
  const records = allRecords.filter((r) => r.date >= window.start && r.date < window.end);
  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]));
  const rankOf = (id: string) => {
    const e = exerciseById.get(id);
    return !e
      ? 3
      : e.category === 'compound' && e.equipment === 'barbell'
        ? 0
        : e.category === 'compound'
          ? 1
          : 2;
  };

  // Exercise
  const options_ = exerciseOptions(inWindow, data.exercises);
  // Default: the top-ranked lift, preferring one with a record in this period when tied.
  const withRecord = new Set(records.map((r) => r.exerciseId));
  const top = options_[0];
  const defaultId =
    (top &&
      options_.find(
        (o) =>
          o.sessions === top.sessions && withRecord.has(o.id) && rankOf(o.id) === rankOf(top.id),
      )?.id) ??
    top?.id ??
    null;
  const selectedId =
    options.exerciseId && options_.some((o) => o.id === options.exerciseId)
      ? options.exerciseId
      : defaultId;
  const selected = selectedId
    ? exerciseProgress(selectedId, sessions, window, data.exercises, data.bodyWeights, records)
    : null;

  // Volume
  const inPeriod = (p: Period) => inWindow.filter((s) => s.date >= p.start && s.date < p.end);
  const byExercise = new Map<
    string,
    { id: string; name: string; volumeKg: number; workingSets: number }
  >();
  for (const s of inWindow) {
    for (const ex of s.exercises) {
      const id = ex.workoutExercise.exerciseId;
      const v = ex.sets.reduce((sum, set) => sum + setVolumeLoad(set, ex.exercise), 0);
      const n = ex.sets.filter(isWorkingSet).length;
      if (n === 0) continue;
      const cur = byExercise.get(id) ?? {
        id,
        name: ex.workoutExercise.exerciseName,
        volumeKg: 0,
        workingSets: 0,
      };
      cur.volumeKg += v;
      cur.workingSets += n;
      byExercise.set(id, cur);
    }
  }
  const totalKg = totalVolumeLoad(inWindow);
  // Compare with the previous period only when the history covers all of it; a half-empty
  // previous period would make any change look dramatic.
  const previousCovered =
    !!previousWindow && !!sessions[0] && startOfDay(sessions[0].date) <= previousWindow.start;
  const previousTotalKg = previousCovered ? totalVolumeLoad(inPrevious) : null;

  // Consistency
  const routine = activeRoutine(data.routines);
  const days = daysForRoutine(routine, data.routineDays);
  const since = routine ? new Date(routine.createdAt) : null;
  const weeks = window.days / 7;
  const firstEver = sessions[0]?.date ?? null;
  // Rates need enough time to mean something, and never count days before the first workout.
  const coveredDays = firstEver
    ? Math.min(
        window.days,
        Math.max(1, differenceInCalendarDays(window.end, startOfDay(firstEver))),
      )
    : 0;

  // Insights
  const names = new Map(data.exercises.map((e) => [e.id, e.name]));
  const insights = generateInsights({
    trends: strengthTrends(sessions, data.exercises, window.start, window.end),
    history: performanceByExercise(sessions),
    exerciseNames: names,
    compoundIds: new Set(data.exercises.filter((e) => e.category === 'compound').map((e) => e.id)),
    recentAdherence: adherence(
      sessions,
      days,
      routine?.id ?? null,
      window.start,
      window.end,
      now,
      since,
    ),
    volumeThisPeriod: totalKg,
    volumePreviousPeriod: previousTotalKg ?? 0,
    periodDays: window.days,
    bodyKgAt: (d) => bodyWeightAt(data.bodyWeights, d),
    unit,
    recentSince: window.start,
  });
  const workload = muscleWorkload(inWindow);
  if (window.days >= 14) {
    const everTrained = new Set(
      muscleWorkload(sessions)
        .filter((w) => w.direct > 0)
        .map((w) => w.muscle),
    );
    const missing = workload.filter((w) => w.direct === 0 && everTrained.has(w.muscle));
    if (missing.length > 0 && inWindow.length >= 3) {
      const list = joinList(missing.map((m) => MUSCLE_LABELS[m.muscle].toLowerCase()));
      insights.push({
        id: 'untrained-muscles',
        tone: 'neutral',
        title: `No direct work for ${list} in this period.`,
        basis: `Based on the primary muscle of each exercise you logged in the last ${window.days} days. You have trained ${missing.length === 1 ? 'it' : 'them'} directly before. This may be on purpose.`,
        priority: 2,
      });
    }
  }
  const progression = progressionSuggestions(
    sessions,
    data.exercises,
    progressionStyle(data.profile?.experience),
  );
  if (progression.length > 0) {
    insights.push({
      id: 'progression-ready',
      tone: 'positive',
      title: `${progression.length} ${progression.length === 1 ? 'exercise is' : 'exercises are'} ready for a little more load.`,
      basis:
        progressionStyle(data.profile?.experience) === 'linear'
          ? 'Every target set reached the planned reps at the planned effort last time. See the suggestions below.'
          : 'Every target set reached the top of its rep range at the planned effort last time. See the suggestions below.',
      priority: 5.5,
    });
  }
  const spike = loadSpike(sessions, now);
  if (spike) {
    insights.push({
      id: 'load-spike',
      tone: 'attention',
      title: `You did ${spike.acuteSets} working sets in the last 7 days, ${spike.ratio.toFixed(1)} times your usual week.`,
      basis: `Your usual week over the 4 weeks before was ${Math.round(spike.chronicSetsPerWeek)} sets. Jumps above 1.5 times are linked with more injuries in sports science research. Build up over a few weeks instead.`,
      priority: 6,
    });
  }
  const history = performanceByExercise(sessions);
  const trend = weightTrend(data.bodyWeights);
  const pattern = readinessPattern(sessions, history);
  if (pattern) {
    const gap = (pattern.good.change - pattern.poor.change) * 100;
    if (Math.abs(gap) >= 1)
      insights.push({
        id: 'readiness-pattern',
        tone: 'neutral',
        title:
          gap > 0
            ? `Your lifts go better after ${pattern.factor === 'sleep' ? 'a good night' : 'a high-energy day'}.`
            : `${pattern.factor === 'sleep' ? 'Sleep' : 'Energy'} has not held your lifts back so far.`,
        basis: `Best estimated 1RM against the previous session of each lift: ${formatPct(pattern.good.change)} on days you rated ${pattern.factor} 4 or 5 (${pattern.good.sessions} sessions), ${formatPct(pattern.poor.change)} on days you rated it 1 or 2 (${pattern.poor.sessions} sessions).`,
        priority: 3,
      });
  }

  return {
    range,
    window,
    previousWindow,
    bucket,
    sessionsInWindow: inWindow.length,
    hasAnyData: sessions.length > 0,
    exerciseOptions: options_,
    selected,
    volume: {
      periods: periods.map((period) => {
        const ss = inPeriod(period);
        return {
          period,
          volumeKg: ss.reduce((sum, s) => sum + sessionVolumeLoad(s), 0),
          workingSets: ss.reduce(
            (n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter(isWorkingSet).length, 0),
            0,
          ),
        };
      }),
      totalKg,
      previousTotalKg,
      byExercise: [...byExercise.values()].sort(
        (a, b) => b.volumeKg - a.volumeKg || b.workingSets - a.workingSets,
      ),
    },
    consistency: {
      periods: periods.map((period) => ({ period, workouts: inPeriod(period).length })),
      total: inWindow.length,
      perWeek: coveredDays >= FREQUENCY_MIN_DAYS ? inWindow.length / (coveredDays / 7) : null,
      perMonth: coveredDays >= 28 ? inWindow.length / (coveredDays / 30.4375) : null,
      adherence: adherence(
        sessions,
        days,
        routine?.id ?? null,
        window.start,
        window.end,
        now,
        since,
      ),
      minutes: inWindow.reduce((n, s) => {
        const { startedAt, endedAt, pausedMs } = s.workout;
        return endedAt
          ? n + Math.max(0, (Date.parse(endedAt) - Date.parse(startedAt) - pausedMs) / 60_000)
          : n;
      }, 0),
    },
    muscles: { workload, weeks, recency: muscleRecency(sessions, now) },
    body: (() => {
      const points = bodyWeightSeries(data.bodyWeights).filter(
        (p) => p.date >= window.start && p.date < window.end,
      );
      return { points, trend: bodyWeightTrend(points) };
    })(),
    records,
    insights: insights.sort((a, b) => b.priority - a.priority),
    progression,
    strength: strengthProfile(
      history,
      data.exercises,
      trend[trend.length - 1]?.trendKg ?? null,
      data.profile?.sex,
      now,
    ),
    plateaus: detectPlateaus(history, now, data.profile?.experience),
    balance: balanceRatios(sessions, now),
  };
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const formatPct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
