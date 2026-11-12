/**
 * The two things a person tells the plan about their life: what is coming up, and what hurts.
 * Both are inputs to the weekly decision, not planners of their own.
 */

export const EVENT_KINDS = [
  'exams',
  'travel',
  'wedding',
  'festival',
  'vrat',
  'ramadan',
  'sick',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface LifeEvent {
  id: string;
  kind: EventKind;
  /** First and last day, yyyy-mm-dd. */
  start: string;
  end: string;
}

export interface EventEffect {
  /** Eat at maintenance while it lasts: never a deficit through a fast, an illness or a feast. */
  maintenance: boolean;
  /** Sessions kept to this many minutes, or null to leave them. */
  sessionMinutes: number | null;
  /** No hard training: nothing is added and effort stays easy. */
  easy: boolean;
}

export const EVENT_EFFECTS: Record<EventKind, EventEffect> = {
  exams: { maintenance: true, sessionMinutes: 40, easy: false },
  travel: { maintenance: true, sessionMinutes: 40, easy: false },
  wedding: { maintenance: true, sessionMinutes: null, easy: false },
  festival: { maintenance: true, sessionMinutes: null, easy: false },
  vrat: { maintenance: true, sessionMinutes: null, easy: true },
  ramadan: { maintenance: true, sessionMinutes: null, easy: true },
  sick: { maintenance: true, sessionMinutes: null, easy: true },
};

export const EVENT_LABEL: Record<EventKind, { en: string; hi: string }> = {
  exams: { en: 'Exams', hi: 'Exams' },
  travel: { en: 'Travel', hi: 'Travel' },
  wedding: { en: 'Wedding', hi: 'Shaadi' },
  festival: { en: 'Festival', hi: 'Festival' },
  vrat: { en: 'Vrat or fast', hi: 'Vrat' },
  ramadan: { en: 'Ramadan', hi: 'Ramzan' },
  sick: { en: 'Unwell', hi: 'Tabiyat kharab' },
};

const dayNumber = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
export const addDaysKey = (key: string, days: number) =>
  new Date((dayNumber(key) + days) * 86_400_000).toISOString().slice(0, 10);

/** How many days of the week starting on `weekStart` the event covers. */
export function daysInWeek(event: Pick<LifeEvent, 'start' | 'end'>, weekStart: string): number {
  const from = Math.max(dayNumber(event.start), dayNumber(weekStart));
  const to = Math.min(dayNumber(event.end), dayNumber(weekStart) + 6);
  return Math.max(0, to - from + 1);
}

/** The Monday after the event ends: when anything changed for it goes back. */
export function weekAfter(event: Pick<LifeEvent, 'end'>): string {
  const end = dayNumber(event.end);
  // 1970-01-01 was a Thursday: day 4 is a Monday.
  const sinceMonday = (((end - 4) % 7) + 7) % 7;
  return new Date((end - sinceMonday + 7) * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------------------------
// Something hurts
// ---------------------------------------------------------------------------------------------

export const PAIN_AREAS = [
  'shoulder',
  'elbow',
  'wrist',
  'lower_back',
  'knee',
  'hip',
  'ankle',
  'neck',
] as const;
export type PainArea = (typeof PAIN_AREAS)[number];
export type PainSeverity = 'mild' | 'moderate' | 'severe';

/** Signs that mean stop and see someone, whatever the severity picked. */
export const RED_FLAGS = ['sharp', 'numb', 'swelling', 'lasting'] as const;
export type RedFlag = (typeof RED_FLAGS)[number];

export interface PainReport {
  id: string;
  area: PainArea;
  severity: PainSeverity;
  redFlags: RedFlag[];
  /** yyyy-mm-dd it was reported. */
  date: string;
  /** The exercise it came up on, when it was reported from the logger. */
  exerciseId: string | null;
}

export const PAIN_LABEL: Record<PainArea, { en: string; hi: string }> = {
  shoulder: { en: 'Shoulder', hi: 'Shoulder' },
  elbow: { en: 'Elbow', hi: 'Elbow' },
  wrist: { en: 'Wrist', hi: 'Wrist' },
  lower_back: { en: 'Lower back', hi: 'Lower back' },
  knee: { en: 'Knee', hi: 'Knee' },
  hip: { en: 'Hip', hi: 'Hip' },
  ankle: { en: 'Ankle', hi: 'Ankle' },
  neck: { en: 'Neck', hi: 'Neck' },
};

/** The muscles whose training loads each area most; their sets are trimmed while it settles. */
export const AREA_MUSCLES: Record<PainArea, string[]> = {
  shoulder: ['shoulders', 'chest'],
  elbow: ['triceps', 'biceps'],
  wrist: ['biceps', 'triceps'],
  lower_back: ['hamstrings', 'back'],
  knee: ['quads'],
  hip: ['glutes', 'adductors'],
  ankle: ['calves'],
  neck: ['shoulders'],
};

/**
 * For each area, the library lifts that load it hardest and a variation that usually loads it
 * less (a supported position, a neutral grip, a machine path). Training guidance from common
 * coaching practice, not medical advice and not a claim that the swap treats anything.
 */
export const GENTLER: Record<PainArea, Record<string, string>> = {
  shoulder: {
    'overhead-press': 'machine-shoulder-press',
    'behind-the-neck-press': 'seated-dumbbell-press',
    'arnold-press': 'machine-shoulder-press',
    'barbell-bench-press': 'machine-chest-press',
    'incline-barbell-bench-press': 'incline-dumbbell-press',
    'smith-machine-bench-press': 'machine-chest-press',
    dips: 'triceps-rope-pushdown',
    'weighted-dips': 'triceps-rope-pushdown',
    'bench-dip': 'triceps-rope-pushdown',
    'upright-row': 'cable-lateral-raise',
    'dumbbell-fly': 'pec-deck',
    'pike-push-up': 'machine-shoulder-press',
  },
  elbow: {
    'skull-crusher': 'triceps-rope-pushdown',
    'overhead-triceps-extension': 'triceps-rope-pushdown',
    'dumbbell-overhead-extension': 'triceps-rope-pushdown',
    'close-grip-bench-press': 'triceps-rope-pushdown',
    dips: 'triceps-rope-pushdown',
    'weighted-dips': 'triceps-rope-pushdown',
    'barbell-curl': 'hammer-curl',
    'preacher-curl': 'hammer-curl',
    'chin-up': 'lat-pulldown',
    'weighted-pull-up': 'lat-pulldown',
  },
  wrist: {
    'barbell-curl': 'hammer-curl',
    'ez-bar-curl': 'hammer-curl',
    'barbell-bench-press': 'dumbbell-bench-press',
    'push-up': 'machine-chest-press',
    'front-squat': 'hack-squat',
    'skull-crusher': 'triceps-rope-pushdown',
    'overhead-press': 'machine-shoulder-press',
  },
  lower_back: {
    deadlift: 'hip-thrust',
    'sumo-deadlift': 'hip-thrust',
    'barbell-row': 'chest-supported-row',
    'pendlay-row': 'chest-supported-row',
    't-bar-row': 'chest-supported-row',
    'back-squat': 'leg-press',
    'front-squat': 'leg-press',
    'good-morning': 'seated-leg-curl',
    'romanian-deadlift': 'seated-leg-curl',
    'stiff-leg-deadlift': 'lying-leg-curl',
    'dumbbell-romanian-deadlift': 'seated-leg-curl',
    'dumbbell-stiff-leg-deadlift': 'lying-leg-curl',
    'kettlebell-swing': 'hip-thrust',
    'back-extension': 'glute-bridge',
    'overhead-press': 'machine-shoulder-press',
  },
  knee: {
    'back-squat': 'box-squat',
    'front-squat': 'box-squat',
    'hack-squat': 'leg-press',
    'walking-lunge': 'step-up',
    'bulgarian-split-squat': 'leg-press',
    'leg-extension': 'leg-press',
    'single-leg-extension': 'leg-press',
    'goblet-squat': 'box-squat',
  },
  hip: {
    'back-squat': 'leg-press',
    'sumo-deadlift': 'romanian-deadlift',
    'walking-lunge': 'leg-extension',
    'bulgarian-split-squat': 'leg-extension',
    'hip-abduction': 'glute-bridge',
    'hip-adduction': 'glute-bridge',
  },
  ankle: {
    'standing-calf-raise': 'seated-calf-raise',
    'single-leg-calf-raise': 'seated-calf-raise',
    'back-squat': 'leg-press',
    'walking-lunge': 'leg-extension',
    'jump-rope': 'stationary-bike',
  },
  neck: {
    'barbell-shrug': 'face-pull',
    'kelso-shrug': 'face-pull',
    'upright-row': 'cable-lateral-raise',
    'behind-the-neck-press': 'machine-shoulder-press',
    'overhead-press': 'machine-shoulder-press',
  },
};

/** Weeks the plan stays gentle before going back, by how bad it was. */
export const RETURN_WEEKS: Record<Exclude<PainSeverity, 'severe'>, number> = {
  mild: 2,
  moderate: 3,
};

/** A report the plan must not train around: stop and see a professional. */
export const needsProfessional = (r: Pick<PainReport, 'severity' | 'redFlags'>) =>
  r.severity === 'severe' || r.redFlags.length > 0;
