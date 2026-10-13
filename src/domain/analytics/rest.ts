import type { Exercise, WorkoutSet } from '../models/schemas';
import type { Session } from './sessions';

/**
 * Rest, measured from when sets were ticked off. The app records the moment each set is
 * finished, so the time between two finished sets is the rest plus the next set itself:
 *
 *   rest = (finished next set − finished previous set) − time to do the next set
 *
 * The next set's time is its logged duration, or SECONDS_PER_REP for each rep (a controlled
 * rep takes about 2 to 4 seconds). Gaps that cannot be rest are left out: under MIN_REST
 * seconds (sets ticked off together, as after logging from memory or an import) and over
 * MAX_REST seconds (a pause, a chat, a phone call).
 */

export const SECONDS_PER_REP = 3;
export const MIN_REST = 10;
export const MAX_REST = 15 * 60;
/** Timed intervals needed before the rest analysis says anything. */
export const REST_MIN_INTERVALS = 20;
/** Pairs of sets needed in a rest band before it is compared. */
export const REST_MIN_PAIRS = 8;
/** Rest bands for comparing how many reps you keep, in seconds. */
export const REST_BANDS: [number, number][] = [
  [0, 90],
  [90, 150],
  [150, 240],
  [240, Infinity],
];
/**
 * Shorter than these is called short: under 90 s on compound lifts (2 to 3 minutes keeps more
 * reps and builds more; Schoenfeld 2016, Grgic 2018) and under 60 s on isolation lifts (rests
 * over 60 s grow slightly more muscle; Singer 2024).
 */
export const COMPOUND_SHORT = 90;
export const ISOLATION_SHORT = 60;

export interface RestInterval {
  /** The set this rest came before. */
  setId: string;
  prevSetId: string;
  /** set: between two sets of one exercise; exercise: moving to the next exercise. */
  kind: 'set' | 'exercise';
  seconds: number;
}

const finished = (s: WorkoutSet) => (s.completedAt ? Date.parse(s.completedAt) : NaN);

export function setSeconds(set: WorkoutSet): number {
  if (set.durationSec !== null && set.durationSec > 0) return set.durationSec;
  return (set.reps ?? 0) * SECONDS_PER_REP;
}

/** Rest before each finished set of one workout, keyed by the set's id. */
export function restIntervals(sets: WorkoutSet[]): Map<string, RestInterval> {
  const done = sets
    .filter((s) => s.deletedAt === null && s.completedAt !== null && Number.isFinite(finished(s)))
    .sort((a, b) => finished(a) - finished(b));
  const out = new Map<string, RestInterval>();
  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1]!;
    const next = done[i]!;
    const seconds = Math.round((finished(next) - finished(prev)) / 1000 - setSeconds(next));
    if (seconds < MIN_REST || seconds > MAX_REST) continue;
    out.set(next.id, {
      setId: next.id,
      prevSetId: prev.id,
      kind: prev.workoutExerciseId === next.workoutExerciseId ? 'set' : 'exercise',
      seconds,
    });
  }
  return out;
}

export const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export interface WorkoutRest {
  betweenSets: { median: number | null; count: number };
  betweenExercises: { median: number | null; count: number };
  /** All measured rest, seconds. */
  totalSeconds: number;
  /** Finished sets after the first that had a measurable rest before them, 0 to 1. */
  timedShare: number;
}

export function workoutRest(sets: WorkoutSet[]): WorkoutRest {
  const rests = [...restIntervals(sets).values()];
  const setRests = rests.filter((r) => r.kind === 'set').map((r) => r.seconds);
  const exRests = rests.filter((r) => r.kind === 'exercise').map((r) => r.seconds);
  const finishedCount = sets.filter((s) => s.deletedAt === null && s.completedAt !== null).length;
  return {
    betweenSets: { median: median(setRests), count: setRests.length },
    betweenExercises: { median: median(exRests), count: exRests.length },
    totalSeconds: rests.reduce((n, r) => n + r.seconds, 0),
    timedShare: finishedCount > 1 ? rests.length / (finishedCount - 1) : 0,
  };
}

export interface RestBand {
  from: number;
  to: number;
  pairs: number;
  /** Mean reps on the next set as a share of the set before, at the same weight. */
  kept: number | null;
}

export interface RestAnalysis {
  intervals: number;
  compound: { median: number | null; count: number; underFloor: number };
  isolation: { median: number | null; count: number; underFloor: number };
  betweenExercises: { median: number | null; count: number };
  bands: RestBand[];
  /** The shortest band that keeps within 5 points of your best band, when two bands compare. */
  personal: { band: RestBand; best: RestBand; shortest: RestBand } | null;
  verdicts: ('compound_short' | 'isolation_short' | 'on_target')[];
}

/**
 * Rest over a window of sessions: how long you rest on compound and isolation lifts against the
 * evidence, and how many reps you keep on the next set at the same weight after each length of
 * rest. Working sets only; warm-ups are rested however you like.
 */
export function restAnalysis(sessions: Session[], from: Date, to: Date): RestAnalysis {
  const compound: number[] = [];
  const isolation: number[] = [];
  const exerciseChanges: number[] = [];
  const pairs: { seconds: number; kept: number }[] = [];
  for (const session of sessions) {
    if (session.date < from || session.date >= to) continue;
    const exercises = new Map<string, Exercise | undefined>();
    const all: WorkoutSet[] = [];
    for (const ex of session.exercises) {
      for (const s of ex.sets) exercises.set(s.id, ex.exercise);
      all.push(...ex.sets);
    }
    const byId = new Map(all.map((s) => [s.id, s]));
    for (const r of restIntervals(all).values()) {
      const next = byId.get(r.setId)!;
      const prev = byId.get(r.prevSetId)!;
      if (next.setType === 'warmup') continue;
      if (r.kind === 'exercise') {
        exerciseChanges.push(r.seconds);
        continue;
      }
      if (prev.setType === 'warmup') continue;
      const exercise = exercises.get(next.id);
      if (!exercise) continue;
      (exercise.category === 'compound' ? compound : isolation).push(r.seconds);
      // Reps kept: the same exercise, both working sets, the same weight.
      if (
        exercise.trackingType === 'weight_reps' &&
        next.setType === 'working' &&
        prev.setType === 'working' &&
        (prev.reps ?? 0) >= 3 &&
        (next.reps ?? 0) > 0 &&
        (prev.weightKg ?? 0) > 0 &&
        Math.abs((next.weightKg ?? 0) - prev.weightKg!) <= prev.weightKg! * 0.005
      ) {
        pairs.push({ seconds: r.seconds, kept: Math.min(1.5, next.reps! / prev.reps!) });
      }
    }
  }
  const bands: RestBand[] = REST_BANDS.map(([lo, hi]) => {
    const inBand = pairs.filter((p) => p.seconds >= lo && p.seconds < hi);
    return {
      from: lo,
      to: hi,
      pairs: inBand.length,
      kept: inBand.length ? inBand.reduce((n, p) => n + p.kept, 0) / inBand.length : null,
    };
  });
  const usable = bands.filter((b) => b.pairs >= REST_MIN_PAIRS && b.kept !== null);
  let personal: RestAnalysis['personal'] = null;
  if (usable.length >= 2) {
    const best = usable.reduce((a, b) => (b.kept! > a.kept! ? b : a));
    const band = usable.find((b) => b.kept! >= best.kept! - 0.05)!;
    personal = { band, best, shortest: usable[0]! };
  }
  const cMedian = median(compound);
  const iMedian = median(isolation);
  const verdicts: RestAnalysis['verdicts'] = [];
  if (cMedian !== null && compound.length >= 5 && cMedian < COMPOUND_SHORT)
    verdicts.push('compound_short');
  if (iMedian !== null && isolation.length >= 5 && iMedian < ISOLATION_SHORT)
    verdicts.push('isolation_short');
  if (verdicts.length === 0 && (cMedian !== null || iMedian !== null)) verdicts.push('on_target');
  return {
    intervals: compound.length + isolation.length + exerciseChanges.length,
    compound: {
      median: cMedian,
      count: compound.length,
      underFloor: compound.filter((s) => s < COMPOUND_SHORT).length,
    },
    isolation: {
      median: iMedian,
      count: isolation.length,
      underFloor: isolation.filter((s) => s < ISOLATION_SHORT).length,
    },
    betweenExercises: { median: median(exerciseChanges), count: exerciseChanges.length },
    bands,
    personal,
    verdicts,
  };
}

/** "45 s", "2:05", "12:30". */
export function formatRest(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
