import { addDays, startOfDay, startOfWeek, toDateKey, type WeekStartsOn } from '@/lib/dates';
import { estimateOneRepMax, supportsE1rm } from '../analytics/e1rm';
import { isHardSet } from '../analytics/muscles';
import { isWorkingSet, type Session } from '../analytics/sessions';
import { STRENGTH_MUSCLES } from '../models/schemas';
import { LOGGED_DAY_KCAL } from './limits';

/**
 * What one week of logs says, in the few numbers the brain reasons about. Everything the
 * response model and the engine use comes from these, so the simulation tests can write a
 * person's weeks directly and the app builds the same shape from real logs.
 */
export interface LiftWeek {
  /** The muscle the lift mainly trains. */
  muscle: string;
  /** Best estimated 1RM of the week (sets of up to 10 reps). */
  e1rm: number;
  /** Reps of the set that gave it. */
  topReps: number;
  sessions: number;
}

export interface WeekFacts {
  /** Monday of the week, yyyy-mm-dd. */
  weekStart: string;
  sessions: number;
  /** Days with enough food logged to count, and the means over those days. */
  foodDays: number;
  meanKcal: number | null;
  meanProteinG: number | null;
  /** Days with a weigh-in, and the mean of them. */
  weighIns: number;
  meanWeightKg: number | null;
  /** Hard sets per muscle (direct 1, helping 0.5). */
  muscles: Record<string, number>;
  /** Compound lifts trained this week, by exercise id. */
  lifts: Record<string, LiftWeek>;
  /** Median reps in reserve over the working sets that logged effort. */
  medianRir: number | null;
}

/** How a lift did in a session against the session before, and the rest the muscle had. */
export interface RecoverySample {
  muscle: string;
  /** Days since the muscle was last trained. */
  gapDays: number;
  /** Change in the lift's best estimated 1RM against its previous session. */
  change: number;
}

export interface FoodDay {
  date: string;
  kcal: number;
  proteinG: number;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

export const weekKey = (date: Date, weekStartsOn: WeekStartsOn = 1) =>
  toDateKey(startOfWeek(startOfDay(date), weekStartsOn));

/** The best estimated 1RM of one exercise in one session, with the reps that gave it. */
function sessionBest(ex: Session['exercises'][number]): { e1rm: number; reps: number } | null {
  if (!supportsE1rm(ex.exercise)) return null;
  let best: { e1rm: number; reps: number } | null = null;
  for (const set of ex.sets) {
    if (!isWorkingSet(set) || set.setType === 'drop' || !set.weightKg || !set.reps) continue;
    const v = estimateOneRepMax(set.weightKg, set.reps, null);
    if (v !== null && (best === null || v > best.e1rm)) best = { e1rm: v, reps: set.reps };
  }
  return best;
}

/**
 * Weeks of facts from the person's logs, oldest first, for every week from `from` up to the week
 * that holds `to` (weeks with nothing logged are included, empty).
 */
export function buildWeekFacts(input: {
  sessions: Session[];
  food: FoodDay[];
  weights: { measuredAt: string; weightKg: number }[];
  from: Date;
  to: Date;
  /** The first day of the person's week (Monday unless they chose Sunday). */
  weekStartsOn?: WeekStartsOn;
}): WeekFacts[] {
  const ws = input.weekStartsOn ?? 1;
  const first = startOfWeek(startOfDay(input.from), ws);
  const last = startOfWeek(startOfDay(input.to), ws);
  const weeks = new Map<string, WeekFacts>();
  const rirs = new Map<string, number[]>();
  for (let d = first; d <= last; d = addDays(d, 7)) {
    const key = toDateKey(d);
    weeks.set(key, {
      weekStart: key,
      sessions: 0,
      foodDays: 0,
      meanKcal: null,
      meanProteinG: null,
      weighIns: 0,
      meanWeightKg: null,
      muscles: Object.fromEntries(STRENGTH_MUSCLES.map((m) => [m, 0])),
      lifts: {},
      medianRir: null,
    });
    rirs.set(key, []);
  }

  for (const session of input.sessions) {
    const week = weeks.get(weekKey(session.date, ws));
    if (!week) continue;
    week.sessions += 1;
    for (const ex of session.exercises) {
      const exercise = ex.exercise;
      if (!exercise) continue;
      const working = ex.sets.filter(isWorkingSet);
      const hard = working.filter(isHardSet).length;
      if (hard > 0 && exercise.primaryMuscle !== 'cardio') {
        week.muscles[exercise.primaryMuscle] = (week.muscles[exercise.primaryMuscle] ?? 0) + hard;
        for (const m of exercise.secondaryMuscles) {
          if (m !== exercise.primaryMuscle && m !== 'cardio')
            week.muscles[m] = (week.muscles[m] ?? 0) + hard * 0.5;
        }
      }
      for (const set of working) {
        const rir = set.rir ?? (set.rpe !== null ? 10 - set.rpe : null);
        if (rir !== null) rirs.get(week.weekStart)!.push(rir);
      }
      const best = sessionBest(ex);
      if (best) {
        const lift = week.lifts[exercise.id];
        if (!lift) {
          week.lifts[exercise.id] = {
            muscle: exercise.primaryMuscle,
            e1rm: best.e1rm,
            topReps: best.reps,
            sessions: 1,
          };
        } else {
          lift.sessions += 1;
          if (best.e1rm > lift.e1rm) {
            lift.e1rm = best.e1rm;
            lift.topReps = best.reps;
          }
        }
      }
    }
  }
  for (const [key, list] of rirs) weeks.get(key)!.medianRir = median(list);

  const foodByWeek = new Map<string, FoodDay[]>();
  for (const day of input.food) {
    if (day.kcal < LOGGED_DAY_KCAL) continue;
    const key = weekKey(new Date(`${day.date}T12:00:00`), ws);
    if (!weeks.has(key)) continue;
    foodByWeek.set(key, [...(foodByWeek.get(key) ?? []), day]);
  }
  for (const [key, days] of foodByWeek) {
    const week = weeks.get(key)!;
    week.foodDays = days.length;
    week.meanKcal = days.reduce((n, d) => n + d.kcal, 0) / days.length;
    week.meanProteinG = days.reduce((n, d) => n + d.proteinG, 0) / days.length;
  }

  // One weigh-in a day: the last of the day counts.
  const weightByDay = new Map<string, { week: string; kg: number; at: number }>();
  for (const w of input.weights) {
    const at = new Date(w.measuredAt);
    const key = weekKey(at, ws);
    if (!weeks.has(key)) continue;
    const day = toDateKey(at);
    const prev = weightByDay.get(day);
    if (!prev || at.getTime() >= prev.at)
      weightByDay.set(day, { week: key, kg: w.weightKg, at: at.getTime() });
  }
  const weightByWeek = new Map<string, number[]>();
  for (const w of weightByDay.values())
    weightByWeek.set(w.week, [...(weightByWeek.get(w.week) ?? []), w.kg]);
  for (const [key, list] of weightByWeek) {
    const week = weeks.get(key)!;
    week.weighIns = list.length;
    week.meanWeightKg = list.reduce((a, b) => a + b, 0) / list.length;
  }
  return [...weeks.values()];
}

/** Food totals per day from the food log. */
export function foodDays(
  logs: { date: string; kcal: number; proteinG: number; deletedAt: string | null }[],
): FoodDay[] {
  const m = new Map<string, FoodDay>();
  for (const l of logs) {
    if (l.deletedAt) continue;
    const d = m.get(l.date) ?? { date: l.date, kcal: 0, proteinG: 0 };
    d.kcal += l.kcal;
    d.proteinG += l.proteinG;
    m.set(l.date, d);
  }
  return [...m.values()];
}

/**
 * For every session of a compound lift after its first: how the lift did against the session
 * before, and how long its main muscle had rested since anything trained it directly.
 */
export function recoverySamples(sessions: Session[]): RecoverySample[] {
  const out: RecoverySample[] = [];
  const lastTrained = new Map<string, Date>();
  const lastBest = new Map<string, number>();
  for (const session of sessions) {
    const trainedNow = new Set<string>();
    for (const ex of session.exercises) {
      const exercise = ex.exercise;
      if (!exercise || !ex.sets.some(isWorkingSet)) continue;
      const best = sessionBest(ex);
      const before = lastBest.get(exercise.id);
      const rested = lastTrained.get(exercise.primaryMuscle);
      if (best && before && rested && !trainedNow.has(exercise.primaryMuscle)) {
        const gapDays = Math.round((session.date.getTime() - rested.getTime()) / 86_400_000);
        if (gapDays >= 1 && gapDays <= 10)
          out.push({ muscle: exercise.primaryMuscle, gapDays, change: best.e1rm / before - 1 });
      }
      if (best) lastBest.set(exercise.id, best.e1rm);
      trainedNow.add(exercise.primaryMuscle);
    }
    for (const m of trainedNow) lastTrained.set(m, session.date);
  }
  return out;
}
