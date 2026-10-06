import type { Experience, Goal, GymAccess, Profile } from '@/domain/models/schemas';
import { SYSTEM_EXERCISES, SYSTEM_EXERCISE_KEYS } from './exercises';
import {
  ROUTINE_TEMPLATES,
  type RoutineTemplate,
  type TemplateDay,
  type TemplateExercise,
} from './templates';

/**
 * Turns a template into a plan for one person: their goal sets reps and rest, their experience
 * sets the number of sets, their equipment swaps exercises, and their session length trims the
 * day. Every rule is written out below and in the methodology page; the result is a normal,
 * fully editable routine.
 */

const meta = new Map(SYSTEM_EXERCISE_KEYS.map((key, i) => [key, SYSTEM_EXERCISES[i]!] as const));

export interface PlanOptions {
  goal: Goal;
  experience: Experience;
  equipment: GymAccess | null;
  sessionMinutes: number | null;
}

// ---------------------------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------------------------

/**
 * Replacements in order of preference. "Dumbbells" means dumbbells, a bench and your body
 * weight. "Home" means body weight only (a pull-up bar if you have one); dumbbell moves listed
 * for home work without weight too.
 */
const SWAPS: Record<string, { dumbbells: string[]; home: string[] }> = {
  'barbell-bench-press': { dumbbells: ['dumbbell-bench-press'], home: ['push-up'] },
  'incline-barbell-bench-press': {
    dumbbells: ['incline-dumbbell-press', 'dumbbell-bench-press'],
    home: ['push-up', 'dips'],
  },
  'incline-dumbbell-press': { dumbbells: ['incline-dumbbell-press'], home: ['push-up', 'dips'] },
  'dumbbell-bench-press': { dumbbells: ['dumbbell-bench-press'], home: ['push-up', 'dips'] },
  'machine-chest-press': {
    dumbbells: ['dumbbell-bench-press', 'incline-dumbbell-press'],
    home: ['push-up', 'dips'],
  },
  'smith-machine-bench-press': { dumbbells: ['dumbbell-bench-press'], home: ['push-up'] },
  'cable-fly': { dumbbells: ['dumbbell-fly'], home: ['push-up', 'dips'] },
  'pec-deck': { dumbbells: ['dumbbell-fly'], home: ['push-up', 'dips'] },
  'close-grip-bench-press': { dumbbells: ['dumbbell-overhead-extension'], home: ['bench-dip'] },
  'lat-pulldown': { dumbbells: ['pull-up', 'one-arm-dumbbell-row'], home: ['pull-up', 'chin-up'] },
  'close-grip-lat-pulldown': {
    dumbbells: ['chin-up', 'one-arm-dumbbell-row'],
    home: ['chin-up', 'pull-up'],
  },
  'barbell-row': {
    dumbbells: ['one-arm-dumbbell-row', 'chest-supported-row'],
    home: ['chin-up', 'pull-up'],
  },
  'pendlay-row': { dumbbells: ['one-arm-dumbbell-row'], home: ['chin-up'] },
  't-bar-row': { dumbbells: ['chest-supported-row', 'one-arm-dumbbell-row'], home: ['chin-up'] },
  'seated-cable-row': {
    dumbbells: ['chest-supported-row', 'one-arm-dumbbell-row'],
    home: ['chin-up', 'pull-up', 'back-extension'],
  },
  'machine-row': { dumbbells: ['chest-supported-row'], home: ['chin-up', 'back-extension'] },
  'chest-supported-row': {
    dumbbells: ['chest-supported-row'],
    home: ['chin-up', 'back-extension'],
  },
  'one-arm-dumbbell-row': {
    dumbbells: ['one-arm-dumbbell-row'],
    home: ['chin-up', 'back-extension'],
  },
  'straight-arm-pulldown': { dumbbells: ['pull-up'], home: ['pull-up'] },
  'face-pull': { dumbbells: ['rear-delt-fly'], home: ['band-pull-apart', 'back-extension'] },
  'reverse-pec-deck': { dumbbells: ['rear-delt-fly'], home: ['band-pull-apart'] },
  'barbell-shrug': { dumbbells: ['farmers-carry'], home: [] },
  deadlift: { dumbbells: ['dumbbell-romanian-deadlift'], home: ['glute-bridge'] },
  'overhead-press': {
    dumbbells: ['seated-dumbbell-press', 'arnold-press'],
    home: ['pike-push-up'],
  },
  'machine-shoulder-press': {
    dumbbells: ['seated-dumbbell-press', 'arnold-press'],
    home: ['pike-push-up'],
  },
  'cable-lateral-raise': { dumbbells: ['dumbbell-lateral-raise'], home: ['band-pull-apart'] },
  'machine-lateral-raise': { dumbbells: ['dumbbell-lateral-raise'], home: ['band-pull-apart'] },
  'upright-row': { dumbbells: ['dumbbell-lateral-raise'], home: ['pike-push-up'] },
  'barbell-curl': { dumbbells: ['dumbbell-curl', 'hammer-curl'], home: ['chin-up'] },
  'ez-bar-curl': { dumbbells: ['dumbbell-curl', 'hammer-curl'], home: ['chin-up'] },
  'cable-curl': { dumbbells: ['dumbbell-curl', 'hammer-curl'], home: ['chin-up'] },
  'preacher-curl': { dumbbells: ['incline-dumbbell-curl', 'dumbbell-curl'], home: ['chin-up'] },
  'triceps-rope-pushdown': { dumbbells: ['dumbbell-overhead-extension'], home: ['bench-dip'] },
  'triceps-bar-pushdown': { dumbbells: ['dumbbell-overhead-extension'], home: ['bench-dip'] },
  'overhead-triceps-extension': {
    dumbbells: ['dumbbell-overhead-extension'],
    home: ['bench-dip'],
  },
  'skull-crusher': { dumbbells: ['dumbbell-overhead-extension'], home: ['bench-dip'] },
  'back-squat': { dumbbells: ['goblet-squat'], home: ['bulgarian-split-squat'] },
  'front-squat': { dumbbells: ['goblet-squat'], home: ['bulgarian-split-squat'] },
  'hack-squat': {
    dumbbells: ['goblet-squat', 'bulgarian-split-squat'],
    home: ['bulgarian-split-squat', 'walking-lunge'],
  },
  'leg-press': {
    dumbbells: ['bulgarian-split-squat', 'walking-lunge'],
    home: ['walking-lunge', 'step-up'],
  },
  'leg-extension': { dumbbells: ['step-up'], home: ['step-up'] },
  'romanian-deadlift': { dumbbells: ['dumbbell-romanian-deadlift'], home: ['nordic-curl'] },
  'stiff-leg-deadlift': { dumbbells: ['dumbbell-romanian-deadlift'], home: ['nordic-curl'] },
  'good-morning': { dumbbells: ['dumbbell-romanian-deadlift'], home: ['nordic-curl'] },
  'lying-leg-curl': {
    dumbbells: ['nordic-curl', 'dumbbell-romanian-deadlift'],
    home: ['nordic-curl', 'glute-bridge'],
  },
  'seated-leg-curl': {
    dumbbells: ['nordic-curl', 'dumbbell-romanian-deadlift'],
    home: ['nordic-curl', 'glute-bridge'],
  },
  'hip-thrust': { dumbbells: ['glute-bridge'], home: ['glute-bridge'] },
  'machine-hip-thrust': { dumbbells: ['glute-bridge'], home: ['glute-bridge'] },
  'cable-kickback': { dumbbells: ['glute-bridge'], home: ['glute-bridge'] },
  'hip-abduction': { dumbbells: ['glute-bridge'], home: ['glute-bridge'] },
  'standing-calf-raise': { dumbbells: ['single-leg-calf-raise'], home: ['single-leg-calf-raise'] },
  'seated-calf-raise': { dumbbells: ['single-leg-calf-raise'], home: ['single-leg-calf-raise'] },
  'leg-press-calf-raise': {
    dumbbells: ['single-leg-calf-raise'],
    home: ['single-leg-calf-raise'],
  },
  'cable-crunch': { dumbbells: ['crunch'], home: ['crunch'] },
  'dumbbell-lateral-raise': { dumbbells: ['dumbbell-lateral-raise'], home: ['band-pull-apart'] },
  'rear-delt-fly': { dumbbells: ['rear-delt-fly'], home: ['band-pull-apart', 'back-extension'] },
  'seated-dumbbell-press': { dumbbells: ['seated-dumbbell-press'], home: ['pike-push-up'] },
  'arnold-press': { dumbbells: ['arnold-press'], home: ['pike-push-up'] },
  'front-raise': { dumbbells: ['front-raise'], home: ['pike-push-up'] },
  'dumbbell-curl': { dumbbells: ['dumbbell-curl'], home: ['chin-up'] },
  'hammer-curl': { dumbbells: ['hammer-curl'], home: ['chin-up'] },
  'incline-dumbbell-curl': { dumbbells: ['incline-dumbbell-curl'], home: ['chin-up'] },
  'dumbbell-overhead-extension': {
    dumbbells: ['dumbbell-overhead-extension'],
    home: ['bench-dip'],
  },
  'goblet-squat': { dumbbells: ['goblet-squat'], home: ['bulgarian-split-squat', 'walking-lunge'] },
  'dumbbell-romanian-deadlift': {
    dumbbells: ['dumbbell-romanian-deadlift'],
    home: ['nordic-curl', 'glute-bridge'],
  },
  'pallof-press': { dumbbells: ['plank'], home: ['side-plank'] },
};

const ALLOWED: Record<Exclude<GymAccess, 'full_gym'>, Set<string>> = {
  dumbbells: new Set(['dumbbell', 'bodyweight', 'kettlebell', 'band', 'other']),
  home: new Set(['bodyweight', 'band', 'other']),
};
/** Dumbbell moves that work unloaded, so they count as home exercises. */
const HOME_UNLOADED = new Set(['bulgarian-split-squat', 'walking-lunge', 'step-up']);

function fitsEquipment(key: string, access: GymAccess): boolean {
  if (access === 'full_gym') return true;
  const e = meta.get(key);
  if (!e) return false;
  if (access === 'home' && HOME_UNLOADED.has(key)) return true;
  return ALLOWED[access].has(e.equipment);
}

/** The exercise to use for `key` with this equipment, avoiding ones already in the day. */
export function swapFor(key: string, access: GymAccess, used: Set<string>): string | null {
  if (fitsEquipment(key, access) && !used.has(key)) return key;
  if (access === 'full_gym') return null;
  const listed = SWAPS[key]?.[access] ?? [];
  for (const candidate of listed) {
    if (fitsEquipment(candidate, access) && !used.has(candidate)) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Goal: reps, effort and rest
// ---------------------------------------------------------------------------------------------

interface Scheme {
  /** The first compound lift of the day. */
  main: [number, number, number | null, number];
  compound: [number, number, number | null, number];
  isolation: [number, number, number | null, number];
}

/** [lowest reps, highest reps, target RIR, rest seconds] for each kind of exercise. */
export const GOAL_SCHEMES: Record<Goal, Scheme> = {
  strength: { main: [3, 5, 2, 210], compound: [5, 8, 2, 150], isolation: [8, 12, 1, 90] },
  strength_hypertrophy: {
    main: [5, 8, 2, 180],
    compound: [6, 10, 2, 150],
    isolation: [10, 15, 1, 90],
  },
  hypertrophy: { main: [6, 10, 2, 150], compound: [8, 12, 1, 120], isolation: [10, 15, 1, 75] },
  // Heavy enough to keep muscle while eating less; shorter rests keep sessions brisk.
  fat_loss: { main: [5, 8, 2, 150], compound: [8, 12, 2, 105], isolation: [12, 15, 1, 60] },
  recomposition: {
    main: [5, 8, 2, 150],
    compound: [8, 12, 2, 120],
    isolation: [10, 15, 1, 75],
  },
  general_fitness: {
    main: [6, 10, 2, 120],
    compound: [8, 12, 2, 90],
    isolation: [12, 15, 2, 60],
  },
};

const isLoaded = (key: string) => meta.get(key)?.trackingType === 'weight_reps';

function applyScheme(e: TemplateExercise, kind: keyof Scheme, scheme: Scheme): TemplateExercise {
  const tracking = meta.get(e.key)?.trackingType;
  // Timed, distance and cardio targets are in seconds, metres or minutes: leave them.
  if (tracking === 'duration' || tracking === 'distance' || tracking === 'cardio') return e;
  const [repMin, repMax, rir, rest] = scheme[kind];
  // Bodyweight moves keep higher reps: there is no load to make them harder.
  if (!isLoaded(e.key) && tracking === 'bodyweight_reps')
    return { ...e, repMin: Math.max(repMin, 6), repMax: Math.max(repMax, 12), rir, rest };
  return { ...e, repMin, repMax, rir, rest };
}

// ---------------------------------------------------------------------------------------------
// Experience: sets per exercise
// ---------------------------------------------------------------------------------------------

/**
 * Beginners grow on less work, so isolation work starts at 2 sets and nothing goes above 3.
 * Advanced lifters need more to keep progressing: the first two lifts get one more set.
 */
function setsFor(e: TemplateExercise, index: number, experience: Experience, kind: keyof Scheme) {
  if (experience === 'beginner') return kind === 'isolation' ? 2 : Math.min(3, e.sets);
  if (experience === 'advanced' && index < 2) return Math.min(e.sets + 1, 5);
  return e.sets;
}

// ---------------------------------------------------------------------------------------------
// Session length
// ---------------------------------------------------------------------------------------------

/** About 45 seconds per set of work plus the rest after it, and 2 minutes to set up. */
export function estimateMinutes(exercises: TemplateExercise[]): number {
  const seconds = exercises.reduce((sum, e) => {
    const tracking = meta.get(e.key)?.trackingType;
    if (tracking === 'cardio') return sum + e.repMax * 60 + 120;
    return sum + e.sets * (45 + e.rest) + 120;
  }, 0);
  return Math.round(seconds / 60);
}

/** Drops exercises from the end of the day (isolation work first) until it fits. Keeps at least 3. */
function trimToTime(exercises: TemplateExercise[], minutes: number): TemplateExercise[] {
  const out = [...exercises];
  const limit = minutes * 1.1;
  while (out.length > 3 && estimateMinutes(out) > limit) {
    let drop = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (meta.get(out[i]!.key)?.category === 'isolation') {
        drop = i;
        break;
      }
    }
    out.splice(drop === -1 ? out.length - 1 : drop, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

export function personalizeDay(day: TemplateDay, options: PlanOptions): TemplateDay {
  const scheme = GOAL_SCHEMES[options.goal];
  const access = options.equipment ?? 'full_gym';
  const used = new Set<string>();
  let mainDone = false;
  const exercises: TemplateExercise[] = [];
  for (const original of day.exercises) {
    const key = swapFor(original.key, access, used);
    if (!key) continue;
    used.add(key);
    const category = meta.get(key)?.category ?? 'isolation';
    const kind: keyof Scheme =
      category === 'isolation' ? 'isolation' : !mainDone && isLoaded(key) ? 'main' : 'compound';
    if (kind === 'main') mainDone = true;
    const e = applyScheme({ ...original, key }, kind, scheme);
    exercises.push({ ...e, sets: setsFor(e, exercises.length, options.experience, kind) });
  }
  return {
    ...day,
    exercises: options.sessionMinutes ? trimToTime(exercises, options.sessionMinutes) : exercises,
  };
}

export function personalizeTemplate(
  template: RoutineTemplate,
  options: PlanOptions,
): RoutineTemplate {
  if (template.key === 'custom') return template;
  return { ...template, days: template.days.map((d) => personalizeDay(d, options)) };
}

// ---------------------------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------------------------

export interface Recommendation {
  template: RoutineTemplate;
  /** One sentence on why, in plain words. */
  reason: string;
  /** Other good fits for the same number of days. */
  alternatives: RoutineTemplate[];
}

const byKey = (key: string) => ROUTINE_TEMPLATES.find((t) => t.key === key)!;

/**
 * Picks a split from the days a week the person can train and their experience. Every muscle
 * is trained at least twice a week where the days allow it, which research favours for growth.
 */
export function recommendProgram(
  profile: Pick<Profile, 'experience' | 'goal' | 'trainingDays'>,
): Recommendation | null {
  const days = profile.trainingDays ?? null;
  if (days === null) return null;
  const beginner = profile.experience === 'beginner';
  if (days <= 2)
    return {
      template: byKey('full-body'),
      reason:
        'With two days, full-body sessions train every muscle each time. Do any two of the three workouts.',
      alternatives: [],
    };
  if (days === 3)
    return beginner
      ? {
          template: byKey('beginner-full-body'),
          reason:
            'Three full-body days built on the main lifts: the fastest way to get stronger in your first year.',
          alternatives: [byKey('full-body'), byKey('ppl-3')],
        }
      : {
          template: byKey('full-body'),
          reason: 'Three full-body days hit every muscle three times a week.',
          alternatives: [byKey('ppl-3'), byKey('beginner-full-body')],
        };
  if (days === 4)
    return {
      template: byKey('upper-lower'),
      reason: 'Four days of upper and lower body trains every muscle twice a week.',
      alternatives: [byKey('four-day')],
    };
  if (days === 5)
    return {
      template: byKey('pplul'),
      reason:
        'Push, pull and legs, then upper and lower: five days with every muscle trained twice a week.',
      alternatives: [byKey('ulppl'), byKey('five-day')],
    };
  return {
    template: byKey('ppl'),
    reason:
      days === 7
        ? 'Push, pull and legs twice a week. Keep one day off: muscles grow while you rest.'
        : 'Push, pull and legs twice a week: high volume for every muscle.',
    alternatives: [byKey('six-day'), byKey('pplul')],
  };
}
