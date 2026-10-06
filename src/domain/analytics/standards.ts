import { addDays, startOfDay } from '@/lib/dates';
import { stableId } from '@/lib/ids';
import type { Exercise, Experience, MuscleGroup, Sex } from '../models/schemas';
import type { ExercisePerformance } from './performance';
import { isWorkingSet, sessionsBetween, type Session } from './sessions';

/**
 * Strength analytics that go beyond records: levels against body weight, DOTS, rate of
 * progress, plateaus, training balance and load spikes. Pure functions, fixed rules, every
 * threshold written down here and on the methodology page.
 */

// ---------------------------------------------------------------------------------------------
// Strength levels
// ---------------------------------------------------------------------------------------------

export const LEVELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'] as const;
export type Level = (typeof LEVELS)[number];

/**
 * Estimated 1RM as a multiple of body weight at the start of each level. Rule-of-thumb
 * standards in the tradition of Kilgore, Rippetoe and Pendlay, for adults under 40 lifting with
 * good form. They are a rough guide, not a ranking.
 */
export const STANDARDS: Record<
  string,
  {
    name: string;
    male: [number, number, number, number, number];
    female: [number, number, number, number, number];
  }
> = {
  'back-squat': {
    name: 'Squat',
    male: [0.75, 1.25, 1.5, 2.25, 2.75],
    female: [0.5, 0.75, 1.25, 1.5, 1.75],
  },
  'barbell-bench-press': {
    name: 'Bench press',
    male: [0.5, 0.75, 1.25, 1.75, 2],
    female: [0.25, 0.5, 0.75, 1, 1.25],
  },
  deadlift: {
    name: 'Deadlift',
    male: [1, 1.5, 2, 2.5, 3],
    female: [0.5, 1, 1.25, 1.75, 2.25],
  },
  'overhead-press': {
    name: 'Overhead press',
    male: [0.35, 0.55, 0.8, 1.05, 1.35],
    female: [0.2, 0.35, 0.5, 0.75, 1],
  },
  'barbell-row': {
    name: 'Barbell row',
    male: [0.5, 0.75, 1, 1.5, 1.75],
    female: [0.25, 0.4, 0.65, 0.9, 1.2],
  },
};

export interface StrengthLevel {
  key: string;
  exerciseId: string;
  name: string;
  e1rm: number;
  ratio: number;
  /** Null below the first level. */
  level: Level | null;
  next: Level | null;
  /** e1RM needed for the next level, in kg. */
  nextKg: number | null;
  /** 0 to 1 through the current band. */
  progress: number;
}

export function strengthLevel(
  key: string,
  exerciseId: string,
  e1rm: number,
  bodyWeightKg: number,
  sex: 'male' | 'female',
): StrengthLevel | null {
  const standard = STANDARDS[key];
  if (!standard || bodyWeightKg <= 0) return null;
  const marks = standard[sex];
  const ratio = e1rm / bodyWeightKg;
  let index = -1;
  for (let i = 0; i < marks.length; i++) if (ratio >= marks[i]!) index = i;
  const lo = index >= 0 ? marks[index]! : 0;
  const hi = marks[index + 1] ?? null;
  return {
    key,
    exerciseId,
    name: standard.name,
    e1rm,
    ratio,
    level: index >= 0 ? LEVELS[index]! : null,
    next: index + 1 < LEVELS.length ? LEVELS[index + 1]! : null,
    nextKg: hi !== null ? hi * bodyWeightKg : null,
    progress: hi === null ? 1 : Math.min(1, Math.max(0, (ratio - lo) / (hi - lo))),
  };
}

// ---------------------------------------------------------------------------------------------
// DOTS
// ---------------------------------------------------------------------------------------------

const DOTS = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
} as const;

/**
 * DOTS (the IPF-era successor to Wilks): total × 500 / (a + b·bw + c·bw² + d·bw³ + e·bw⁴),
 * body weight held within 40 to 210 kg for men and 40 to 150 kg for women. Used here with
 * estimated maxes, so it is labelled an estimate.
 */
export function dotsScore(totalKg: number, bodyWeightKg: number, sex: 'male' | 'female'): number {
  const bw = Math.min(Math.max(bodyWeightKg, 40), sex === 'male' ? 210 : 150);
  const [a, b, c, d, e] = DOTS[sex];
  const denominator = a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4;
  return (totalKg * 500) / denominator;
}

// ---------------------------------------------------------------------------------------------
// Rate of progress and plateaus
// ---------------------------------------------------------------------------------------------

/** Least-squares slope of per-session best e1RM, in kg per week. Needs 4 sessions over 3 weeks. */
export function e1rmRate(history: ExercisePerformance[], now: Date, weeks = 8): number | null {
  const from = addDays(now, -weeks * 7);
  const points = history.filter((p) => p.bestE1rm !== null && p.date >= from && p.date <= now);
  if (points.length < 4) return null;
  const span = (points[points.length - 1]!.date.getTime() - points[0]!.date.getTime()) / 86_400_000;
  if (span < 21) return null;
  const xs = points.map((p) => p.date.getTime() / (7 * 86_400_000));
  const ys = points.map((p) => p.bestE1rm!);
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

export const PLATEAU_WEEKS = 3;
export const PLATEAU_MIN_SESSIONS = 4;

export interface Plateau {
  exerciseId: string;
  bestE1rm: number;
  bestDate: Date;
  weeks: number;
  sessionsSince: number;
  suggestion: 'rep_range' | 'deload' | 'variation';
}

/**
 * A lift has stalled when its best e1RM has not been beaten for 3 weeks or more, across at least
 * 4 sessions of it, and it was trained in the last 2 weeks (a lift you stopped doing is not
 * stalled). What to try depends on how long: a new rep range first, then a lighter week, then
 * a variation of the lift.
 */
export function detectPlateaus(
  byExercise: Map<string, ExercisePerformance[]>,
  now: Date,
  experience: Experience | null | undefined,
): Plateau[] {
  const out: Plateau[] = [];
  for (const [exerciseId, history] of byExercise) {
    const withE1rm = history.filter((p) => p.bestE1rm !== null && p.date <= now);
    if (withE1rm.length < PLATEAU_MIN_SESSIONS) continue;
    const last = withE1rm[withE1rm.length - 1]!;
    if (now.getTime() - last.date.getTime() > 14 * 86_400_000) continue;
    let best = withE1rm[0]!;
    for (const p of withE1rm) if (p.bestE1rm! > best.bestE1rm! + 1e-9) best = p;
    const weeks = Math.floor((now.getTime() - best.date.getTime()) / (7 * 86_400_000));
    const sessionsSince = withE1rm.filter((p) => p.date > best.date).length;
    if (weeks < PLATEAU_WEEKS || sessionsSince < PLATEAU_MIN_SESSIONS - 1) continue;
    const suggestion: Plateau['suggestion'] =
      weeks >= 6 ? 'variation' : weeks >= 4 || experience === 'advanced' ? 'deload' : 'rep_range';
    out.push({
      exerciseId,
      bestE1rm: best.bestE1rm!,
      bestDate: best.date,
      weeks,
      sessionsSince,
      suggestion,
    });
  }
  return out.sort((a, b) => b.weeks - a.weeks);
}

// ---------------------------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------------------------

export const PULL: MuscleGroup[] = ['back', 'biceps'];
export const UPPER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
export const LOWER: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

export interface BalanceRatio {
  key: 'push_pull' | 'quad_ham' | 'upper_lower';
  label: string;
  a: { label: string; sets: number };
  b: { label: string; sets: number };
  ratio: number | null;
  /** Healthy range for a ratio of a to b. */
  range: [number, number];
  verdict: 'balanced' | 'a_heavy' | 'b_heavy' | 'too_little';
}

/**
 * Working sets by the primary muscle of each exercise over the last 4 weeks. Push is chest,
 * triceps and shoulder presses; pull is back and biceps. Shoulder isolation work (raises, rear
 * delt flyes) is left out of push and pull, because it is neither. A push to pull ratio outside
 * 0.67 to 1.5 is flagged. Quads may lean to hamstrings and the upper body has more muscles than
 * the lower, so those two ranges run to 2. Needs 20 sets in the pair to say anything.
 */
export function balanceRatios(sessions: Session[], now: Date): BalanceRatio[] {
  const recent = sessionsBetween(sessions, addDays(now, -28), addDays(now, 1));
  const sets = new Map<MuscleGroup, number>();
  let shoulderPresses = 0;
  for (const s of recent)
    for (const { exercise, sets: logged } of s.exercises) {
      if (!exercise) continue;
      const n = logged.filter(isWorkingSet).length;
      sets.set(exercise.primaryMuscle, (sets.get(exercise.primaryMuscle) ?? 0) + n);
      if (exercise.primaryMuscle === 'shoulders' && exercise.category === 'compound')
        shoulderPresses += n;
    }
  const sum = (ms: MuscleGroup[]) => ms.reduce((n, m) => n + (sets.get(m) ?? 0), 0);
  const push = (sets.get('chest') ?? 0) + (sets.get('triceps') ?? 0) + shoulderPresses;
  const make = (
    key: BalanceRatio['key'],
    label: string,
    aLabel: string,
    a: number,
    bLabel: string,
    b: number,
    range: [number, number],
  ): BalanceRatio => {
    const ratio = b > 0 ? a / b : null;
    const verdict: BalanceRatio['verdict'] =
      a + b < 20
        ? 'too_little'
        : ratio === null || ratio > range[1]
          ? 'a_heavy'
          : ratio < range[0]
            ? 'b_heavy'
            : 'balanced';
    return {
      key,
      label,
      a: { label: aLabel, sets: a },
      b: { label: bLabel, sets: b },
      ratio,
      range,
      verdict,
    };
  };
  return [
    make('push_pull', 'Push and pull', 'Push', push, 'Pull', sum(PULL), [0.67, 1.5]),
    make(
      'quad_ham',
      'Quads and hamstrings',
      'Quads',
      sets.get('quads') ?? 0,
      'Hamstrings',
      sets.get('hamstrings') ?? 0,
      [0.67, 2],
    ),
    make(
      'upper_lower',
      'Upper and lower body',
      'Upper',
      sum(UPPER),
      'Lower',
      sum(LOWER),
      [0.67, 2],
    ),
  ];
}

// ---------------------------------------------------------------------------------------------
// Training load
// ---------------------------------------------------------------------------------------------

/** Foster's session RPE load: effort (1 to 10) × minutes. Null without both. */
export function sessionLoad(
  sessionRpe: number | null | undefined,
  minutes: number | null,
): number | null {
  if (!sessionRpe || !minutes) return null;
  return Math.round(sessionRpe * minutes);
}

export interface LoadSpike {
  acuteSets: number;
  chronicSetsPerWeek: number;
  ratio: number;
}

/**
 * Acute to chronic workload: working sets in the last 7 days against the weekly average of the
 * 4 weeks before. Above 1.5, injury risk rises in the sports science literature (Gabbett, 2016),
 * so a jump that big is flagged. Needs 5 weeks of history and at least 10 sets a week before.
 */
export function loadSpike(sessions: Session[], now: Date): LoadSpike | null {
  const first = sessions[0];
  if (!first || first.date > addDays(now, -35)) return null;
  const count = (from: Date, to: Date) =>
    sessionsBetween(sessions, from, to).reduce(
      (n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter(isWorkingSet).length, 0),
      0,
    );
  // Whole calendar days: today and the 6 before it, against the 28 days before those.
  const end = addDays(startOfDay(now), 1);
  const acuteStart = addDays(end, -7);
  const acute = count(acuteStart, end);
  const chronic = count(addDays(acuteStart, -28), acuteStart) / 4;
  if (chronic < 10) return null;
  const ratio = acute / chronic;
  return ratio > 1.5 ? { acuteSets: acute, chronicSetsPerWeek: chronic, ratio } : null;
}

// ---------------------------------------------------------------------------------------------
// Everything for the Progress page
// ---------------------------------------------------------------------------------------------

export interface StrengthProfile {
  levels: StrengthLevel[];
  /** Estimated DOTS from the best e1RMs of squat, bench and deadlift, when all three exist. */
  dots: { score: number; totalKg: number } | null;
  rates: { exerciseId: string; kgPerWeek: number }[];
}

/** Built-in exercise ids are derived from their keys, the same way the library does it. */
const STANDARD_KEY_BY_ID = new Map(
  Object.keys(STANDARDS).map((key) => [stableId(`exercise:${key}`), key]),
);

export function strengthProfile(
  byExercise: Map<string, ExercisePerformance[]>,
  exercises: Exercise[],
  bodyWeightKg: number | null,
  sex: Sex | null | undefined,
  now: Date,
): StrengthProfile {
  const best = new Map<string, { exerciseId: string; e1rm: number }>();
  for (const [exerciseId, history] of byExercise) {
    const key = STANDARD_KEY_BY_ID.get(exerciseId);
    if (!key || !STANDARDS[key]) continue;
    // Best of the last 12 weeks: a level should describe you now, not a year ago.
    const recent = history.filter(
      (p) => p.bestE1rm !== null && p.date >= addDays(now, -84) && p.date <= now,
    );
    const top = Math.max(...recent.map((p) => p.bestE1rm!));
    if (Number.isFinite(top)) best.set(key, { exerciseId, e1rm: top });
  }
  const levels: StrengthLevel[] = [];
  if (bodyWeightKg && (sex === 'male' || sex === 'female'))
    for (const [key, b] of best) {
      const l = strengthLevel(key, b.exerciseId, b.e1rm, bodyWeightKg, sex);
      if (l) levels.push(l);
    }
  const order = Object.keys(STANDARDS);
  levels.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const sbd = ['back-squat', 'barbell-bench-press', 'deadlift'].map((k) => best.get(k)?.e1rm);
  const dots =
    bodyWeightKg && (sex === 'male' || sex === 'female') && sbd.every((v) => v !== undefined)
      ? (() => {
          const totalKg = sbd.reduce((a, b) => a! + b!, 0)!;
          return { score: dotsScore(totalKg, bodyWeightKg, sex), totalKg };
        })()
      : null;
  const compound = new Set(exercises.filter((e) => e.category === 'compound').map((e) => e.id));
  const rates: StrengthProfile['rates'] = [];
  for (const [exerciseId, history] of byExercise) {
    if (!compound.has(exerciseId)) continue;
    const rate = e1rmRate(history, now);
    if (rate !== null) rates.push({ exerciseId, kgPerWeek: rate });
  }
  rates.sort((a, b) => b.kgPerWeek - a.kgPerWeek);
  return { levels, dots, rates };
}

// ---------------------------------------------------------------------------------------------
// Readiness patterns
// ---------------------------------------------------------------------------------------------

export interface ReadinessPattern {
  factor: 'sleep' | 'energy';
  /** Average change in best e1RM against the previous session of the same lift, as a share. */
  good: { sessions: number; change: number };
  poor: { sessions: number; change: number };
}

/**
 * Compares sessions after a good night or with good energy (4 or 5) with poor ones (1 or 2):
 * for each, the average change in every lift's best e1RM against the previous session of that
 * lift. Needs 4 sessions on each side; reports the factor with the bigger gap.
 */
export function readinessPattern(
  sessions: Session[],
  history: Map<string, ExercisePerformance[]>,
): ReadinessPattern | null {
  const change = new Map<string, number>();
  for (const list of history.values())
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!.bestE1rm;
      const cur = list[i]!.bestE1rm;
      if (prev && cur) {
        const key = list[i]!.workoutId;
        const values = change.get(key);
        change.set(key, values === undefined ? cur / prev - 1 : (values + cur / prev - 1) / 2);
      }
    }
  let best: ReadinessPattern | null = null;
  for (const factor of ['sleep', 'energy'] as const) {
    const good: number[] = [];
    const poor: number[] = [];
    for (const s of sessions) {
      const r = s.workout.readiness;
      const c = change.get(s.workout.id);
      if (!r || c === undefined) continue;
      if (r[factor] >= 4) good.push(c);
      else if (r[factor] <= 2) poor.push(c);
    }
    if (good.length < 4 || poor.length < 4) continue;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const p: ReadinessPattern = {
      factor,
      good: { sessions: good.length, change: avg(good) },
      poor: { sessions: poor.length, change: avg(poor) },
    };
    if (
      !best ||
      Math.abs(p.good.change - p.poor.change) > Math.abs(best.good.change - best.poor.change)
    )
      best = p;
  }
  return best;
}
