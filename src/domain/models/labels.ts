import type { Equipment, Exercise, LoadMode, MuscleGroup, SetType, TrackingType } from './schemas';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
};

export const CATEGORY_LABELS = {
  compound: 'Compound',
  isolation: 'Isolation',
} as const;

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Weight and reps',
  bodyweight_reps: 'Bodyweight reps',
  weighted_bodyweight: 'Bodyweight plus added weight',
  assisted_bodyweight: 'Assisted bodyweight',
  duration: 'Time',
  distance: 'Distance',
};

export const TRACKING_HINTS: Record<TrackingType, string> = {
  weight_reps: 'Log load and reps. Counts toward volume load and estimated 1RM.',
  bodyweight_reps: 'Log reps only. Records track your most reps.',
  weighted_bodyweight: 'Log the added weight and reps.',
  assisted_bodyweight: 'Log the assistance weight and reps.',
  duration: 'Log how long you held or worked.',
  distance: 'Log the distance covered.',
};

export const LOAD_MODE_LABELS: Record<LoadMode, string> = {
  total: 'Total load',
  per_hand: 'Per dumbbell or side',
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Warm-up',
  working: 'Working',
  backoff: 'Back-off',
  drop: 'Drop set',
};

/** One-letter markers shown in the set column. */
export const SET_TYPE_SHORT: Record<SetType, string> = {
  warmup: 'W',
  working: '',
  backoff: 'B',
  drop: 'D',
};

/** "Chest · Barbell" */
export function exerciseMeta(exercise: Pick<Exercise, 'primaryMuscle' | 'equipment'>): string {
  return `${MUSCLE_LABELS[exercise.primaryMuscle]} · ${EQUIPMENT_LABELS[exercise.equipment]}`;
}
