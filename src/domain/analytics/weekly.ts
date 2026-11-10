import { addDays, startOfDay, toDateKey } from '@/lib/dates';
import type { BodyMeasurement, Exercise, FoodLog, Goal, TrainingGoal } from '../models/schemas';
import { estimateOneRepMax, supportsE1rm } from './e1rm';
import { isHardSet, muscleWorkload } from './muscles';
import { detectPersonalRecords } from './prs';
import { isWorkingSet, sessionDurationMinutes, type Session } from './sessions';
import { sessionVolumeLoad } from './volume';

/**
 * Macrotrophy Weekly Intelligence (November 2026, Project doc `claude/weekly-intelligence-spec.md`).
 * One week of training and food read together, every number by fixed rules from the person's
 * own logs. Pure and serialisable: the result is stored as the week's report and drawn on
 * screen and in the PDF. Nothing here is guessed; a part with too little data is left out and
 * says what it needs.
 */

export const KCAL_PER_KG = 7700;
/** A day counts as logged when it has at least this much food in it. */
export const LOGGED_DAY_KCAL = 1000;
/** A calorie day is within 10% of the target; a protein day reaches 90% of it. */
export const CALORIE_TOLERANCE = 0.1;
export const PROTEIN_DAY_SHARE = 0.9;
/** A strength change is real at 5% or more over 4 weeks (Grgic et al. 2020). */
export const REAL_CHANGE = 0.05;
export const PROTEIN_PER_MEAL_G_PER_KG = 0.4;
export const FIBRE_G_PER_1000_KCAL = 14;
export const TRAINING_CARBS_G_PER_KG = 4;
/** Fat loss pace band in % of body weight a week (Helms et al. 2014). */
export const LOSS_BAND: [number, number] = [0.5, 1];
/** A pattern needs this many sessions on each side to be shown, more to be established. */
export const PATTERN_SHOW_N = 8;
export const PATTERN_ESTABLISHED_N = 10;
export const PATTERN_ESTABLISHED_P = 0.1;
/** Minimum data for a report at all. */
export const MIN_SESSIONS = 2;
export const MIN_FOOD_DAYS = 3;

export type Pillar = { status: 'good' | 'close' | 'off' | 'none'; label: string; detail: string };

export interface ReportDay {
  date: string;
  weekday: number;
  session: string | null;
  kcal: number | null;
  proteinG: number | null;
  weightKg: number | null;
  kcalOk: boolean | null;
  proteinOk: boolean | null;
}

export interface Tile {
  key: 'hardSets' | 'volume' | 'minutes' | 'effort' | 'kcal' | 'protein';
  value: number;
  /** Mean of the 4 weeks before, when they are all covered by history. */
  usual: number | null;
}

export interface LiftTrend {
  exerciseId: string;
  name: string;
  /** Best estimated 1RM in each of the last 8 weeks, oldest first; null for a week without it. */
  weeks: (number | null)[];
  now: number;
  base: number;
  pct: number;
  real: boolean;
}

export interface MuscleRow {
  muscle: string;
  sets: number;
  usual: number | null;
  sessions: number;
}

export interface Finding {
  id: string;
  label: 'established' | 'early';
  /** Short title and three parts: what we saw, why it matters, evidence or certainty. */
  title: string;
  saw: string;
  why: string;
  evidence: string[];
  /** For early signals, the numbers behind it. */
  pattern?: { aDone: number; aN: number; bDone: number; bN: number; p: number };
}

export type CheckSpec =
  | { kind: 'sessions'; min: number }
  | { kind: 'muscleSessions'; muscle: string; min: number }
  | { kind: 'mealProtein'; meal: 'breakfast' | 'lunch' | 'snacks' | 'dinner'; minG: number; days: number }
  | { kind: 'proteinDays'; min: number }
  | { kind: 'calorieDays'; min: number }
  | { kind: 'trainingCarbs'; minGPerKg: number };

export interface Action {
  id: string;
  title: string;
  titleHi: string;
  detail: string;
  checkText: string;
  check: CheckSpec;
}

export interface CheckResult {
  title: string;
  done: boolean;
  result: string;
}

export interface WeeklyReport {
  version: 1;
  weekStart: string;
  weekEnd: string;
  madeAt: string;
  enough: { training: boolean; food: boolean };
  counts: {
    sessions: number;
    planned: number | null;
    calorieDays: number | null;
    proteinDays: number | null;
    foodDays: number;
    weighIns: number;
    records: number;
  };
  pillars: { training: Pillar; nutrition: Pillar; body: Pillar };
  verdict: { en: string; hi: string };
  win: { big: string; title: string; detail: string } | null;
  tiles: Tile[];
  days: ReportDay[];
  targets: { kcal: number | null; proteinG: number | null; maintenance: number | null };
  lifts: LiftTrend[];
  muscles: MuscleRow[];
  body: {
    points: { date: string; kg: number; trend: number | null }[];
    weekMean: number | null;
    lastWeekMean: number | null;
    changeKg: number | null;
    ratePct: number | null;
    fatLoss: boolean;
    band: { start: string; startKg: number } | null;
    projection: { targetKg: number; weeksLo: number; weeksHi: number; goalDate: string | null } | null;
  } | null;
  energy: { meanIntake: number; changeKgPerWeek: number; maintenance: number; plannedDeficit: number | null; actualDeficit: number } | null;
  nutrition: {
    proteinAvg: number;
    proteinTarget: number | null;
    proteinPerKg: number | null;
    loggedDays: number;
    calorieAvg: number;
    calorieDays: number | null;
    caloriePct: number | null;
    meals: { meal: 'breakfast' | 'lunch' | 'snacks' | 'dinner'; avgG: number; days: number }[];
    mealAim: number | null;
    fibreAvg: number;
    fibreAim: number;
    carbsTraining: number | null;
    carbsRest: number | null;
  } | null;
  findings: Finding[];
  actions: Action[];
  lastWeek: CheckResult[] | null;
  inputs: { key: string; label: string; has: boolean; unlock: string }[];
}

export interface WeeklyInput {
  weekStart: Date;
  now: Date;
  sessions: Session[];
  exercises: Exercise[];
  logs: FoodLog[];
  targets: { kcal: number | null; proteinG: number | null } | null;
  /** Whether the targets are the person's own (typed), not calculated. */
  ownTargets: boolean;
  goal: Goal | null;
  weights: { measuredAt: string; weightKg: number }[];
  measurements: BodyMeasurement[];
  goals: TrainingGoal[];
  /** Planned sessions this week from the active routine, or null without one. */
  planned: number | null;
  /** The previous week's report actions, to tick off. */
  previousActions: Action[] | null;
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

const round1 = (v: number) => Math.round(v * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
const MEAL_WORD = { breakfast: 'breakfast', lunch: 'lunch', snacks: 'snacks', dinner: 'dinner' } as const;
const MEAL_HI = { breakfast: 'breakfast', lunch: 'lunch', snacks: 'snacks', dinner: 'dinner' } as const;
const MUSCLE_NAME: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  core: 'Core',
  traps: 'Traps',
  lats: 'Lats',
  adductors: 'Adductors',
  abductors: 'Abductors',
  obliques: 'Obliques',
  lower_back: 'Lower back',
  neck: 'Neck',
};
export const muscleName = (m: string) =>
  MUSCLE_NAME[m] ?? `${m.charAt(0).toUpperCase()}${m.slice(1).replace(/_/g, ' ')}`;

/**
 * Two-sided Fisher exact test on a 2 × 2 table [[a, b], [c, d]]: the chance of a table at least
 * as unusual, with the margins fixed. Used only as a gate for whether a pattern is shown and how
 * it is labelled; the probability itself is never shown to people.
 */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const lf = (n: number) => {
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log(i);
    return s;
  };
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  const logP = (x: number) =>
    lf(r1) + lf(r2) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(r2 - c1 + x);
  const observed = logP(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
    const lp = logP(x);
    if (lp <= observed + 1e-7) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

function dayTotals(logs: FoodLog[]) {
  const m = new Map<string, { kcal: number; proteinG: number; carbsG: number; fibreG: number }>();
  for (const l of logs) {
    if (l.deletedAt) continue;
    const t = m.get(l.date) ?? { kcal: 0, proteinG: 0, carbsG: 0, fibreG: 0 };
    t.kcal += l.kcal;
    t.proteinG += l.proteinG;
    t.carbsG += l.carbsG;
    t.fibreG += l.fibreG;
    m.set(l.date, t);
  }
  return m;
}

const inRange = (s: Session, from: Date, to: Date) => s.date >= from && s.date < to;

function weekStats(sessions: Session[]) {
  const sets = sessions.flatMap((s) => s.exercises.flatMap((e) => e.sets)).filter(isWorkingSet);
  const hard = sets.filter(isHardSet).length;
  const volume = sessions.reduce((n, s) => n + sessionVolumeLoad(s), 0);
  const minutes = sessions.reduce((n, s) => n + (sessionDurationMinutes(s) ?? 0), 0);
  const rirs = sets
    .map((s) => s.rir ?? (s.rpe !== null ? 10 - s.rpe : null))
    .filter((v): v is number => v !== null);
  return { hard, volume, minutes, rirs, sets: sets.length };
}

/** Weekly averages of the 4 weeks before, when history covers all of them; else null. */
function usualOf(values: number[], covered: boolean) {
  return covered && values.length === 4 ? (mean(values) ?? null) : null;
}

/** The best estimated 1RM in a session for one exercise, from sets of up to 10 reps. */
function bestE1rm(session: Session, exerciseId: string): number | null {
  let best: number | null = null;
  for (const e of session.exercises) {
    if (e.workoutExercise.exerciseId !== exerciseId) continue;
    for (const set of e.sets) {
      if (!isWorkingSet(set) || !set.weightKg || !set.reps || set.reps > 10) continue;
      const v = estimateOneRepMax(set.weightKg, set.reps, null);
      if (v !== null && (best === null || v > best)) best = v;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------

export function weeklyReport(input: WeeklyInput): WeeklyReport {
  const start = startOfDay(input.weekStart);
  const end = addDays(start, 7);
  const exerciseById = new Map(input.exercises.map((e) => [e.id, e]));
  const sessions = input.sessions.filter((s) => s.date < end);
  const week = sessions.filter((s) => inRange(s, start, end));
  const firstSession = sessions[0]?.date ?? null;
  const covered4 = !!firstSession && firstSession <= addDays(start, -28);
  const prevWeeks = [1, 2, 3, 4].map((k) =>
    sessions.filter((s) => inRange(s, addDays(start, -7 * k), addDays(start, -7 * (k - 1)))),
  );

  // Food ------------------------------------------------------------------------------------
  const totals = dayTotals(input.logs);
  const keyOf = (d: Date) => toDateKey(d);
  const weekKeys = Array.from({ length: 7 }, (_, i) => keyOf(addDays(start, i)));
  const logged = weekKeys.filter((k) => (totals.get(k)?.kcal ?? 0) >= LOGGED_DAY_KCAL);
  const kcalTarget = input.targets?.kcal ?? null;
  const proteinTarget = input.targets?.proteinG ?? null;
  const calorieOk = (k: string) =>
    kcalTarget ? Math.abs(totals.get(k)!.kcal / kcalTarget - 1) <= CALORIE_TOLERANCE : null;
  const proteinOk = (k: string) =>
    proteinTarget ? totals.get(k)!.proteinG >= proteinTarget * PROTEIN_DAY_SHARE : null;
  const calorieDays = kcalTarget ? logged.filter((k) => calorieOk(k)).length : null;
  const proteinDays = proteinTarget ? logged.filter((k) => proteinOk(k)).length : null;

  // Weight ------------------------------------------------------------------------------------
  const weights = input.weights
    .map((w) => ({ at: new Date(w.measuredAt), kg: w.weightKg }))
    .filter((w) => w.at < end)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  // One weigh-in a day: the last of the day counts.
  const byDay = new Map<string, number>();
  for (const w of weights) byDay.set(keyOf(w.at), w.kg);
  const weekWeights = weekKeys.filter((k) => byDay.has(k));
  const meanOf = (from: Date) => {
    const ks = Array.from({ length: 7 }, (_, i) => keyOf(addDays(from, i))).filter((k) => byDay.has(k));
    return ks.length >= 3 ? mean(ks.map((k) => byDay.get(k)!)) : null;
  };
  const weightNow = meanOf(start) ?? (weights.length ? weights[weights.length - 1]!.kg : null);

  const enough = { training: week.length >= MIN_SESSIONS, food: logged.length >= MIN_FOOD_DAYS };
  const records = detectPersonalRecords(sessions, input.exercises).filter(
    (p) => p.date >= start && p.date < end,
  );

  // Tiles -------------------------------------------------------------------------------------
  const ws = weekStats(week);
  const pws = prevWeeks.map(weekStats);
  const tiles: Tile[] = [];
  if (enough.training) {
    tiles.push({ key: 'hardSets', value: ws.hard, usual: usualOf(pws.map((p) => p.hard), covered4) });
    tiles.push({ key: 'volume', value: ws.volume, usual: usualOf(pws.map((p) => p.volume), covered4) });
    tiles.push({ key: 'minutes', value: ws.minutes, usual: usualOf(pws.map((p) => p.minutes), covered4) });
    if (ws.rirs.length) tiles.push({ key: 'effort', value: round1(mean(ws.rirs)!), usual: null });
  }
  if (enough.food) {
    tiles.push({ key: 'kcal', value: Math.round(mean(logged.map((k) => totals.get(k)!.kcal))!), usual: null });
    tiles.push({ key: 'protein', value: Math.round(mean(logged.map((k) => totals.get(k)!.proteinG))!), usual: null });
  }

  // Days --------------------------------------------------------------------------------------
  const days: ReportDay[] = weekKeys.map((k, i) => {
    const d = addDays(start, i);
    const s = week.find((x) => keyOf(x.date) === k);
    const t = totals.get(k);
    const isLogged = (t?.kcal ?? 0) >= LOGGED_DAY_KCAL;
    return {
      date: k,
      weekday: d.getDay(),
      session: s ? s.workout.name : null,
      kcal: isLogged ? Math.round(t!.kcal) : null,
      proteinG: isLogged ? Math.round(t!.proteinG) : null,
      weightKg: byDay.get(k) ?? null,
      kcalOk: isLogged ? calorieOk(k) : null,
      proteinOk: isLogged ? proteinOk(k) : null,
    };
  });

  // Strength: up to three lifts trained most in the last 8 weeks ------------------------------
  const lifts: LiftTrend[] = [];
  const from8 = addDays(start, -49);
  const recent = sessions.filter((s) => s.date >= from8 && s.date < end);
  const freq = new Map<string, number>();
  for (const s of recent)
    for (const e of s.exercises) {
      const ex = exerciseById.get(e.workoutExercise.exerciseId);
      if (!supportsE1rm(ex) || !e.sets.some(isWorkingSet)) continue;
      freq.set(e.workoutExercise.exerciseId, (freq.get(e.workoutExercise.exerciseId) ?? 0) + 1);
    }
  const candidates = [...freq.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  for (const [id] of candidates) {
    if (lifts.length >= 3) break;
    const weeks = Array.from({ length: 8 }, (_, w) => {
      const a = addDays(start, -7 * (7 - w));
      const b = addDays(a, 7);
      const vals = recent.filter((s) => inRange(s, a, b)).map((s) => bestE1rm(s, id)).filter((v): v is number => v !== null);
      return vals.length ? round1(Math.max(...vals)) : null;
    });
    const nowV = weeks[7] ?? weeks[6];
    const baseV = weeks[3] ?? weeks[2] ?? weeks[4];
    if (nowV == null || baseV == null) continue;
    const pct = (nowV / baseV - 1) * 100;
    lifts.push({
      exerciseId: id,
      name: exerciseById.get(id)?.name ?? 'Lift',
      weeks,
      now: nowV,
      base: baseV,
      pct: round1(pct),
      real: Math.abs(pct) >= REAL_CHANGE * 100,
    });
  }

  // Muscles -----------------------------------------------------------------------------------
  const work = muscleWorkload(week);
  const prevWork = prevWeeks.map((p) => new Map(muscleWorkload(p).map((m) => [m.muscle, m.weighted])));
  const sessionsFor = (muscle: string) =>
    week.filter((s) =>
      s.exercises.some(
        (e) => e.exercise?.primaryMuscle === muscle && e.sets.some((x) => isWorkingSet(x) && isHardSet(x)),
      ),
    ).length;
  const muscles: MuscleRow[] = enough.training
    ? work
        .map((m) => ({
          muscle: m.muscle,
          sets: round1(m.weighted),
          usual: covered4 ? round1(mean(prevWork.map((p) => p.get(m.muscle) ?? 0))!) : null,
          sessions: sessionsFor(m.muscle),
        }))
        .filter((m) => m.sets > 0 || (m.usual ?? 0) >= 2)
        .sort((a, b) => b.sets - a.sets)
    : [];

  // Body --------------------------------------------------------------------------------------
  const fatLoss = input.goal === 'fat_loss';
  let body: WeeklyReport['body'] = null;
  if (weights.length >= 3) {
    const from = addDays(start, -21);
    const pts = [...byDay.entries()]
      .filter(([k]) => k >= keyOf(from) && k < keyOf(end))
      .sort(([a], [b]) => a.localeCompare(b));
    const points = pts.map(([k, kg]) => {
      const d = new Date(`${k}T12:00:00`);
      const win = pts.filter(([j]) => j <= k && j >= keyOf(addDays(d, -6))).map(([, v]) => v);
      return { date: k, kg, trend: win.length >= 3 ? round1(mean(win)!) : null };
    });
    const weekMean = meanOf(start);
    const lastWeekMean = meanOf(addDays(start, -7));
    const changeKg = weekMean !== null && lastWeekMean !== null ? round1(weekMean - lastWeekMean) : null;
    const ratePct = changeKg !== null && lastWeekMean ? round1((changeKg / lastWeekMean) * 100) : null;
    const means = [0, 1, 2, 3].map((k) => meanOf(addDays(start, -7 * k)));
    const startMean = means[3];
    // A goal weight gives a projected range from the last 3 weekly changes, widened 20%.
    const weightGoal = input.goals.find((g) => g.kind === 'body_weight' && !g.deletedAt && !g.achievedAt) ?? null;
    let projection: NonNullable<WeeklyReport['body']>['projection'] = null;
    if (weightGoal && means.every((m) => m !== null) && weekMean !== null) {
      const changes = [0, 1, 2].map((k) => means[k]! - means[k + 1]!);
      const toGo = weightGoal.targetValue - weekMean;
      const toward = changes.filter((c) => Math.sign(c) === Math.sign(toGo) && Math.abs(c) > 0.02);
      if (toward.length === 3 && Math.abs(toGo) > 0.2) {
        const fast = Math.max(...toward.map(Math.abs)) * 1.2;
        const slow = Math.min(...toward.map(Math.abs)) * 0.8;
        projection = {
          targetKg: weightGoal.targetValue,
          weeksLo: Math.max(1, Math.round(Math.abs(toGo) / fast)),
          weeksHi: Math.max(1, Math.round(Math.abs(toGo) / slow)),
          goalDate: weightGoal.targetDate,
        };
      }
    }
    body = {
      points,
      weekMean: weekMean !== null ? round1(weekMean) : null,
      lastWeekMean: lastWeekMean !== null ? round1(lastWeekMean) : null,
      changeKg,
      ratePct,
      fatLoss,
      band: fatLoss && startMean != null ? { start: keyOf(addDays(start, -21)), startKg: round1(startMean) } : null,
      projection,
    };
  }

  // Energy balance over 4 weeks: intake plus what the body gave up ------------------------
  let energy: WeeklyReport['energy'] = null;
  {
    const keys28 = Array.from({ length: 28 }, (_, i) => keyOf(addDays(start, i - 21)));
    const full = keys28.filter((k) => (totals.get(k)?.kcal ?? 0) >= LOGGED_DAY_KCAL);
    const a = meanOf(addDays(start, -21));
    const b = meanOf(start);
    if (full.length >= 14 && a !== null && b !== null) {
      const meanIntake = Math.round(mean(full.map((k) => totals.get(k)!.kcal))!);
      const perWeek = (b - a) / 3;
      const maintenance = Math.round((meanIntake - (perWeek * KCAL_PER_KG) / 7) / 10) * 10;
      energy = {
        meanIntake,
        changeKgPerWeek: round1(perWeek),
        maintenance,
        plannedDeficit: kcalTarget ? maintenance - kcalTarget : null,
        actualDeficit: Math.round((-perWeek * KCAL_PER_KG) / 7 / 10) * 10,
      };
    }
  }

  // Nutrition ---------------------------------------------------------------------------------
  let nutrition: WeeklyReport['nutrition'] = null;
  if (enough.food) {
    const weekLogs = input.logs.filter((l) => !l.deletedAt && logged.includes(l.date));
    const meals = MEALS.map((meal) => {
      const perDay = logged
        .map((k) => weekLogs.filter((l) => l.date === k && l.meal === meal).reduce((n, l) => n + l.proteinG, 0))
        .filter((g) => g > 0);
      return { meal, avgG: Math.round(mean(perDay) ?? 0), days: perDay.length };
    }).filter((m) => m.days >= 2);
    const trainingKeys = new Set(week.map((s) => keyOf(s.date)));
    const carbsPerKg = (ks: string[]) =>
      weightNow && ks.length >= 2 ? round1(mean(ks.map((k) => totals.get(k)!.carbsG))! / weightNow) : null;
    const kcalAvg = mean(logged.map((k) => totals.get(k)!.kcal))!;
    nutrition = {
      proteinAvg: Math.round(mean(logged.map((k) => totals.get(k)!.proteinG))!),
      proteinTarget,
      proteinPerKg: weightNow ? round1(mean(logged.map((k) => totals.get(k)!.proteinG))! / weightNow) : null,
      loggedDays: logged.length,
      calorieAvg: Math.round(kcalAvg),
      calorieDays,
      caloriePct: kcalTarget ? Math.round((kcalAvg / kcalTarget - 1) * 100) : null,
      meals,
      mealAim: weightNow ? Math.round(weightNow * PROTEIN_PER_MEAL_G_PER_KG) : null,
      fibreAvg: Math.round(mean(logged.map((k) => totals.get(k)!.fibreG))!),
      fibreAim: Math.round((kcalAvg / 1000) * FIBRE_G_PER_1000_KCAL),
      carbsTraining: carbsPerKg(logged.filter((k) => trainingKeys.has(k))),
      carbsRest: carbsPerKg(logged.filter((k) => !trainingKeys.has(k))),
    };
  }

  // Findings ----------------------------------------------------------------------------------
  const findings: Finding[] = [];
  const realGains = lifts.filter((l) => l.real && l.pct > 0);
  if (realGains.length && body?.changeKg != null && body.changeKg < 0 && fatLoss) {
    findings.push({
      id: 'strength-in-deficit',
      label: 'established',
      title: `Strength went up while your weight came down`,
      saw: `${realGains.map((l) => l.name).join(' and ')} ${realGains.length > 1 ? 'are' : 'is'} up 5% or more in 4 weeks, while your weight fell ${Math.abs(body.changeKg)} kg this week.`,
      why: 'Getting stronger while weight comes down says the deficit is not costing you strength.',
      evidence: ['Helms 2014', 'Grgic 2020'],
    });
  } else if (realGains.length) {
    findings.push({
      id: 'strength-gain',
      label: 'established',
      title: `${realGains[0]!.name} is up ${realGains[0]!.pct}% in 4 weeks`,
      saw: `From ${realGains[0]!.base} to ${realGains[0]!.now} kg estimated 1RM. Changes under 5% are noise; this is past it.`,
      why: 'A gain this size is real progress, not a good day.',
      evidence: ['Grgic 2020'],
    });
  }
  if (nutrition?.carbsTraining != null && nutrition.carbsTraining < TRAINING_CARBS_G_PER_KG && enough.training) {
    findings.push({
      id: 'training-carbs',
      label: 'established',
      title: 'Your carbs are low on the days you lift',
      saw: `Training days averaged ${nutrition.carbsTraining} g of carbs per kg${nutrition.carbsRest != null ? ` and rest days ${nutrition.carbsRest}` : ''}. The usual training day range starts at 4.`,
      why: 'Moving carbs onto lifting days gives sessions more fuel at the same total calories.',
      evidence: ['Science: day analysis'],
    });
  }
  const low = nutrition?.meals.filter((m) => nutrition.mealAim && m.avgG < nutrition.mealAim * 0.75) ?? [];
  if (low.length && nutrition?.mealAim) {
    const m = low.sort((a, b) => a.avgG - b.avgG)[0]!;
    findings.push({
      id: 'meal-protein',
      label: 'established',
      title: `Protein is light at ${MEAL_WORD[m.meal]}`,
      saw: `${MEAL_WORD[m.meal].charAt(0).toUpperCase()}${MEAL_WORD[m.meal].slice(1)} averaged ${m.avgG} g of protein. About ${nutrition.mealAim} g a meal (0.4 g per kg) is the aim.`,
      why: 'Spreading protein over the day helps it build muscle.',
      evidence: ['Science: day analysis'],
    });
  }
  const pattern = fuelPattern(sessions, totals, kcalTarget, start, end);
  if (pattern) findings.push(pattern);

  // Next week: the biggest gaps, each with a check -----------------------------------------
  const actions: Action[] = [];
  const add = (a: Action) => actions.length < 3 && actions.push(a);
  if (input.planned && week.length < input.planned)
    add({
      id: 'sessions',
      title: `Get all ${input.planned} planned sessions in`,
      titleHi: `Saare ${input.planned} planned sessions karo`,
      detail: `You did ${week.length} of ${input.planned}. Showing up is the biggest lever there is.`,
      checkText: `${input.planned} sessions next week.`,
      check: { kind: 'sessions', min: input.planned },
    });
  const gaps = muscles
    .filter((m) => m.usual !== null && m.usual >= 6 && m.sets <= m.usual - 3)
    .sort((a, b) => b.usual! - b.sets - (a.usual! - a.sets));
  if (gaps.length) {
    const g = gaps[0]!;
    add({
      id: `muscle-${g.muscle}`,
      title: `Bring ${muscleName(g.muscle).toLowerCase()} back to your usual`,
      titleHi: `${muscleName(g.muscle)} ke sets wapas normal karo`,
      detail: `${muscleName(g.muscle)} got ${g.sets} hard sets against your usual ${g.usual}. Add about ${Math.round(g.usual! - g.sets)} sets, ideally over 2 sessions.`,
      checkText: `${muscleName(g.muscle)} in 2 sessions next week.`,
      check: { kind: 'muscleSessions', muscle: g.muscle, min: 2 },
    });
  }
  if (low.length && nutrition?.mealAim) {
    const m = low[0]!;
    const addG = Math.max(5, Math.round((nutrition.mealAim - m.avgG) / 5) * 5);
    add({
      id: `meal-${m.meal}`,
      title: `Add ${addG} g of protein at ${MEAL_WORD[m.meal]}`,
      titleHi: `${MEAL_HI[m.meal]} mein ${addG} g protein badhao`,
      detail: `${MEAL_WORD[m.meal].charAt(0).toUpperCase()}${MEAL_WORD[m.meal].slice(1)} averaged ${m.avgG} g of protein against about ${nutrition.mealAim} g. Two eggs, curd or a scoop of whey closes it.`,
      checkText: `${MEAL_WORD[m.meal].charAt(0).toUpperCase()}${MEAL_WORD[m.meal].slice(1)} at ${nutrition.mealAim - 5} g or more on 5 days.`,
      check: { kind: 'mealProtein', meal: m.meal, minG: nutrition.mealAim - 5, days: 5 },
    });
  }
  if (proteinTarget && proteinDays !== null && logged.length >= MIN_FOOD_DAYS && proteinDays < 5)
    add({
      id: 'protein-days',
      title: 'Reach your protein target on 5 days',
      titleHi: '5 din protein target poora karo',
      detail: `You reached 90% of ${proteinTarget} g on ${proteinDays} ${plural(proteinDays, 'day')}.`,
      checkText: 'Protein at 90% of target on 5 days.',
      check: { kind: 'proteinDays', min: 5 },
    });
  if (kcalTarget && calorieDays !== null && logged.length >= MIN_FOOD_DAYS && calorieDays < 4)
    add({
      id: 'calorie-days',
      title: 'Land within 10% of your calories on 5 days',
      titleHi: '5 din calories target ke 10% ke andar rakho',
      detail: `${calorieDays} of ${logged.length} logged days were within 10% of ${kcalTarget.toLocaleString('en-IN')} kcal.`,
      checkText: 'Calories within 10% on 5 days.',
      check: { kind: 'calorieDays', min: 5 },
    });
  if (nutrition?.carbsTraining != null && nutrition.carbsTraining < TRAINING_CARBS_G_PER_KG && enough.training)
    add({
      id: 'training-carbs',
      title: 'Move some carbs to your training days',
      titleHi: 'Training wale din carbs thode badhao',
      detail: `Training days were at ${nutrition.carbsTraining} g per kg. Shift carbs from rest days so the total calories stay the same.`,
      checkText: `Training day carbs at ${TRAINING_CARBS_G_PER_KG} g per kg or more.`,
      check: { kind: 'trainingCarbs', minGPerKg: TRAINING_CARBS_G_PER_KG },
    });

  // Last week's plan, ticked from this week's logs -----------------------------------------
  const lastWeek = input.previousActions?.length
    ? input.previousActions.map((a) => evaluate(a, { week, totals, logged, proteinTarget, kcalTarget, weightNow, weekLogs: input.logs }))
    : null;

  // Pillars and verdict -----------------------------------------------------------------------
  const pillars = {
    training: trainingPillar(week.length, input.planned),
    nutrition: nutritionPillar(enough.food, proteinTarget, nutrition?.proteinAvg ?? null, calorieDays, logged.length),
    body: bodyPillar(body, fatLoss),
  };
  const verdict = verdictText(pillars, actions);

  // Win of the week -------------------------------------------------------------------------
  let win: WeeklyReport['win'] = null;
  if (realGains.length) {
    const l = realGains.sort((a, b) => b.pct - a.pct)[0]!;
    win = { big: `+${l.pct}%`, title: `${l.name} strength in 4 weeks`, detail: `From ${l.base} to ${l.now} kg estimated. Past the 5% line where a change stops being noise.` };
  } else if (records.length) {
    const ex = new Set(records.map((r) => r.exerciseId)).size;
    win = { big: String(records.length), title: `${plural(records.length, 'personal record')} this week`, detail: `Across ${ex} ${plural(ex, 'exercise')}.` };
  } else if (input.planned && week.length >= input.planned) {
    win = { big: `${week.length}/${input.planned}`, title: 'Every planned session done', detail: 'Consistency is what moves everything else.' };
  }

  // Optional inputs ---------------------------------------------------------------------------
  const rirShare = ws.sets ? ws.rirs.length / ws.sets : 0;
  const readinessUsed = week.some((s) => s.workout.readiness != null);
  const waistRecent = input.measurements.some(
    (m) => !m.deletedAt && m.waistCm != null && new Date(m.measuredAt) >= addDays(start, -14),
  );
  const inputs = [
    { key: 'goal', label: 'Goal weight and date', has: input.goals.some((g) => g.kind === 'body_weight' && !g.deletedAt), unlock: 'A projected range for reaching your goal weight.' },
    { key: 'targets', label: 'Your own calorie and protein targets', has: input.ownTargets, unlock: 'Calorie and protein days checked against your own numbers.' },
    { key: 'meals', label: 'Meals logged by meal', has: enough.food, unlock: 'Protein at each meal, not just the day.' },
    { key: 'plan', label: 'Training plan with planned days', has: input.planned !== null, unlock: 'Sessions done against sessions planned.' },
    { key: 'effort', label: 'Effort logged on 80% of sets', has: rirShare >= 0.8, unlock: `You logged effort on ${Math.round(rirShare * 100)}% of sets. At 80% your strength estimates and hard sets get much tighter.` },
    { key: 'readiness', label: 'Readiness check before workouts', has: readinessUsed, unlock: 'Tells whether weak days follow poor recovery or low food.' },
    { key: 'waist', label: 'Waist measurement every 2 weeks', has: waistRecent, unlock: 'On a cut, weight alone cannot separate fat loss from water.' },
  ];

  return {
    version: 1,
    weekStart: keyOf(start),
    weekEnd: keyOf(addDays(start, 6)),
    madeAt: input.now.toISOString(),
    enough,
    counts: {
      sessions: week.length,
      planned: input.planned,
      calorieDays,
      proteinDays,
      foodDays: logged.length,
      weighIns: weekWeights.length,
      records: records.length,
    },
    pillars,
    verdict,
    win,
    tiles,
    days,
    targets: { kcal: kcalTarget, proteinG: proteinTarget, maintenance: energy?.maintenance ?? null },
    lifts,
    muscles,
    body,
    energy,
    nutrition,
    findings,
    actions,
    lastWeek,
    inputs,
  };
}

/** Whether a report can be made for this week at all. */
export const canMakeReport = (r: Pick<WeeklyReport, 'enough'>) => r.enough.training || r.enough.food;

function fuelPattern(
  sessions: Session[],
  totals: Map<string, { kcal: number }>,
  kcalTarget: number | null,
  start: Date,
  end: Date,
): Finding | null {
  if (!kcalTarget) return null;
  const from = addDays(start, -49);
  const lastBest = new Map<string, number>();
  const fed = { done: 0, n: 0 };
  const low = { done: 0, n: 0 };
  for (const s of sessions) {
    let matched = false;
    let compared = false;
    for (const e of s.exercises) {
      const id = e.workoutExercise.exerciseId;
      const best = bestE1rm(s, id);
      if (best === null) continue;
      const prev = lastBest.get(id);
      if (prev !== undefined) {
        compared = true;
        if (best >= prev) matched = true;
      }
      lastBest.set(id, best);
    }
    if (s.date < from || s.date >= end || !compared) continue;
    const before = totals.get(toDateKey(addDays(s.date, -1)))?.kcal ?? 0;
    if (before < LOGGED_DAY_KCAL) continue;
    const side = before >= kcalTarget * 0.95 ? fed : low;
    side.n++;
    if (matched) side.done++;
  }
  if (fed.n < PATTERN_SHOW_N || low.n < PATTERN_SHOW_N) return null;
  const rateA = fed.done / fed.n;
  const rateB = low.done / low.n;
  if (rateA - rateB < 0.2) return null;
  const p = fisherExact(fed.done, fed.n - fed.done, low.done, low.n - low.done);
  const established = fed.n >= PATTERN_ESTABLISHED_N && low.n >= PATTERN_ESTABLISHED_N && p < PATTERN_ESTABLISHED_P;
  return {
    id: 'fuel-pattern',
    label: established ? 'established' : 'early',
    title: 'Your lifts and your eating went together',
    saw: `After days at 95% of your calories or more, ${fed.done} of ${fed.n} sessions matched or beat last time. After lower days, ${low.done} of ${low.n}.`,
    why: established
      ? 'This has held over enough sessions to take seriously. It still does not prove cause: sleep and stress move with both.'
      : `This is ${fed.n + low.n} sessions over 8 weeks. Sleep, stress and exercise choice also move with eating and lifting, so it does not prove cause. We keep watching and do not change your advice because of it.`,
    evidence: [],
    pattern: { aDone: fed.done, aN: fed.n, bDone: low.done, bN: low.n, p },
  };
}

function evaluate(
  a: Action,
  ctx: {
    week: Session[];
    totals: Map<string, { kcal: number; proteinG: number; carbsG: number }>;
    logged: string[];
    proteinTarget: number | null;
    kcalTarget: number | null;
    weightNow: number | null;
    weekLogs: FoodLog[];
  },
): CheckResult {
  const c = a.check;
  switch (c.kind) {
    case 'sessions': {
      const n = ctx.week.length;
      return { title: a.title, done: n >= c.min, result: `${n} of ${c.min} sessions` };
    }
    case 'muscleSessions': {
      const n = ctx.week.filter((s) =>
        s.exercises.some((e) => e.exercise?.primaryMuscle === c.muscle && e.sets.some(isWorkingSet)),
      ).length;
      return { title: a.title, done: n >= c.min, result: `${muscleName(c.muscle)} in ${n} ${plural(n, 'session')}` };
    }
    case 'mealProtein': {
      const n = ctx.logged.filter(
        (k) =>
          ctx.weekLogs
            .filter((l) => !l.deletedAt && l.date === k && l.meal === c.meal)
            .reduce((s, l) => s + l.proteinG, 0) >= c.minG,
      ).length;
      return { title: a.title, done: n >= c.days, result: `${n} of ${c.days} days` };
    }
    case 'proteinDays': {
      const n = ctx.proteinTarget
        ? ctx.logged.filter((k) => ctx.totals.get(k)!.proteinG >= ctx.proteinTarget! * PROTEIN_DAY_SHARE).length
        : 0;
      return { title: a.title, done: n >= c.min, result: `Reached on ${n} ${plural(n, 'day')}` };
    }
    case 'calorieDays': {
      const n = ctx.kcalTarget
        ? ctx.logged.filter((k) => Math.abs(ctx.totals.get(k)!.kcal / ctx.kcalTarget! - 1) <= CALORIE_TOLERANCE).length
        : 0;
      return { title: a.title, done: n >= c.min, result: `${n} of ${c.min} days` };
    }
    case 'trainingCarbs': {
      const keys = new Set(ctx.week.map((s) => toDateKey(s.date)));
      const ks = ctx.logged.filter((k) => keys.has(k));
      const v = ctx.weightNow && ks.length ? round1(mean(ks.map((k) => ctx.totals.get(k)!.carbsG))! / ctx.weightNow) : null;
      return { title: a.title, done: v !== null && v >= c.minGPerKg, result: v !== null ? `${v} g per kg` : 'Not enough logged' };
    }
  }
}

function trainingPillar(done: number, planned: number | null): Pillar {
  if (done === 0) return { status: 'none', label: 'No sessions', detail: 'Nothing logged this week' };
  if (planned) {
    const detail = `${done} of ${planned} sessions`;
    if (done >= planned) return { status: 'good', label: 'On plan', detail };
    if (done >= planned - 1) return { status: 'close', label: 'Close', detail };
    return { status: 'off', label: 'Behind', detail };
  }
  return { status: 'good', label: `${done} ${plural(done, 'session')}`, detail: 'No plan set to compare with' };
}

function nutritionPillar(
  enough: boolean,
  target: number | null,
  avg: number | null,
  calorieDays: number | null,
  logged: number,
): Pillar {
  if (!enough) return { status: 'none', label: 'Not logged', detail: 'Log food on 3 days to see this' };
  if (!target || avg === null) return { status: 'close', label: 'Logged', detail: `${logged} days logged, no protein target` };
  const pct = Math.round((avg / target) * 100);
  const detail = `Protein ${pct}% of target`;
  if (pct >= 95 && (calorieDays === null || calorieDays >= Math.min(5, logged))) return { status: 'good', label: 'On target', detail };
  if (pct >= 85) return { status: 'close', label: 'Close', detail };
  return { status: 'off', label: 'Off target', detail };
}

function bodyPillar(body: WeeklyReport['body'], fatLoss: boolean): Pillar {
  if (!body || body.ratePct === null || body.changeKg === null)
    return { status: 'none', label: 'Not enough weigh-ins', detail: 'Weigh in on 3 days a week' };
  const down = body.ratePct < 0;
  const rate = Math.abs(body.ratePct);
  if (fatLoss) {
    const detail = `Weight ${down ? 'down' : 'up'} ${rate}% a week, goal 0.5 to 1%`;
    if (down && rate >= LOSS_BAND[0] && rate <= LOSS_BAND[1]) return { status: 'good', label: 'On pace', detail };
    if (down && rate > LOSS_BAND[1]) return { status: 'close', label: 'Faster than planned', detail };
    if (down) return { status: 'close', label: 'Slower than planned', detail };
    return { status: 'off', label: 'Not dropping yet', detail };
  }
  if (Math.abs(body.changeKg) < 0.2) return { status: 'good', label: 'Steady', detail: 'Weight within 0.2 kg of last week' };
  return { status: 'close', label: `${down ? 'Down' : 'Up'} ${Math.abs(body.changeKg)} kg`, detail: 'Against last week\'s 7 day average' };
}

function verdictText(p: WeeklyReport['pillars'], actions: Action[]): { en: string; hi: string } {
  const good = [p.training, p.nutrition, p.body].filter((x) => x.status === 'good').length;
  const head =
    good === 3
      ? { en: 'A strong week on every front.', hi: 'Har taraf se ek strong hafta.' }
      : good === 2
        ? { en: 'A solid week.', hi: 'Ek solid hafta.' }
        : good === 1
          ? { en: 'A mixed week.', hi: 'Mila-jula hafta.' }
          : { en: 'A slow week, and that is fine.', hi: 'Thoda slow hafta, koi baat nahi.' };
  if (!actions.length) return { en: `${head.en} Keep doing what you did.`, hi: `${head.hi} Aise hi chalte raho.` };
  const fix = actions.slice(0, 2);
  return {
    en: `${head.en} ${fix.length === 1 ? 'One thing' : 'Two things'} to work on: ${fix.map((a) => a.title.charAt(0).toLowerCase() + a.title.slice(1)).join(', and ')}.`,
    hi: `${head.hi} Agle hafte: ${fix.map((a) => a.titleHi.charAt(0).toLowerCase() + a.titleHi.slice(1)).join(', aur ')}.`,
  };
}
