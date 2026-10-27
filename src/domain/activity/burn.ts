import { toDateKey } from '@/lib/dates';
import type {
  ActivityLog,
  BodyWeightEntry,
  CardioActivity,
  Workout,
  WorkoutSet,
} from '../models/schemas';

/**
 * Calories burned, estimated (science topic `activity-energy`). Always rough: a good estimate is
 * within 10 to 25% for most people, and can be further out. A number from a fitness watch or a
 * gym machine the person trusts always replaces ours.
 *
 * Everything is "active calories": above what the body burns at rest, which the daily target
 * already counts. So kcal = (MET - 1) x body weight in kg x hours, with MET the metabolic
 * equivalent of the activity (Compendium of Physical Activities, 2011 and the 2024 update) or,
 * for walking, running and cycling with known load, the ACSM metabolic equations
 * (VO2 in ml/kg/min, MET = VO2 / 3.5).
 */

export type Effort = 'light' | 'moderate' | 'hard';

export interface CardioKind {
  id: CardioActivity;
  label: string;
  /** What the person can enter beyond minutes, to sharpen the estimate. */
  inputs: ('speed' | 'incline' | 'distance' | 'watts')[];
  /** Efforts to choose from, when the estimate uses effort; empty when it does not. */
  efforts: Effort[];
}

export const CARDIO_KINDS: CardioKind[] = [
  { id: 'treadmill_walk', label: 'Treadmill walk', inputs: ['speed', 'incline'], efforts: [] },
  { id: 'treadmill_run', label: 'Treadmill run', inputs: ['speed', 'incline'], efforts: [] },
  { id: 'stair_machine', label: 'Stair master', inputs: [], efforts: [] },
  {
    id: 'cycle_indoor',
    label: 'Cycle (gym bike)',
    inputs: ['watts'],
    efforts: ['light', 'moderate', 'hard'],
  },
  { id: 'elliptical', label: 'Elliptical', inputs: [], efforts: ['moderate', 'hard'] },
  {
    id: 'rowing_machine',
    label: 'Rowing machine',
    inputs: ['watts'],
    efforts: ['moderate', 'hard'],
  },
  { id: 'walk_outdoor', label: 'Walk outside', inputs: ['distance'], efforts: [] },
  { id: 'run_outdoor', label: 'Run outside', inputs: ['distance'], efforts: [] },
  {
    id: 'cycle_outdoor',
    label: 'Cycle outside',
    inputs: ['distance'],
    efforts: ['light', 'moderate', 'hard'],
  },
  { id: 'swimming', label: 'Swimming laps', inputs: [], efforts: ['moderate', 'hard'] },
  { id: 'hiit', label: 'HIIT or circuit', inputs: [], efforts: ['moderate', 'hard'] },
  { id: 'other', label: 'Something else', inputs: [], efforts: ['light', 'moderate', 'hard'] },
];

export const kindOf = (id: CardioActivity) => CARDIO_KINDS.find((k) => k.id === id)!;

/** METs by effort where the Compendium gives them; the activities without effort use one value. */
const MET: Record<CardioActivity, Partial<Record<Effort | 'general', number>>> = {
  treadmill_walk: {},
  treadmill_run: {},
  walk_outdoor: {},
  run_outdoor: {},
  stair_machine: { general: 9.3 },
  cycle_indoor: { light: 3.5, moderate: 6.8, hard: 8.8 },
  elliptical: { moderate: 5.0, hard: 9.0 },
  rowing_machine: { moderate: 5.0, hard: 7.3 },
  cycle_outdoor: { light: 4.0, moderate: 6.8, hard: 8.0 },
  swimming: { moderate: 5.8, hard: 9.8 },
  hiit: { moderate: 7.0, hard: 11.0 },
  // Midpoints of the standard bands: light under 3, moderate 3 to 6, vigorous over 6.
  other: { light: 2.5, moderate: 4.5, hard: 7.0 },
};

/** Typical speeds when the person gives none, km/h. */
export const DEFAULT_SPEED_KMH = { walk: 5, run: 9 } as const;

const MIN_MET = 1;

/** Net energy: the part above resting. One MET is 1 kcal per kg per hour. */
export function netKcal(met: number, weightKg: number, minutes: number): number {
  return Math.max(0, (met - MIN_MET) * weightKg * (minutes / 60));
}

/** ACSM walking equation: VO2 in ml/kg/min at a speed (km/h) and a grade (percent). */
export function walkingVo2(speedKmh: number, inclinePct: number): number {
  const s = (speedKmh * 1000) / 60;
  return 0.1 * s + 1.8 * s * (inclinePct / 100) + 3.5;
}

/** ACSM running equation. */
export function runningVo2(speedKmh: number, inclinePct: number): number {
  const s = (speedKmh * 1000) / 60;
  return 0.2 * s + 0.9 * s * (inclinePct / 100) + 3.5;
}

/** ACSM leg cycling equation: watts to VO2, with the body weight in kg. */
export function cyclingVo2(watts: number, weightKg: number): number {
  // 1 W is 6.12 kgm/min; 1.8 ml of oxygen per kgm, plus 3.5 resting and 3.5 unloaded pedalling.
  return (1.8 * watts * 6.12) / weightKg + 7;
}

/** Outdoor cycling MET by speed (Compendium bands, mph converted to km/h). */
export function outdoorCyclingMet(speedKmh: number): number {
  if (speedKmh < 16.1) return 4.0;
  if (speedKmh < 19.3) return 6.8;
  if (speedKmh < 22.5) return 8.0;
  if (speedKmh < 25.7) return 10.0;
  return 12.0;
}

/** Rowing MET by watts (Compendium 2024 bands). */
export function rowingMetByWatts(watts: number): number {
  if (watts < 100) return 5.0;
  if (watts < 150) return 7.5;
  if (watts < 200) return 11.0;
  return 14.0;
}

export interface CardioInput {
  activity: CardioActivity;
  minutes: number;
  weightKg: number;
  speedKmh?: number | null;
  inclinePct?: number | null;
  distanceKm?: number | null;
  watts?: number | null;
  effort?: Effort | null;
}

export interface Burn {
  /** Active calories, rounded. */
  kcal: number;
  met: number;
  /** One line on how it was worked out, shown with the number. */
  basis: string;
}

/** The speed to use: the one typed, else distance over time, else a typical one. */
export function speedFor(input: CardioInput, kind: 'walk' | 'run'): number {
  if (input.speedKmh && input.speedKmh > 0) return input.speedKmh;
  if (input.distanceKm && input.distanceKm > 0 && input.minutes > 0)
    return input.distanceKm / (input.minutes / 60);
  return DEFAULT_SPEED_KMH[kind];
}

export function estimateCardio(input: CardioInput): Burn | null {
  const { activity, minutes, weightKg } = input;
  if (!(minutes > 0) || !(weightKg > 0)) return null;
  const effort = input.effort ?? 'moderate';
  let met: number;
  let basis: string;
  switch (activity) {
    case 'treadmill_walk':
    case 'walk_outdoor': {
      const speed = Math.min(speedFor(input, 'walk'), 9);
      const incline = activity === 'treadmill_walk' ? (input.inclinePct ?? 0) : 0;
      met = walkingVo2(speed, incline) / 3.5;
      basis = `Walking at ${speed.toFixed(1)} km/h${incline ? ` on a ${incline}% incline` : ''}, ACSM walking equation`;
      break;
    }
    case 'treadmill_run':
    case 'run_outdoor': {
      const speed = Math.max(speedFor(input, 'run'), 5);
      const incline = activity === 'treadmill_run' ? (input.inclinePct ?? 0) : 0;
      met = runningVo2(speed, incline) / 3.5;
      basis = `Running at ${speed.toFixed(1)} km/h${incline ? ` on a ${incline}% incline` : ''}, ACSM running equation`;
      break;
    }
    case 'cycle_indoor':
      if (input.watts && input.watts > 0) {
        met = cyclingVo2(input.watts, weightKg) / 3.5;
        basis = `Cycling at ${input.watts} W, ACSM leg cycling equation`;
      } else {
        met = MET.cycle_indoor[effort] ?? 6.8;
        basis = `Stationary cycling, ${effort} effort (Compendium)`;
      }
      break;
    case 'cycle_outdoor': {
      const speed = input.speedKmh ?? (input.distanceKm ? input.distanceKm / (minutes / 60) : null);
      if (speed) {
        met = outdoorCyclingMet(speed);
        basis = `Cycling at ${speed.toFixed(1)} km/h (Compendium)`;
      } else {
        met = MET.cycle_outdoor[effort] ?? 6.8;
        basis = `Cycling outside, ${effort} effort (Compendium)`;
      }
      break;
    }
    case 'rowing_machine':
      if (input.watts && input.watts > 0) {
        met = rowingMetByWatts(input.watts);
        basis = `Rowing at ${input.watts} W (Compendium)`;
      } else {
        met = MET.rowing_machine[effort] ?? 5.0;
        basis = `Rowing machine, ${effort} effort (Compendium)`;
      }
      break;
    case 'stair_machine':
      met = MET.stair_machine.general!;
      basis = 'Stair climbing machine, general (Compendium)';
      break;
    default: {
      const table = MET[activity];
      met = table[effort] ?? table.moderate ?? 4.5;
      basis = `${kindOf(activity).label}, ${effort} effort (Compendium)`;
    }
  }
  return {
    kcal: Math.round(netKcal(met, weightKg, minutes)),
    met: Math.round(met * 10) / 10,
    basis,
  };
}

/** Step length as a share of height: about 0.414 (walking stride, Hatano 1993 and others). */
export const STRIDE_PER_HEIGHT = 0.414;
export const DEFAULT_STRIDE_M = 0.7;
/** Net walking cost: 0.1 ml O2 per kg per metre, 5 kcal per litre, is 0.5 kcal per kg per km. */
export const WALK_KCAL_PER_KG_KM = 0.5;

export const strideM = (heightCm: number | null | undefined) =>
  heightCm ? (heightCm * STRIDE_PER_HEIGHT) / 100 : DEFAULT_STRIDE_M;

export function estimateSteps(input: {
  steps: number;
  weightKg: number;
  heightCm?: number | null;
}): Burn | null {
  if (!(input.steps > 0) || !(input.weightKg > 0)) return null;
  const km = (input.steps * strideM(input.heightCm)) / 1000;
  return {
    kcal: Math.round(WALK_KCAL_PER_KG_KM * input.weightKg * km),
    met: 0,
    basis: `${input.steps.toLocaleString('en-GB')} steps of ${Math.round(strideM(input.heightCm) * 100)} cm is about ${km.toFixed(1)} km`,
  };
}

/** Strength training between the Compendium's two values: 3.5 (8 to 15 reps) and 6.0 (vigorous). */
export const STRENGTH_MET = { easy: 3.5, hard: 6.0 };

/** The share of working sets taken within 2 reps of failure (RIR 2 or less, RPE 8 or more). */
export function hardSetShare(sets: WorkoutSet[]): number | null {
  const worked = sets.filter(
    (s) => s.completedAt !== null && s.setType !== 'warmup' && (s.rir !== null || s.rpe !== null),
  );
  if (worked.length === 0) return null;
  const hard = worked.filter((s) => (s.rir !== null ? s.rir <= 2 : (s.rpe ?? 0) >= 8)).length;
  return hard / worked.length;
}

/** Minutes of training, pauses taken out. In progress counts up to `now`. */
export function workoutMinutes(w: Workout, now: Date = new Date()): number {
  const end = w.endedAt
    ? Date.parse(w.endedAt)
    : w.pausedAt
      ? Date.parse(w.pausedAt)
      : now.getTime();
  return Math.max(0, (end - Date.parse(w.startedAt) - w.pausedMs) / 60_000);
}

export function estimateWorkout(input: {
  minutes: number;
  weightKg: number;
  hardShare: number | null;
}): Burn | null {
  if (!(input.minutes > 0) || !(input.weightKg > 0)) return null;
  const share = input.hardShare ?? 0.5;
  const met = STRENGTH_MET.easy + (STRENGTH_MET.hard - STRENGTH_MET.easy) * share;
  return {
    kcal: Math.round(netKcal(met, input.weightKg, input.minutes)),
    met: Math.round(met * 10) / 10,
    basis:
      input.hardShare === null
        ? 'Weight training at a middle effort (Compendium)'
        : `Weight training, ${Math.round(share * 100)}% of sets near failure (Compendium)`,
  };
}

/** Body weight on a day: the latest weigh-in up to then, else the first one after. */
export function weightOn(entries: BodyWeightEntry[], date: string): number | null {
  const alive = entries.filter((e) => e.deletedAt === null);
  if (alive.length === 0) return null;
  const end = Date.parse(`${date}T23:59:59`);
  const sorted = [...alive].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const upTo = sorted.filter((e) => Date.parse(e.measuredAt) <= end);
  return (upTo.length ? upTo[upTo.length - 1]! : sorted[0]!).weightKg;
}

/** What a day's activity adds up to, with each source, for the end of day view. */
export interface DayBurn {
  workoutKcal: number;
  cardioKcal: number;
  stepsKcal: number;
  total: number;
  /** True when any part was estimated rather than typed. */
  estimated: boolean;
}

export function dayBurn(input: {
  logs: ActivityLog[];
  date: string;
  workoutKcal: number;
}): DayBurn {
  const day = input.logs.filter((l) => l.deletedAt === null && l.date === input.date);
  const sum = (kind: ActivityLog['kind']) =>
    day.filter((l) => l.kind === kind).reduce((t, l) => t + l.kcal, 0);
  const cardioKcal = sum('cardio');
  const stepsKcal = sum('steps');
  return {
    workoutKcal: input.workoutKcal,
    cardioKcal,
    stepsKcal,
    total: input.workoutKcal + cardioKcal + stepsKcal,
    estimated: input.workoutKcal > 0 || day.some((l) => l.kcalSource === 'estimated'),
  };
}

export const ESTIMATE_WARNING =
  'Calories burned are rough estimates and can be wrong. If you have a number from a fitness watch, tracker or app that you trust, enter that instead.';

export interface WorkoutBurn {
  kcal: number;
  source: 'typed' | 'estimated';
  basis: string;
}

/**
 * Active calories of a workout: the number the person typed from a watch or tracker, else the
 * estimate from the minutes, how hard the sets were and their body weight. Null when there is
 * nothing to go on (no weigh-in and nothing typed).
 */
export function workoutBurn(
  workout: Workout,
  sets: WorkoutSet[],
  bodyWeights: BodyWeightEntry[],
  now: Date = new Date(),
): WorkoutBurn | null {
  if (workout.kcalBurned != null)
    return { kcal: workout.kcalBurned, source: 'typed', basis: 'Typed by you' };
  const weightKg = weightOn(bodyWeights, workout.startedAt.slice(0, 10));
  if (!weightKg) return null;
  const burn = estimateWorkout({
    minutes: workoutMinutes(workout, now),
    weightKg,
    hardShare: hardSetShare(sets.filter((s) => s.workoutId === workout.id && s.deletedAt === null)),
  });
  return burn ? { kcal: burn.kcal, source: 'estimated', basis: burn.basis } : null;
}

/** Active calories from the weight sessions finished on a day, and whether any was an estimate. */
export function workoutKcalOn(
  data: { workouts: Workout[]; sets: WorkoutSet[]; bodyWeights: BodyWeightEntry[] },
  date: string,
): { kcal: number; sessions: number; estimated: boolean } {
  let kcal = 0;
  let sessions = 0;
  let estimated = false;
  for (const w of data.workouts) {
    if (
      w.deletedAt !== null ||
      w.status !== 'completed' ||
      toDateKey(new Date(w.startedAt)) !== date
    )
      continue;
    sessions += 1;
    const burn = workoutBurn(w, data.sets, data.bodyWeights);
    if (!burn) continue;
    kcal += burn.kcal;
    if (burn.source === 'estimated') estimated = true;
  }
  return { kcal, sessions, estimated };
}
