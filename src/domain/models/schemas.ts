import { z } from 'zod';

/**
 * Every persisted record carries:
 * - a client-generated UUID (stable across devices, safe for idempotent sync)
 * - created/updated/deleted timestamps (soft delete, sync friendly)
 * - an origin, so demo data can be removed without touching real data
 */
export const RecordOrigin = z.enum(['system', 'demo', 'user']);
export type RecordOrigin = z.infer<typeof RecordOrigin>;

const isoDateTime = z.string().datetime({ offset: true });

const baseRecord = {
  id: z.string().uuid(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.nullable(),
  origin: RecordOrigin,
};

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
] as const;
export const MuscleGroup = z.enum(MUSCLE_GROUPS);
export type MuscleGroup = z.infer<typeof MuscleGroup>;

export const Equipment = z.enum([
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
]);
export type Equipment = z.infer<typeof Equipment>;

/** Decides which metrics apply to an exercise. Only weight_reps feeds volume load and e1RM. */
export const TrackingType = z.enum([
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'assisted_bodyweight',
  'duration',
  'distance',
]);
export type TrackingType = z.infer<typeof TrackingType>;

/** per_hand: the logged load is one dumbbell or one side; volume counts both sides. */
export const LoadMode = z.enum(['total', 'per_hand']);
export type LoadMode = z.infer<typeof LoadMode>;

export const SetType = z.enum(['warmup', 'working', 'backoff', 'drop']);
export type SetType = z.infer<typeof SetType>;

export const Exercise = z.object({
  ...baseRecord,
  name: z.string().min(1).max(80),
  primaryMuscle: MuscleGroup,
  secondaryMuscles: z.array(MuscleGroup),
  equipment: Equipment,
  category: z.enum(['compound', 'isolation']),
  trackingType: TrackingType,
  loadMode: LoadMode,
  instructions: z.string().nullable(),
  isCustom: z.boolean(),
});
export type Exercise = z.infer<typeof Exercise>;

/** Weekday numbers follow Date#getDay(): 0 = Sunday ... 6 = Saturday. */
export const Weekday = z.number().int().min(0).max(6);

export const Routine = z.object({
  ...baseRecord,
  name: z.string().min(1).max(60),
  description: z.string().nullable(),
  isActive: z.boolean(),
});
export type Routine = z.infer<typeof Routine>;

export const RoutineDay = z.object({
  ...baseRecord,
  routineId: z.string().uuid(),
  name: z.string().min(1).max(40),
  order: z.number().int().min(0),
  /** Planned weekdays for this day. Drives adherence. */
  weekdays: z.array(Weekday),
});
export type RoutineDay = z.infer<typeof RoutineDay>;

export const RoutineExercise = z.object({
  ...baseRecord,
  routineDayId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  order: z.number().int().min(0),
  targetSets: z.number().int().min(1).max(20),
  repMin: z.number().int().min(1).max(100),
  repMax: z.number().int().min(1).max(100),
  targetRir: z.number().min(0).max(10).nullable(),
  restSeconds: z.number().int().min(0).max(900),
  notes: z.string().nullable(),
});
export type RoutineExercise = z.infer<typeof RoutineExercise>;

export const WorkoutStatus = z.enum(['in_progress', 'completed', 'cancelled']);
export type WorkoutStatus = z.infer<typeof WorkoutStatus>;

/** A workout is a historical record. It never changes when its routine changes. */
export const Workout = z.object({
  ...baseRecord,
  name: z.string().min(1).max(60),
  routineId: z.string().uuid().nullable(),
  routineDayId: z.string().uuid().nullable(),
  status: WorkoutStatus,
  startedAt: isoDateTime,
  endedAt: isoDateTime.nullable(),
  /** Set while paused. Paused time is excluded from the workout duration. */
  pausedAt: isoDateTime.nullable(),
  /** Total paused milliseconds from completed pauses. */
  pausedMs: z.number().int().min(0),
  notes: z.string().nullable(),
  timeZone: z.string(),
});
export type Workout = z.infer<typeof Workout>;

export const TargetSnapshot = z.object({
  sets: z.number().int(),
  repMin: z.number().int(),
  repMax: z.number().int(),
  rir: z.number().nullable(),
});
export type TargetSnapshot = z.infer<typeof TargetSnapshot>;

export const WorkoutExercise = z.object({
  ...baseRecord,
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  /** Snapshot of the name at logging time, so renames never rewrite history. */
  exerciseName: z.string(),
  order: z.number().int().min(0),
  notes: z.string().nullable(),
  /** Snapshot of the routine targets at logging time. */
  target: TargetSnapshot.nullable(),
});
export type WorkoutExercise = z.infer<typeof WorkoutExercise>;

export const WorkoutSet = z.object({
  ...baseRecord,
  workoutId: z.string().uuid(),
  workoutExerciseId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  order: z.number().int().min(0),
  setType: SetType,
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  rir: z.number().min(0).max(10).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  durationSec: z.number().int().min(0).nullable(),
  distanceM: z.number().min(0).nullable(),
  /** Null until the set is marked complete. Only completed sets count in analytics. */
  completedAt: isoDateTime.nullable(),
  notes: z.string().nullable(),
});
export type WorkoutSet = z.infer<typeof WorkoutSet>;

export const BodyWeightEntry = z.object({
  ...baseRecord,
  measuredAt: isoDateTime,
  weightKg: z.number().min(20).max(400),
  enteredUnit: z.enum(['kg', 'lb']),
  note: z.string().nullable(),
});
export type BodyWeightEntry = z.infer<typeof BodyWeightEntry>;

export const Profile = z.object({
  ...baseRecord,
  displayName: z.string().min(1).max(60),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  goal: z.enum(['strength', 'hypertrophy', 'strength_hypertrophy', 'general_fitness']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
});
export type Profile = z.infer<typeof Profile>;

export const Preferences = z.object({
  weightUnit: z.enum(['kg', 'lb']),
  effortMetric: z.enum(['rir', 'rpe']),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  defaultRestSeconds: z.number().int().min(15).max(900),
});
export type Preferences = z.infer<typeof Preferences>;

/** Routine targets for one exercise, as edited in the routine builder. */
export const RoutineTargets = z
  .object({
    targetSets: z.number().int().min(1).max(20),
    repMin: z.number().int().min(1).max(100),
    repMax: z.number().int().min(1).max(100),
    targetRir: z.number().min(0).max(10).nullable(),
    restSeconds: z.number().int().min(0).max(900),
    notes: z.string().max(500).nullable(),
  })
  .refine((t) => t.repMin <= t.repMax, {
    message: 'Lowest reps must not be above highest reps',
    path: ['repMax'],
  });
export type RoutineTargets = z.infer<typeof RoutineTargets>;

export const CustomExerciseInput = z.object({
  name: z.string().trim().min(2, 'Give it a name of at least 2 characters').max(80),
  primaryMuscle: MuscleGroup,
  secondaryMuscles: z.array(MuscleGroup),
  equipment: Equipment,
  category: z.enum(['compound', 'isolation']),
  trackingType: TrackingType,
  loadMode: LoadMode,
  instructions: z.string().trim().max(1000).nullable(),
});
export type CustomExerciseInput = z.infer<typeof CustomExerciseInput>;

export const DEFAULT_PREFERENCES: Preferences = {
  weightUnit: 'kg',
  effortMetric: 'rir',
  weekStartsOn: 1,
  defaultRestSeconds: 120,
};
