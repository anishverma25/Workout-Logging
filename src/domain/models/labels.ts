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

export const GOAL_LABEL: Record<Profile['goal'], string> = {
  hypertrophy: 'Build muscle',
  strength: 'Get stronger',
  strength_hypertrophy: 'Stronger and bigger',
  fat_loss: 'Lose fat',
  recomposition: 'Lose fat, keep building',
  general_fitness: 'General fitness',
};

export const GOAL_DETAIL: Record<Profile['goal'], string> = {
  hypertrophy: 'More muscle. Moderate weights for 6 to 12 reps, plenty of sets.',
  strength: 'Lift heavier. Fewer reps with heavy weights and long rests.',
  strength_hypertrophy: 'Heavy compound lifts first, then muscle-building work.',
  fat_loss: 'Drop body fat while keeping the muscle you have.',
  recomposition: 'Slowly lose fat and gain muscle at the same time.',
  general_fitness: 'Feel fitter and stronger without a specific target.',
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
