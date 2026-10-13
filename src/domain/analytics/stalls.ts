import { stableId } from '@/lib/ids';
import type { Exercise, Experience } from '../models/schemas';
import { estimateOneRepMax, supportsE1rm } from './e1rm';
import { isLoadEligible, type Session } from './sessions';

/**
 * Stalled lifts, each with its own diagnosis.
 *
 * Progress is judged on what was actually lifted, not on an estimate: a session moves the lift
 * forward when one of its sets beats every earlier set on weight at the same reps or more, or
 * on reps at the same weight or more. Only sets at 80% or more of the heaviest weight used
 * count, so a light pump set cannot hide a stall.
 *
 * A lift has stalled when nothing has moved for STALL_WEEKS weeks or more, across at least
 * STALL_MIN_SESSIONS sessions of it since, and it was trained in the last 2 weeks (a lift you
 * stopped doing is not stalled). The cause is read from the sessions since the last best, in
 * this order, and the first that fits is the one shown:
 *
 * 1. break:     a gap of 3 weeks or more without the lift. Strength fades after about 3 weeks
 *               off (Bosquet 2013) and comes back faster than it was first built.
 * 2. frequency: under 0.75 sessions a week. Weekly sets drive progress, and training a lift
 *               rarely keeps them low (Schoenfeld 2019, Pelland 2026).
 * 3. effort:    reps in reserve logged on at least half the sets, with a median of 3 or more.
 *               Sets far from failure give less (Robinson 2024).
 * 4. volume:    a quarter fewer sets a session than in the 6 weeks before the best.
 * 5. same_load: the same top weight every session. Adding reps first, then weight, works as
 *               well as adding weight (Plotkin 2022).
 * 6. otherwise a true plateau, by how long it has lasted: a new rep range (under 4 weeks),
 *    a lighter week (4 to 6 weeks, or sooner for advanced lifters; Bell 2023), then a close
 *    variation of the lift (6 weeks or more; Kassiano 2022).
 */

export const STALL_WEEKS = 3;
export const STALL_MIN_SESSIONS = 3;
export const BREAK_DAYS = 21;
export const MIN_PER_WEEK = 0.75;
export const EFFORT_RIR = 3;
export const VOLUME_DROP = 0.75;
const NEAR_TOP = 0.8;
const DAY = 86_400_000;

export type StallCause =
  'break' | 'frequency' | 'effort' | 'volume' | 'same_load' | 'rep_range' | 'deload' | 'variation';

export interface Stall {
  exerciseId: string;
  /** The last set that moved the lift forward. */
  best: { weightKg: number; reps: number; date: Date };
  /** Whole weeks since that set. */
  weeks: number;
  /** Sessions of this lift since that set. */
  sessionsSince: number;
  lastTrained: Date;
  cause: StallCause;
  /** The numbers behind the cause, so the advice can quote them. */
  facts: {
    gapWeeks?: number;
    perWeek?: number;
    medianRir?: number;
    setsNow?: number;
    setsBefore?: number;
    /** same_load: the weight used every session and the most reps done with it. */
    loadKg?: number;
    repsAtLoad?: number;
    /** rep_range and deload: what to do instead. */
    reps?: [number, number];
    targetKg?: number;
    /** variation: the exercise to swap to, when one fits. */
    variationId?: string;
  };
}

/** Close variations of library lifts: same muscles, a different angle, implement or stance. */
const VARIATIONS: Record<string, string[]> = {
  'barbell-bench-press': ['dumbbell-bench-press', 'close-grip-bench-press', 'machine-chest-press'],
  'incline-barbell-bench-press': ['incline-dumbbell-press', 'barbell-bench-press'],
  'dumbbell-bench-press': ['barbell-bench-press', 'machine-chest-press'],
  'incline-dumbbell-press': ['incline-barbell-bench-press', 'dumbbell-bench-press'],
  'machine-chest-press': ['dumbbell-bench-press', 'barbell-bench-press'],
  'smith-machine-bench-press': ['dumbbell-bench-press', 'barbell-bench-press'],
  'decline-bench-press': ['dips', 'dumbbell-bench-press'],
  'decline-dumbbell-press': ['dips', 'barbell-bench-press'],
  dips: ['close-grip-bench-press', 'decline-bench-press'],
  'weighted-dips': ['close-grip-bench-press', 'decline-bench-press'],
  'overhead-press': ['seated-dumbbell-press', 'machine-shoulder-press'],
  'seated-dumbbell-press': ['overhead-press', 'machine-shoulder-press'],
  'machine-shoulder-press': ['seated-dumbbell-press', 'overhead-press'],
  'arnold-press': ['overhead-press', 'seated-dumbbell-press'],
  'back-squat': ['front-squat', 'hack-squat'],
  'front-squat': ['back-squat', 'hack-squat'],
  'hack-squat': ['back-squat', 'leg-press'],
  'leg-press': ['hack-squat', 'bulgarian-split-squat'],
  'goblet-squat': ['bulgarian-split-squat', 'leg-press'],
  'bulgarian-split-squat': ['walking-lunge', 'leg-press'],
  deadlift: ['sumo-deadlift', 'romanian-deadlift'],
  'sumo-deadlift': ['deadlift', 'romanian-deadlift'],
  'romanian-deadlift': ['stiff-leg-deadlift', 'dumbbell-romanian-deadlift'],
  'dumbbell-romanian-deadlift': ['romanian-deadlift', 'stiff-leg-deadlift'],
  'stiff-leg-deadlift': ['romanian-deadlift', 'good-morning'],
  'hip-thrust': ['machine-hip-thrust', 'glute-bridge'],
  'machine-hip-thrust': ['hip-thrust', 'glute-bridge'],
  'barbell-row': ['chest-supported-row', 'pendlay-row'],
  'pendlay-row': ['barbell-row', 'chest-supported-row'],
  'chest-supported-row': ['seated-cable-row', 'one-arm-dumbbell-row'],
  'seated-cable-row': ['chest-supported-row', 'machine-row'],
  'machine-row': ['seated-cable-row', 'chest-supported-row'],
  't-bar-row': ['chest-supported-row', 'barbell-row'],
  'one-arm-dumbbell-row': ['chest-supported-row', 'seated-cable-row'],
  'lat-pulldown': ['close-grip-lat-pulldown', 'pull-up'],
  'close-grip-lat-pulldown': ['lat-pulldown', 'chin-up'],
  'weighted-pull-up': ['chin-up', 'lat-pulldown'],
  'pull-up': ['chin-up', 'lat-pulldown'],
  'chin-up': ['pull-up', 'close-grip-lat-pulldown'],
  'barbell-curl': ['incline-dumbbell-curl', 'preacher-curl'],
  'ez-bar-curl': ['incline-dumbbell-curl', 'preacher-curl'],
  'dumbbell-curl': ['preacher-curl', 'cable-curl'],
  'preacher-curl': ['incline-dumbbell-curl', 'cable-curl'],
  'cable-curl': ['incline-dumbbell-curl', 'preacher-curl'],
  'hammer-curl': ['ez-bar-curl', 'cable-curl'],
  'close-grip-bench-press': ['weighted-dips', 'skull-crusher'],
  'skull-crusher': ['overhead-triceps-extension', 'close-grip-bench-press'],
  'triceps-rope-pushdown': ['overhead-triceps-extension', 'triceps-bar-pushdown'],
  'triceps-bar-pushdown': ['overhead-triceps-extension', 'skull-crusher'],
  'overhead-triceps-extension': ['skull-crusher', 'triceps-rope-pushdown'],
  'lying-leg-curl': ['seated-leg-curl'],
  'seated-leg-curl': ['lying-leg-curl'],
  'dumbbell-lateral-raise': ['cable-lateral-raise', 'machine-lateral-raise'],
  'cable-lateral-raise': ['machine-lateral-raise', 'dumbbell-lateral-raise'],
  'machine-lateral-raise': ['cable-lateral-raise', 'dumbbell-lateral-raise'],
  'standing-calf-raise': ['leg-press-calf-raise', 'single-leg-calf-raise'],
  'leg-press-calf-raise': ['standing-calf-raise', 'single-leg-calf-raise'],
  'seated-calf-raise': ['standing-calf-raise'],
};
const VARIATION_IDS = new Map(
  Object.entries(VARIATIONS).map(([key, keys]) => [
    stableId(`exercise:${key}`),
    keys.map((k) => stableId(`exercise:${k}`)),
  ]),
);

interface SessionOfLift {
  date: Date;
  /** Working sets with weight and reps (no warm-ups, no drop sets). */
  sets: { w: number; r: number; rir: number | null }[];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Index of the last session whose sets beat every earlier set on weight or reps. */
function lastProgress(list: SessionOfLift[]): { index: number; w: number; r: number } {
  const frontier: { w: number; r: number }[] = [];
  let top = 0;
  let last = { index: 0, w: 0, r: 0 };
  list.forEach((s, index) => {
    const heaviest = Math.max(...s.sets.map((x) => x.w));
    const floor = Math.max(top, heaviest) * NEAR_TOP;
    let moved: { w: number; r: number } | null = null;
    for (const set of s.sets) {
      if (set.w + 1e-9 < floor) continue;
      const beaten = frontier.some((f) => f.w >= set.w - 1e-9 && f.r >= set.r);
      // The first session is the baseline: its best set marks where the lift started.
      if (!beaten && (!moved || set.w > moved.w || (set.w === moved.w && set.r > moved.r)))
        moved = { w: set.w, r: set.r };
    }
    for (const set of s.sets) {
      if (!frontier.some((f) => f.w >= set.w - 1e-9 && f.r >= set.r)) frontier.push(set);
    }
    top = Math.max(top, heaviest);
    if (moved) last = { index, ...moved };
  });
  return last;
}

function suggestedLoad(e1rm: number | null, reps: number): number | undefined {
  return e1rm === null ? undefined : e1rm / (1 + reps / 30);
}

export function detectStalls(
  sessions: Session[],
  now: Date,
  experience: Experience | null | undefined,
  /** Every exercise the person can pick, for variations and names. */
  catalog: Exercise[] = [],
): Stall[] {
  const byLift = new Map<string, { exercise: Exercise; list: SessionOfLift[] }>();
  for (const session of sessions) {
    if (session.date > now) continue;
    for (const ex of session.exercises) {
      const exercise = ex.exercise;
      if (!exercise) continue;
      const sets = ex.sets
        .filter((s) => isLoadEligible(s, exercise) && s.setType !== 'drop')
        .map((s) => ({ w: s.weightKg!, r: s.reps!, rir: s.rir ?? null }));
      if (sets.length === 0) continue;
      const entry = byLift.get(exercise.id) ?? { exercise, list: [] };
      const prev = entry.list[entry.list.length - 1];
      // The same lift twice in one workout counts as one session.
      if (prev && prev.date.getTime() === session.date.getTime()) prev.sets.push(...sets);
      else entry.list.push({ date: session.date, sets });
      byLift.set(exercise.id, entry);
    }
  }

  const trainedRecently = new Map<string, number>();
  for (const [id, { list }] of byLift)
    trainedRecently.set(id, list[list.length - 1]!.date.getTime());

  const out: Stall[] = [];
  for (const [exerciseId, { exercise, list }] of byLift) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (list.length < STALL_MIN_SESSIONS + 1) continue;
    const last = list[list.length - 1]!;
    if (now.getTime() - last.date.getTime() > 14 * DAY) continue;
    const progress = lastProgress(list);
    const best = list[progress.index]!;
    const since = list.slice(progress.index + 1);
    const days = (now.getTime() - best.date.getTime()) / DAY;
    const weeks = Math.floor(days / 7);
    if (weeks < STALL_WEEKS || since.length < STALL_MIN_SESSIONS) continue;

    const base = {
      exerciseId,
      best: { weightKg: progress.w, reps: progress.r, date: best.date },
      weeks,
      sessionsSince: since.length,
      lastTrained: last.date,
    };
    const push = (cause: StallCause, facts: Stall['facts']) => out.push({ ...base, cause, facts });

    // 1. A break.
    let gap = 0;
    [best, ...since].forEach((s, i, all) => {
      if (i > 0) gap = Math.max(gap, s.date.getTime() - all[i - 1]!.date.getTime());
    });
    if (gap >= BREAK_DAYS * DAY) {
      push('break', { gapWeeks: Math.floor(gap / (7 * DAY)) });
      continue;
    }

    // 2. Too rarely.
    // Over the span from the best to the last session, so a weekly lifter is not penalised for
    // the days since their last workout.
    const spanWeeks = Math.max(1, (last.date.getTime() - best.date.getTime()) / (7 * DAY));
    const perWeek = since.length / spanWeeks;
    if (perWeek < MIN_PER_WEEK) {
      push('frequency', { perWeek });
      continue;
    }

    // 3. Far from failure.
    const sinceSets = since.flatMap((s) => s.sets);
    const rirs = sinceSets.map((s) => s.rir).filter((r): r is number => r !== null);
    if (rirs.length >= sinceSets.length / 2 && rirs.length > 0 && median(rirs) >= EFFORT_RIR) {
      push('effort', { medianRir: median(rirs) });
      continue;
    }

    // 4. Fewer sets than while it was improving.
    const before = list.filter(
      (s, i) => i <= progress.index && s.date.getTime() >= best.date.getTime() - 42 * DAY,
    );
    const setsBefore = before.reduce((n, s) => n + s.sets.length, 0) / before.length;
    const setsNow = sinceSets.length / since.length;
    if (before.length >= 2 && setsNow < setsBefore * VOLUME_DROP) {
      push('volume', { setsNow, setsBefore });
      continue;
    }

    // 5. The same top weight every session.
    const tops = since.map((s) => Math.max(...s.sets.map((x) => x.w)));
    if (tops.every((t) => Math.abs(t - tops[0]!) < 1e-6)) {
      const loadKg = tops[0]!;
      const repsAtLoad = Math.max(
        ...since.flatMap((s) =>
          s.sets.filter((x) => Math.abs(x.w - loadKg) < 1e-6).map((x) => x.r),
        ),
      );
      push('same_load', { loadKg, repsAtLoad });
      continue;
    }

    // 6. A true plateau.
    const topSets = since.map((s) => s.sets.reduce((a, b) => (b.w > a.w ? b : a)));
    const typicalReps = median(topSets.map((s) => s.r));
    const e1rm = supportsE1rm(exercise)
      ? Math.max(
          ...since.flatMap((s) => s.sets.map((x) => estimateOneRepMax(x.w, x.r, x.rir) ?? 0)),
        )
      : null;
    const bestE1rm = e1rm && e1rm > 0 ? e1rm : null;
    if (weeks >= 6) {
      const recentIds = new Set(
        [...trainedRecently].filter(([, t]) => now.getTime() - t < 42 * DAY).map(([id]) => id),
      );
      const alive = new Map(
        catalog.filter((e) => e.deletedAt === null).map((e) => [e.id, e] as const),
      );
      const curated = (VARIATION_IDS.get(exerciseId) ?? []).filter(
        (id) => id !== exerciseId && (alive.size === 0 || alive.has(id)),
      );
      // A custom or unlisted lift: the closest library lift for the same muscle and pattern.
      const similar = catalog
        .filter(
          (e) =>
            e.deletedAt === null &&
            !e.isCustom &&
            e.id !== exerciseId &&
            e.primaryMuscle === exercise.primaryMuscle &&
            e.trackingType === 'weight_reps',
        )
        // Same pattern (compound or isolation) first, then a different implement.
        .sort(
          (a, b) =>
            Number(a.category !== exercise.category) - Number(b.category !== exercise.category) ||
            Number(a.equipment === exercise.equipment) - Number(b.equipment === exercise.equipment),
        )
        .map((e) => e.id);
      const options = [...curated, ...similar];
      const variationId = options.find((id) => !recentIds.has(id)) ?? options[0];
      push('variation', variationId ? { variationId } : {});
      continue;
    }
    if (weeks >= 4 || experience === 'advanced') {
      const top = Math.max(...tops);
      push('deload', { targetKg: top * 0.9 });
      continue;
    }
    const reps: [number, number] = typicalReps >= 8 ? [5, 7] : [8, 12];
    push('rep_range', {
      reps,
      targetKg: suggestedLoad(bestE1rm, reps[0] === 5 ? 6 : 10),
    });
  }
  return out.sort((a, b) => b.weeks - a.weeks);
}
