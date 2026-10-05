import { addDays, isSameDay, startOfDay, startOfWeek } from '@/lib/dates';
import type { Preferences, RoutineDay, RoutineExercise } from '../models/schemas';
import { bodyWeightSummary, type BodyWeightSummary } from './bodyweight';
import { generateInsights, type Insight } from './insights';
import { performanceByExercise } from './performance';
import { detectPersonalRecords, featuredRecord, type PersonalRecord } from './prs';
import {
  activeRoutine,
  adherence,
  dayStatuses,
  daysForRoutine,
  nextPlannedDay,
  plannedDayOn,
  weeklySessionCounts,
  type Adherence,
  type DayStatus,
  type WeekCount,
} from './schedule';
import {
  buildSessions,
  isAlive,
  sessionDurationMinutes,
  sessionsBetween,
  workingSetCount,
  type Session,
  type TrainingData,
} from './sessions';
import { strengthTrends, type StrengthTrend } from './strength';
import { sessionVolumeLoad, totalVolumeLoad } from './volume';

export const RECENT_DAYS = 7;
export const TREND_DAYS = 35;
export const CONSISTENCY_WEEKS = 4;

export interface PlannedExercise {
  id: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
}

export type TodayPlan =
  | {
      kind: 'planned';
      day: RoutineDay;
      routineName: string;
      exercises: PlannedExercise[];
      lastSession: Session | null;
      estimatedMinutes: number | null;
    }
  | { kind: 'done'; session: Session; volumeKg: number; workingSets: number }
  | { kind: 'rest'; next: { day: RoutineDay; date: Date } | null; routineName: string }
  | { kind: 'no_routine' };

export interface RecentWorkout {
  session: Session;
  minutes: number | null;
  workingSets: number;
  volumeKg: number;
  prCount: number;
}

export interface DashboardModel {
  hasTrainingData: boolean;
  today: TodayPlan;
  recentWindow: {
    days: DayStatus[];
    sessions: number;
    workingSets: number;
    volumeKg: number;
    minutes: number;
    adherence: Adherence;
  };
  consistency: {
    weeks: WeekCount[];
    averagePerWeek: number | null;
    plannedPerWeek: number | null;
    adherence: Adherence;
  };
  featuredPr: PersonalRecord | null;
  recentPrCount: number;
  bodyWeight: BodyWeightSummary | null;
  strength: StrengthTrend[];
  recent: RecentWorkout[];
  insights: Insight[];
}

function plannedExercises(
  day: RoutineDay,
  routineExercises: RoutineExercise[],
  names: Map<string, string>,
): PlannedExercise[] {
  return routineExercises
    .filter((re) => isAlive(re) && re.routineDayId === day.id)
    .sort((a, b) => a.order - b.order)
    .map((re) => ({
      id: re.id,
      name: names.get(re.exerciseId) ?? 'Exercise',
      sets: re.targetSets,
      repMin: re.repMin,
      repMax: re.repMax,
    }));
}

export function buildDashboard(data: TrainingData, prefs: Preferences, now: Date): DashboardModel {
  const sessions = buildSessions(data);
  const names = new Map(data.exercises.map((e) => [e.id, e.name]));
  const routine = activeRoutine(data.routines);
  const days = daysForRoutine(routine, data.routineDays);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  // Today
  let todayPlan: TodayPlan;
  const todaySession = [...sessions].reverse().find((s) => isSameDay(s.date, now));
  const plannedToday = plannedDayOn(now, days);
  if (todaySession) {
    todayPlan = {
      kind: 'done',
      session: todaySession,
      volumeKg: sessionVolumeLoad(todaySession),
      workingSets: workingSetCount(todaySession),
    };
  } else if (!routine) {
    todayPlan = { kind: 'no_routine' };
  } else if (plannedToday) {
    const lastSession =
      [...sessions].reverse().find((s) => s.workout.routineDayId === plannedToday.id) ?? null;
    todayPlan = {
      kind: 'planned',
      day: plannedToday,
      routineName: routine.name,
      exercises: plannedExercises(plannedToday, data.routineExercises, names),
      lastSession,
      estimatedMinutes: lastSession ? sessionDurationMinutes(lastSession) : null,
    };
  } else {
    todayPlan = { kind: 'rest', next: nextPlannedDay(now, days), routineName: routine.name };
  }

  // Rolling recent window: the last 7 days including today.
  const recentStart = addDays(today, -(RECENT_DAYS - 1));
  const recentSessions = sessionsBetween(sessions, recentStart, tomorrow);
  const previousSessions = sessionsBetween(
    sessions,
    addDays(recentStart, -RECENT_DAYS),
    recentStart,
  );
  const recentAdherence = adherence(
    sessions,
    days,
    routine?.id ?? null,
    recentStart,
    tomorrow,
    now,
  );

  // Consistency over complete calendar weeks before the current one.
  const weekStart = startOfWeek(now, prefs.weekStartsOn);
  const weeks = weeklySessionCounts(sessions, CONSISTENCY_WEEKS + 1, now, prefs.weekStartsOn);
  const completeWeeks = weeks.slice(0, CONSISTENCY_WEEKS);
  const firstSession = sessions[0];
  const coveredWeeks = firstSession
    ? completeWeeks.filter((w) => addDays(w.weekStart, 7) > startOfDay(firstSession.date))
    : [];
  const plannedPerWeek = days.length > 0 ? days.reduce((n, d) => n + d.weekdays.length, 0) : null;

  // Records, trends and body weight.
  const records = detectPersonalRecords(sessions, data.exercises);
  const trends = strengthTrends(
    sessions,
    data.exercises,
    addDays(today, -(TREND_DAYS - 1)),
    tomorrow,
  );
  const recentVolume = totalVolumeLoad(recentSessions);

  const insights = generateInsights({
    trends,
    history: performanceByExercise(sessions),
    exerciseNames: names,
    compoundIds: new Set(data.exercises.filter((e) => e.category === 'compound').map((e) => e.id)),
    recentAdherence,
    volumeThisPeriod: recentVolume,
    volumePreviousPeriod: totalVolumeLoad(previousSessions),
    periodDays: RECENT_DAYS,
    unit: prefs.weightUnit,
    recentSince: recentStart,
  });

  // Count exercises with a record, not record types: one great set is one PR, not three.
  const prExercisesByWorkout = new Map<string, Set<string>>();
  for (const r of records) {
    const set = prExercisesByWorkout.get(r.workoutId) ?? new Set<string>();
    set.add(r.exerciseId);
    prExercisesByWorkout.set(r.workoutId, set);
  }

  return {
    hasTrainingData: sessions.length > 0,
    today: todayPlan,
    recentWindow: {
      days: dayStatuses(sessions, days, recentStart, RECENT_DAYS, now),
      sessions: recentSessions.length,
      workingSets: recentSessions.reduce((n, s) => n + workingSetCount(s), 0),
      volumeKg: recentVolume,
      minutes: recentSessions.reduce((n, s) => n + (sessionDurationMinutes(s) ?? 0), 0),
      adherence: recentAdherence,
    },
    consistency: {
      weeks,
      averagePerWeek:
        coveredWeeks.length >= 2
          ? coveredWeeks.reduce((n, w) => n + w.sessions, 0) / coveredWeeks.length
          : null,
      plannedPerWeek,
      adherence: adherence(
        sessions,
        days,
        routine?.id ?? null,
        coveredWeeks[0]?.weekStart ?? weekStart,
        weekStart,
        now,
      ),
    },
    featuredPr: featuredRecord(records.filter((r) => r.date >= addDays(today, -(TREND_DAYS - 1)))),
    recentPrCount: new Set(
      records.filter((r) => r.date >= recentStart).map((r) => `${r.workoutId}:${r.exerciseId}`),
    ).size,
    bodyWeight: bodyWeightSummary(data.bodyWeights),
    strength: trends.slice(0, 3),
    recent: [...sessions]
      .reverse()
      .slice(0, 3)
      .map((session) => ({
        session,
        minutes: sessionDurationMinutes(session),
        workingSets: workingSetCount(session),
        volumeKg: sessionVolumeLoad(session),
        prCount: prExercisesByWorkout.get(session.workout.id)?.size ?? 0,
      })),
    insights,
  };
}
