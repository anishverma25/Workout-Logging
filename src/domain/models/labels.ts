import type {
  Equipment,
  Exercise,
  LoadMode,
  MuscleGroup,
  DailyActivity,
  GymAccess,
  Profile,
  Sex,
  SetType,
  TrackingType,
} from './schemas';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
  abs: 'Abs',
  cardio: 'Cardio',
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
  cardio: 'Time and distance',
};

export const TRACKING_HINTS: Record<TrackingType, string> = {
  weight_reps: 'Log load and reps. Counts toward volume load and estimated 1RM.',
  bodyweight_reps: 'Log reps only. Records track your most reps.',
  weighted_bodyweight: 'Log the added weight and reps.',
  assisted_bodyweight: 'Log the assistance weight and reps.',
  duration: 'Log how long you held or worked.',
  distance: 'Log the distance covered.',
  cardio: 'Log minutes and kilometres. Pace is worked out for you.',
};

export const LOAD_MODE_LABELS: Record<LoadMode, string> = {
  total: 'Total load',
  per_hand: 'One dumbbell or side (volume counts both)',
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

export const GOAL_LABEL: Record<Profile['goal'], string> = {
  hypertrophy: 'Hypertrophy',
  strength: 'Strength',
  strength_hypertrophy: 'Strength + Hypertrophy',
  fat_loss: 'Fat Loss',
  recomposition: 'Body Recomposition',
  general_fitness: 'General Fitness',
};

/** The line under each goal, explaining it. */
export const GOAL_DETAIL: Record<Profile['goal'], string> = {
  hypertrophy: 'Maximize muscle growth.',
  strength: 'Build maximal strength and lift heavier.',
  strength_hypertrophy: 'Build strength and muscle together.',
  fat_loss: 'Reduce body fat while preserving muscle.',
  recomposition: 'Lose fat while building muscle.',
  general_fitness: 'Improve strength, conditioning and fitness.',
};

export const EXPERIENCE_LABEL: Record<Profile['experience'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const SEX_LABEL: Record<Sex, string> = {
  male: 'Male',
  female: 'Female',
  unspecified: 'Prefer not to say',
};
export const EQUIPMENT_LABEL: Record<GymAccess, string> = {
  full_gym: 'Full gym',
  dumbbells: 'Dumbbells and a bench',
  home: 'Body weight at home',
};
export const ACTIVITY_LABEL: Record<DailyActivity, string> = {
  sitting: 'Mostly sitting',
  mixed: 'Some walking',
  on_feet: 'On my feet',
  physical: 'Physical work',
};

/** Session lengths offered on the wheel: 15 minutes to 3 hours, in 5 minute steps. */
export const SESSION_MINUTES = Array.from({ length: 34 }, (_, i) => 15 + i * 5);
export const DEFAULT_SESSION = 60;
