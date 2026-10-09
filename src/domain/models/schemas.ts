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
  'adductors',
  'calves',
  'abs',
  'cardio',
] as const;
export const MuscleGroup = z.enum(MUSCLE_GROUPS);
export type MuscleGroup = z.infer<typeof MuscleGroup>;
/** Muscle groups that strength analytics count (cardio is a category, not a muscle). */
export const STRENGTH_MUSCLES = MUSCLE_GROUPS.filter((m) => m !== 'cardio') as Exclude<
  MuscleGroup,
  'cardio'
>[];

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
  /** Time and distance together (runs, rides, rows). */
  'cardio',
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
  /** Exercises of one day that share a number are done as a superset (no rest between). */
  supersetGroup: z.number().int().min(1).max(50).nullish(),
  /** Bench angle in degrees: positive for incline, negative for decline. */
  angleDeg: z.number().int().min(-45).max(90).nullish(),
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
  /** How the person felt before training (1 to 5 each). Optional. */
  readiness: z
    .object({
      sleep: z.number().int().min(1).max(5),
      energy: z.number().int().min(1).max(5),
      soreness: z.number().int().min(1).max(5),
    })
    .nullish(),
  /** Whole-session effort, 1 to 10 (Foster's session RPE), asked when finishing. */
  sessionRpe: z.number().min(1).max(10).nullish(),
});
export type Workout = z.infer<typeof Workout>;
export type Readiness = NonNullable<Workout['readiness']>;

export const TargetSnapshot = z.object({
  sets: z.number().int(),
  repMin: z.number().int(),
  repMax: z.number().int(),
  rir: z.number().nullable(),
  /** Planned rest in seconds. Missing on workouts logged before it was recorded. */
  rest: z.number().int().min(0).max(900).nullable().optional(),
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
  supersetGroup: z.number().int().min(1).max(50).nullish(),
  /** Bench angle in degrees: positive for incline, negative for decline. */
  angleDeg: z.number().int().min(-45).max(90).nullish(),
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Goal = z.enum([
  'hypertrophy',
  'strength',
  'strength_hypertrophy',
  'fat_loss',
  'recomposition',
  'general_fitness',
]);
export type Goal = z.infer<typeof Goal>;
export const Experience = z.enum(['beginner', 'intermediate', 'advanced']);
export type Experience = z.infer<typeof Experience>;
/** Sex as used by the energy and strength-standard formulas. Unspecified hides those numbers. */
export const Sex = z.enum(['male', 'female', 'unspecified']);
export type Sex = z.infer<typeof Sex>;
export const GymAccess = z.enum(['full_gym', 'dumbbells', 'home']);
export type GymAccess = z.infer<typeof GymAccess>;
/** How active the day is outside training: sets the activity factor for daily energy. */
export const DailyActivity = z.enum(['sitting', 'mixed', 'on_feet', 'physical']);
export type DailyActivity = z.infer<typeof DailyActivity>;

export const Profile = z.object({
  ...baseRecord,
  displayName: z.string().min(1).max(60),
  birthDate: isoDate.nullable(),
  goal: Goal,
  experience: Experience,
  sex: Sex.nullish(),
  heightCm: z.number().min(100).max(250).nullish(),
  /** Training days per week the person plans for. */
  trainingDays: z.number().int().min(1).max(7).nullish(),
  sessionMinutes: z.number().int().min(15).max(240).nullish(),
  equipment: GymAccess.nullish(),
  dailyActivity: DailyActivity.nullish(),
});
export type Profile = z.infer<typeof Profile>;

/** Tape measurements (cm) and an optional body-fat reading from a scale or scan. */
export const BodyMeasurement = z.object({
  ...baseRecord,
  measuredAt: isoDateTime,
  waistCm: z.number().min(30).max(250).nullable(),
  neckCm: z.number().min(15).max(80).nullable(),
  hipCm: z.number().min(40).max(250).nullable(),
  chestCm: z.number().min(40).max(250).nullable(),
  armCm: z.number().min(10).max(80).nullable(),
  thighCm: z.number().min(20).max(120).nullable(),
  calfCm: z.number().min(15).max(80).nullable(),
  bodyFatPct: z.number().min(2).max(70).nullable(),
  note: z.string().max(500).nullable(),
});
export type BodyMeasurement = z.infer<typeof BodyMeasurement>;
export const MEASUREMENT_FIELDS = [
  'waistCm',
  'neckCm',
  'hipCm',
  'chestCm',
  'armCm',
  'thighCm',
  'calfCm',
] as const;
export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

export const GoalKind = z.enum(['exercise_e1rm', 'exercise_load', 'body_weight']);
export type GoalKind = z.infer<typeof GoalKind>;

/** A target the person set: a lift or a body weight, optionally by a date. */
export const TrainingGoal = z.object({
  ...baseRecord,
  kind: GoalKind,
  exerciseId: z.string().uuid().nullable(),
  /** In kg. */
  targetValue: z.number().min(1).max(1000),
  /** The value when the goal was set, in kg. Null if there was none yet. */
  startValue: z.number().min(0).max(1000).nullable(),
  targetDate: isoDate.nullable(),
  achievedAt: isoDateTime.nullable(),
});
export type TrainingGoal = z.infer<typeof TrainingGoal>;

export const Preferences = z.object({
  weightUnit: z.enum(['kg', 'lb']),
  effortMetric: z.enum(['rir', 'rpe']),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  defaultRestSeconds: z.number().int().min(15).max(900),
  /** Start the rest timer automatically when a set is marked done. */
  autoStartRest: z.boolean(),
  lengthUnit: z.enum(['cm', 'in']).default('cm'),
  /** Rest when moving on to the next exercise; null uses each exercise's own rest. */
  exerciseChangeRestSeconds: z.number().int().min(0).max(900).nullable().default(null),
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
  autoStartRest: true,
  lengthUnit: 'cm',
  exerciseChangeRestSeconds: null,
};
