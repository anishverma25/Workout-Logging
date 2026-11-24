import type { WorkoutSet } from '../models/schemas';
import { areaOfRegion, BODY_AREAS, type BodyArea } from './bodyMap';
import { isHardSet } from './muscles';
import { isLoadEligible, isWorkingSet, type Session } from './sessions';
import { isSideSet } from './volume';

/**
 * Training quality (November 2026): five reads of the person's own sets, each one tied to a
 * decision. All pure, all from logged sets; nothing is estimated beyond what the sets show.
 *
 * - Ready to train: hours since each muscle last had hard sets (what to train today).
 * - Set fatigue: reps lost from the first to the last set at one weight (rest or cut a set).
 * - Effort check: logged reps in reserve against how fast reps fall (are sets harder than logged).
 * - Rep ranges: share of heavy, moderate and light sets (does the training fit the goal).
 * - Left and right: the gap between sides on one-sided exercises (balance).
 */

// ---------------------------------------------------------------------------------------------
// Ready to train
// ---------------------------------------------------------------------------------------------

/** Under this many hours since hard sets a muscle is still recovering; from this on, ready. */
export const RECOVERING_HOURS = 48;
export const READY_HOURS = 72;
/** A muscle counts as trained in a session from this many hard sets (shares added up). */
export const TRAINED_SETS = 1;

export type Readiness = 'recovering' | 'nearly' | 'ready' | 'untrained';

export interface AreaReadiness {
  area: BodyArea;
  /** Hours since the last session that gave it hard sets, or null when none in the window. */
  hours: number | null;
  /** Hard sets it got in that session (shares added up). */
  sets: number;
  status: Readiness;
}

type SharesLookup = (exerciseId: string) => { regions: { region: string; share: number }[] } | null;

export function readiness(
  sessions: readonly Session[],
  sharesFor: SharesLookup,
  now: Date,
  /** Only sessions this recent count (two weeks). */
  windowDays = 14,
): AreaReadiness[] {
  const since = now.getTime() - windowDays * 86_400_000;
  const last = new Map<BodyArea, { at: number; sets: number }>();
  for (const s of sessions) {
    const at = s.date.getTime();
    if (at < since || at > now.getTime()) continue;
    const got = new Map<BodyArea, number>();
    for (const e of s.exercises) {
      if (!e.exercise || e.exercise.trackingType === 'cardio') continue;
      const hard = e.sets.filter((x) => isWorkingSet(x) && isHardSet(x)).length;
      if (!hard) continue;
      const shares = sharesFor(e.workoutExercise.exerciseId);
      if (!shares) continue;
      for (const r of shares.regions) {
        const area = areaOfRegion(r.region);
        if (area) got.set(area, (got.get(area) ?? 0) + (hard * r.share) / 100);
      }
    }
    for (const [area, sets] of got) {
      if (sets < TRAINED_SETS) continue;
      const prev = last.get(area);
      if (!prev || at > prev.at) last.set(area, { at, sets });
    }
  }
  return BODY_AREAS.map((area) => {
    const l = last.get(area);
    if (!l) return { area, hours: null, sets: 0, status: 'untrained' as const };
    const hours = (now.getTime() - l.at) / 3_600_000;
    const status: Readiness =
      hours < RECOVERING_HOURS ? 'recovering' : hours < READY_HOURS ? 'nearly' : 'ready';
    return { area, hours, sets: Math.round(l.sets * 10) / 10, status };
  });
}

// ---------------------------------------------------------------------------------------------
// Set fatigue
// ---------------------------------------------------------------------------------------------

/** A run needs this many working sets at one weight to count. */
export const FATIGUE_MIN_SETS = 3;
/** Sessions an exercise needs before its fatigue is shown. */
export const FATIGUE_MIN_SESSIONS = 3;
export const FATIGUE_LOW = 0.15;
export const FATIGUE_HIGH = 0.3;

export interface ExerciseFatigue {
  exerciseId: string;
  name: string;
  /** Average share of reps lost from the first to the last set at one weight (0.2 is 20%). */
  drop: number;
  /** Average reps of the first and the last set. */
  firstReps: number;
  lastReps: number;
  sessions: number;
  verdict: 'holding' | 'normal' | 'steep';
}

const sameWeight = (a: WorkoutSet, b: WorkoutSet) =>
  Math.abs((a.weightKg ?? 0) - (b.weightKg ?? 0)) < 0.01;

function fatigueRuns(sessions: readonly Session[]) {
  const runs = new Map<
    string,
    { name: string; drops: number[]; first: number[]; last: number[] }
  >();
  for (const s of sessions)
    for (const e of s.exercises) {
      const sets = e.sets
        .filter((x) => isLoadEligible(x, e.exercise) && x.setType === 'working')
        .sort((a, b) => a.order - b.order);
      if (sets.length < FATIGUE_MIN_SETS) continue;
      // The longest run at the first set's weight.
      const run = sets.filter((x) => sameWeight(x, sets[0]!));
      if (run.length < FATIGUE_MIN_SETS) continue;
      const first = run[0]!.reps!;
      const lastReps = run[run.length - 1]!.reps!;
      const r = runs.get(e.workoutExercise.exerciseId) ?? {
        name: e.workoutExercise.exerciseName,
        drops: [],
        first: [],
        last: [],
      };
      r.drops.push(Math.max(0, (first - lastReps) / first));
      r.first.push(first);
      r.last.push(lastReps);
      runs.set(e.workoutExercise.exerciseId, r);
    }
  return runs;
}

/** The most sessions any one exercise has towards set fatigue (for the unlock progress). */
export function fatigueSessions(sessions: readonly Session[]): number {
  let most = 0;
  for (const r of fatigueRuns(sessions).values()) most = Math.max(most, r.drops.length);
  return most;
}

export function setFatigue(sessions: readonly Session[]): ExerciseFatigue[] {
  const runs = fatigueRuns(sessions);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return [...runs.entries()]
    .filter(([, r]) => r.drops.length >= FATIGUE_MIN_SESSIONS)
    .map(([exerciseId, r]) => {
      const drop = mean(r.drops);
      return {
        exerciseId,
        name: r.name,
        drop,
        firstReps: Math.round(mean(r.first) * 10) / 10,
        lastReps: Math.round(mean(r.last) * 10) / 10,
        sessions: r.drops.length,
        verdict:
          drop < FATIGUE_LOW
            ? ('holding' as const)
            : drop <= FATIGUE_HIGH
              ? ('normal' as const)
              : ('steep' as const),
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

// ---------------------------------------------------------------------------------------------
// Effort check
// ---------------------------------------------------------------------------------------------

/** A logged RIR of this or more is "reps left". */
export const EFFORT_LOGGED_RIR = 2;
/** Losing this many reps or more on the next set at the same weight suggests a set near failure. */
export const EFFORT_REP_DROP = 3;
/** Pairs needed before anything is said. */
export const EFFORT_MIN_PAIRS = 10;

export interface EffortCheck {
  /** Sets logged at RIR 2 or more that were followed by a set at the same weight. */
  pairs: number;
  /** Of those, how many lost 3 or more reps on the next set. */
  steep: number;
  share: number;
  verdict: 'matches' | 'harder' | 'not-enough';
}

export function effortCheck(sessions: readonly Session[]): EffortCheck {
  let pairs = 0;
  let steep = 0;
  for (const s of sessions)
    for (const e of s.exercises) {
      const sets = e.sets
        .filter((x) => isLoadEligible(x, e.exercise) && x.setType === 'working')
        .sort((a, b) => a.order - b.order);
      for (let i = 0; i + 1 < sets.length; i++) {
        const a = sets[i]!;
        const b = sets[i + 1]!;
        const rir = a.rir ?? (a.rpe !== null ? 10 - a.rpe : null);
        if (rir === null || rir < EFFORT_LOGGED_RIR || !sameWeight(a, b)) continue;
        pairs++;
        if ((a.reps ?? 0) - (b.reps ?? 0) >= EFFORT_REP_DROP) steep++;
      }
    }
  const share = pairs ? steep / pairs : 0;
  return {
    pairs,
    steep,
    share,
    verdict: pairs < EFFORT_MIN_PAIRS ? 'not-enough' : share >= 0.3 ? 'harder' : 'matches',
  };
}

// ---------------------------------------------------------------------------------------------
// Rep ranges
// ---------------------------------------------------------------------------------------------

export const HEAVY_MAX_REPS = 5;
export const MODERATE_MAX_REPS = 12;
/** A strength goal with fewer heavy sets than this share gets a nudge. */
export const STRENGTH_HEAVY_SHARE = 0.2;

export interface RepRanges {
  heavy: number;
  moderate: number;
  light: number;
  total: number;
}

export function repRanges(sessions: readonly Session[]): RepRanges {
  const out = { heavy: 0, moderate: 0, light: 0, total: 0 };
  for (const s of sessions)
    for (const e of s.exercises)
      for (const x of e.sets) {
        if (!isLoadEligible(x, e.exercise)) continue;
        const reps = x.reps!;
        if (reps <= HEAVY_MAX_REPS) out.heavy++;
        else if (reps <= MODERATE_MAX_REPS) out.moderate++;
        else out.light++;
        out.total++;
      }
  return out;
}

/** Whole percentages that add up to exactly 100 (largest remainder). */
export function wholeShares(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c * 100) / total);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (left-- > 0) out[i]!++;
  return out;
}

/** Sets in the period before the rep ranges say anything about the mix. */
export const REP_RANGE_MIN_SETS = 20;

export type RepRangeNote = 'not-enough' | 'add-heavy' | 'fits-strength' | 'any-load-grows';

/**
 * What the mix means for the goal. Strength is specific to heavy loads (Schoenfeld et al.
 * 2017), so a strength goal wants some sets of 1 to 5 reps; for size, light and heavy sets grow
 * muscle about equally when taken close to failure, so any mix works.
 */
export function repRangeNote(r: RepRanges, goal: string | null | undefined): RepRangeNote {
  if (r.total < REP_RANGE_MIN_SETS) return 'not-enough';
  const strength = goal === 'strength' || goal === 'strength_hypertrophy';
  if (strength) return r.heavy / r.total < STRENGTH_HEAVY_SHARE ? 'add-heavy' : 'fits-strength';
  return 'any-load-grows';
}

// ---------------------------------------------------------------------------------------------
// Left and right
// ---------------------------------------------------------------------------------------------

/** A gap bigger than this share is worth evening out. */
export const SIDE_GAP = 0.1;
export const SIDE_MIN_SESSIONS = 3;

export interface SideBalance {
  exerciseId: string;
  name: string;
  /** Average share by which the stronger side out-repped the weaker (0.12 is 12%). */
  gap: number;
  /** Which side did more reps overall. */
  stronger: 'left' | 'right' | 'even';
  sessions: number;
  /** Gap in the first and the latest session, to see the trend. */
  firstGap: number;
  lastGap: number;
}

export function sideBalance(sessions: readonly Session[]): SideBalance[] {
  const by = new Map<string, { name: string; gaps: number[]; left: number; right: number }>();
  const ordered = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const s of ordered)
    for (const e of s.exercises) {
      const sets = e.sets.filter((x) => isWorkingSet(x) && isSideSet(x));
      const left = sets.reduce((n, x) => n + (x.repsLeft ?? 0), 0);
      const right = sets.reduce((n, x) => n + (x.repsRight ?? 0), 0);
      if (!left || !right) continue;
      const r = by.get(e.workoutExercise.exerciseId) ?? {
        name: e.workoutExercise.exerciseName,
        gaps: [],
        left: 0,
        right: 0,
      };
      r.gaps.push(Math.abs(left - right) / Math.max(left, right));
      r.left += left;
      r.right += right;
      by.set(e.workoutExercise.exerciseId, r);
    }
  return [...by.entries()]
    .filter(([, r]) => r.gaps.length >= SIDE_MIN_SESSIONS)
    .map(([exerciseId, r]) => ({
      exerciseId,
      name: r.name,
      gap: r.gaps.reduce((a, b) => a + b, 0) / r.gaps.length,
      stronger:
        r.left === r.right
          ? ('even' as const)
          : r.left > r.right
            ? ('left' as const)
            : ('right' as const),
      sessions: r.gaps.length,
      firstGap: r.gaps[0]!,
      lastGap: r.gaps[r.gaps.length - 1]!,
    }))
    .sort((a, b) => b.gap - a.gap);
}
