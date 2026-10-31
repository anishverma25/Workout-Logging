import type { Exercise, MuscleGroup, WorkoutSet } from '../models/schemas';

/** The areas the body drawing can shade, front and back. */
export const BODY_AREAS = [
  'chest',
  'deltoids',
  'trapezius',
  'upper-back',
  'lower-back',
  'biceps',
  'triceps',
  'forearm',
  'abs',
  'obliques',
  'quadriceps',
  'hamstring',
  'gluteal',
  'adductors',
  'calves',
] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

export const BODY_AREA_LABEL: Record<BodyArea, string> = {
  chest: 'Chest',
  deltoids: 'Shoulders',
  trapezius: 'Traps',
  'upper-back': 'Lats and upper back',
  'lower-back': 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearm: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  gluteal: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
};

/**
 * Where each region of the research-based muscle shares sits on the drawing. Regions with no
 * place on it (hip flexors, serratus) are left off rather than painted somewhere wrong.
 */
const REGION_AREA: Record<string, BodyArea> = {
  'Upper chest': 'chest',
  'Mid chest': 'chest',
  'Lower chest': 'chest',
  'Front delts': 'deltoids',
  'Side delts': 'deltoids',
  'Rear delts': 'deltoids',
  'Upper back and traps': 'trapezius',
  'Upper traps': 'trapezius',
  'Mid back': 'upper-back',
  Lats: 'upper-back',
  'Lower back': 'lower-back',
  Triceps: 'triceps',
  'Triceps long head': 'triceps',
  'Triceps lateral and medial heads': 'triceps',
  Biceps: 'biceps',
  Brachialis: 'biceps',
  'Forearms (brachioradialis)': 'forearm',
  Grip: 'forearm',
  Quads: 'quadriceps',
  'Vasti (outer and inner quads)': 'quadriceps',
  'Rectus femoris': 'quadriceps',
  Hamstrings: 'hamstring',
  Glutes: 'gluteal',
  'Glute maximus': 'gluteal',
  'Glute medius and minimus': 'gluteal',
  Adductors: 'adductors',
  Calves: 'calves',
  Soleus: 'calves',
  Gastrocnemius: 'calves',
  'Upper abs': 'abs',
  'Lower abs': 'abs',
  Core: 'abs',
  'Deep core': 'abs',
  Obliques: 'obliques',
};

/** For exercises without research shares (the person's own): their muscle groups. */
const GROUP_AREA: Record<MuscleGroup, BodyArea | null> = {
  chest: 'chest',
  back: 'upper-back',
  shoulders: 'deltoids',
  biceps: 'biceps',
  triceps: 'triceps',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  adductors: 'adductors',
  calves: 'calves',
  abs: 'abs',
  cardio: null,
};

/** A secondary muscle counts half a set, the usual convention for sets per muscle. */
export const SECONDARY_SHARE = 0.5;

export interface ExerciseLog {
  exerciseId: string;
  exercise: Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles' | 'trackingType'> | undefined;
  sets: Pick<WorkoutSet, 'completedAt' | 'setType' | 'deletedAt'>[];
}

type SharesLookup = (exerciseId: string) => { regions: { region: string; share: number }[] } | null;

/**
 * Sets per body area in a workout: each done set (warm-ups left out) is spread over the muscles
 * by the exercise's research-based shares (a bench set is mostly chest, some front delts and
 * triceps), else one set to the main muscle and half to each other one.
 */
export function setsPerArea(logs: ExerciseLog[], sharesFor: SharesLookup): Map<BodyArea, number> {
  const out = new Map<BodyArea, number>();
  const add = (area: BodyArea | null | undefined, v: number) => {
    if (!area || !(v > 0)) return;
    out.set(area, (out.get(area) ?? 0) + v);
  };
  for (const log of logs) {
    if (!log.exercise || log.exercise.trackingType === 'cardio') continue;
    const done = log.sets.filter(
      (s) => s.completedAt !== null && s.deletedAt === null && s.setType !== 'warmup',
    ).length;
    if (done === 0) continue;
    const shares = sharesFor(log.exerciseId);
    if (shares) {
      for (const r of shares.regions) add(REGION_AREA[r.region], (done * r.share) / 100);
    } else {
      add(GROUP_AREA[log.exercise.primaryMuscle], done);
      for (const m of log.exercise.secondaryMuscles)
        if (m !== log.exercise.primaryMuscle) add(GROUP_AREA[m], done * SECONDARY_SHARE);
    }
  }
  return out;
}

/** Below this many sets an area is not shaded: a sliver of a share is not "trained". */
export const MIN_SHADED_SETS = 0.5;

/**
 * How strongly each area is shaded, 1 to 3, against the most trained area of the workout:
 * the top third is full colour. Areas under half a set stay unshaded.
 */
export function shadeLevels(sets: Map<BodyArea, number>): Map<BodyArea, 1 | 2 | 3> {
  const top = Math.max(0, ...sets.values());
  const out = new Map<BodyArea, 1 | 2 | 3>();
  if (top <= 0) return out;
  for (const [area, v] of sets) {
    if (v < MIN_SHADED_SETS) continue;
    const r = v / top;
    out.set(area, r >= 2 / 3 ? 3 : r >= 1 / 3 ? 2 : 1);
  }
  return out;
}

/** Areas worked, most sets first, with sets rounded to the half for reading. */
export function areasWorked(sets: Map<BodyArea, number>): { area: BodyArea; sets: number }[] {
  return [...sets]
    .filter(([, v]) => v >= MIN_SHADED_SETS)
    .sort((a, b) => b[1] - a[1])
    .map(([area, v]) => ({ area, sets: Math.round(v * 2) / 2 }));
}
