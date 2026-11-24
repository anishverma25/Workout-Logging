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
  'tibialis',
  'neck',
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
  tibialis: 'Shins',
  neck: 'Neck',
};

/**
 * Where each muscle region of the targeting sheet sits on the drawing. Regions with no place on
 * it (serratus, the deep hip flexors) are left off rather than painted somewhere wrong.
 */
const REGION_AREA: Record<string, BodyArea> = {
  'Upper chest (clavicular pec)': 'chest',
  'Mid chest (sternal pec)': 'chest',
  'Lower chest (costal pec)': 'chest',
  'Front delts': 'deltoids',
  'Side delts': 'deltoids',
  'Rear delts': 'deltoids',
  Supraspinatus: 'deltoids',
  'Infraspinatus & teres minor': 'deltoids',
  Subscapularis: 'deltoids',
  Lats: 'upper-back',
  'Teres major': 'upper-back',
  'Mid traps & rhomboids': 'upper-back',
  'Lower traps': 'trapezius',
  'Upper traps': 'trapezius',
  'Levator scapulae': 'trapezius',
  'Spinal erectors': 'lower-back',
  'Biceps brachii': 'biceps',
  Brachialis: 'biceps',
  Brachioradialis: 'forearm',
  'Triceps long head': 'triceps',
  'Triceps lateral & medial heads': 'triceps',
  'Finger flexors (grip)': 'forearm',
  'Wrist flexors': 'forearm',
  'Wrist & finger extensors': 'forearm',
  'Pronators (teres & quadratus)': 'forearm',
  'Thumb adductors & intrinsic hand muscles': 'forearm',
  Supinator: 'forearm',
  'Rectus abdominis': 'abs',
  Obliques: 'obliques',
  'Transverse abdominis (deep core)': 'abs',
  'Quadratus lumborum': 'lower-back',
  'Glute max': 'gluteal',
  'Glute med & min': 'gluteal',
  'Tensor fasciae latae': 'gluteal',
  'Quads – vasti': 'quadriceps',
  'Rectus femoris': 'quadriceps',
  Hamstrings: 'hamstring',
  'Adductor magnus': 'adductors',
  'Adductors – longus, brevis, gracilis, pectineus': 'adductors',
  Gastrocnemius: 'calves',
  Soleus: 'calves',
  'Tibialis anterior': 'tibialis',
  'Toe extensors (EDL/EHL)': 'tibialis',
  'Peroneals (fibularis)': 'tibialis',
  Sternocleidomastoid: 'neck',
  'Deep neck flexors': 'neck',
  Scalenes: 'neck',
  'Neck extensors (splenius & semispinalis)': 'neck',
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

/** The body area a research region belongs to (Mid chest: chest), or null when not drawn. */
export const areaOfRegion = (region: string): BodyArea | null => REGION_AREA[region] ?? null;

/**
 * The role of one muscle in an exercise, by its share: primary is the top muscle or any at 30%
 * or more, secondary 10 to 29%, minor under 10% (assisters and stabilisers).
 */
export type ShareRole = 'primary' | 'secondary' | 'minor';
export function shareRole(index: number, share: number): ShareRole {
  if (index === 0 || share >= 30) return 'primary';
  return share >= 10 ? 'secondary' : 'minor';
}

const ROLE_LEVEL: Record<ShareRole, 1 | 2 | 3> = { primary: 3, secondary: 2, minor: 1 };

/** Shading for one exercise on the body: each area at its strongest role. */
export function exerciseLevels(regions: { region: string; share: number }[]) {
  const out = new Map<BodyArea, 1 | 2 | 3>();
  regions.forEach((r, i) => {
    const area = areaOfRegion(r.region);
    if (!area) return;
    const level = ROLE_LEVEL[shareRole(i, r.share)];
    if (level > (out.get(area) ?? 0)) out.set(area, level);
  });
  return out;
}

/** Areas seen from behind: an exercise led by one of them shows the back of the body first. */
const BACK_AREAS = new Set<BodyArea>([
  'upper-back',
  'lower-back',
  'trapezius',
  'gluteal',
  'hamstring',
  'triceps',
]);
export function leadsFromBehind(regions: { region: string }[]): boolean {
  const first = regions[0] ? areaOfRegion(regions[0].region) : null;
  return !!first && BACK_AREAS.has(first);
}

/** Shares per area for a muscle-group bar (Chest 65%, Triceps 20%...), biggest first. */
export function sharesByArea(regions: { region: string; share: number }[]) {
  const out = new Map<BodyArea, number>();
  for (const r of regions) {
    const area = areaOfRegion(r.region);
    if (area) out.set(area, (out.get(area) ?? 0) + r.share);
  }
  return [...out.entries()]
    .map(([area, share]) => ({ area, label: BODY_AREA_LABEL[area], share }))
    .sort((a, b) => b.share - a.share);
}
