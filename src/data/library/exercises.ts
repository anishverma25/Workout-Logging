import { stableId } from '@/lib/ids';
import type {
  Equipment,
  Exercise,
  LoadMode,
  MuscleGroup,
  TrackingType,
} from '@/domain/models/schemas';

interface ExerciseSeed {
  key: string;
  name: string;
  primary: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: Equipment;
  category: 'compound' | 'isolation';
  tracking?: TrackingType;
  loadMode?: LoadMode;
}

/**
 * Starter library. The full, searchable library is Phase 2.
 * Keys are permanent: they derive each exercise's id, which must stay identical on every device.
 */
const SEEDS: ExerciseSeed[] = [
  // Chest
  {
    key: 'barbell-bench-press',
    name: 'Barbell bench press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
  },
  {
    key: 'incline-dumbbell-press',
    name: 'Incline dumbbell press',
    primary: 'chest',
    secondary: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
  },
  {
    key: 'cable-fly',
    name: 'Cable fly',
    primary: 'chest',
    equipment: 'cable',
    category: 'isolation',
  },
  {
    key: 'dips',
    name: 'Dips',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
  },
  // Back
  {
    key: 'pull-up',
    name: 'Pull-up',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
  },
  {
    key: 'barbell-row',
    name: 'Barbell row',
    primary: 'back',
    secondary: ['biceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
  },
  {
    key: 'lat-pulldown',
    name: 'Lat pulldown',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
  },
  {
    key: 'seated-cable-row',
    name: 'Seated cable row',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
  },
  {
    key: 'deadlift',
    name: 'Deadlift',
    primary: 'back',
    secondary: ['glutes', 'hamstrings', 'quads'],
    equipment: 'barbell',
    category: 'compound',
  },
  // Shoulders
  {
    key: 'overhead-press',
    name: 'Overhead press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'barbell',
    category: 'compound',
  },
  {
    key: 'cable-lateral-raise',
    name: 'Cable lateral raise',
    primary: 'shoulders',
    equipment: 'cable',
    category: 'isolation',
    loadMode: 'per_hand',
  },
  {
    key: 'face-pull',
    name: 'Face pull',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'cable',
    category: 'isolation',
  },
  // Arms
  {
    key: 'dumbbell-curl',
    name: 'Dumbbell curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
  },
  {
    key: 'hammer-curl',
    name: 'Hammer curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
  },
  {
    key: 'triceps-rope-pushdown',
    name: 'Triceps rope pushdown',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
  },
  {
    key: 'overhead-triceps-extension',
    name: 'Overhead triceps extension',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
  },
  // Legs
  {
    key: 'back-squat',
    name: 'Back squat',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings'],
    equipment: 'barbell',
    category: 'compound',
  },
  {
    key: 'romanian-deadlift',
    name: 'Romanian deadlift',
    primary: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: 'barbell',
    category: 'compound',
  },
  {
    key: 'leg-press',
    name: 'Leg press',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'machine',
    category: 'compound',
  },
  {
    key: 'bulgarian-split-squat',
    name: 'Bulgarian split squat',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
  },
  {
    key: 'lying-leg-curl',
    name: 'Lying leg curl',
    primary: 'hamstrings',
    equipment: 'machine',
    category: 'isolation',
  },
  {
    key: 'hip-thrust',
    name: 'Hip thrust',
    primary: 'glutes',
    secondary: ['hamstrings'],
    equipment: 'barbell',
    category: 'compound',
  },
  {
    key: 'standing-calf-raise',
    name: 'Standing calf raise',
    primary: 'calves',
    equipment: 'machine',
    category: 'isolation',
  },
  // Core
  {
    key: 'hanging-leg-raise',
    name: 'Hanging leg raise',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
  },
  {
    key: 'cable-crunch',
    name: 'Cable crunch',
    primary: 'abs',
    equipment: 'cable',
    category: 'isolation',
  },
  {
    key: 'plank',
    name: 'Plank',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'duration',
  },
];

/** Fixed timestamp so system records are identical on every device and every load. */
const LIBRARY_VERSION_TIME = '2026-01-01T00:00:00.000Z';

export const exerciseIdFor = (key: string) => stableId(`exercise:${key}`);

export const SYSTEM_EXERCISES: Exercise[] = SEEDS.map((s) => ({
  id: exerciseIdFor(s.key),
  createdAt: LIBRARY_VERSION_TIME,
  updatedAt: LIBRARY_VERSION_TIME,
  deletedAt: null,
  origin: 'system',
  name: s.name,
  primaryMuscle: s.primary,
  secondaryMuscles: s.secondary ?? [],
  equipment: s.equipment,
  category: s.category,
  trackingType: s.tracking ?? 'weight_reps',
  loadMode: s.loadMode ?? 'total',
  instructions: null,
  isCustom: false,
}));

export const SYSTEM_EXERCISE_KEYS = SEEDS.map((s) => s.key);
