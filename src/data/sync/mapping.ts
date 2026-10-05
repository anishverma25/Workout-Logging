import type { ZodType } from 'zod';
import {
  BodyWeightEntry,
  Exercise,
  Preferences,
  Profile,
  Routine,
  RoutineDay,
  RoutineExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/models/schemas';
import type { DomainTable } from '../db';

/**
 * How local records (camelCase, Dexie) map to server rows (snake_case, Postgres).
 * Server rows never carry `origin`: only records the person created ever leave the device,
 * so everything that comes back from the server is origin 'user'.
 */

export type ServerTable =
  | 'profiles'
  | 'user_exercises'
  | 'routines'
  | 'routine_days'
  | 'routine_exercises'
  | 'workouts'
  | 'workout_exercises'
  | 'sets'
  | 'body_weight';

export type ServerRow = Record<string, unknown>;

interface TableSpec {
  local: DomainTable;
  server: ServerTable;
  /** Local field names besides the shared id and timestamps. */
  fields: string[];
  schema: ZodType;
  /** Extra local fields that are implied for records coming from the server. */
  implied?: Record<string, unknown>;
}

/** Parents before children, so foreign keys hold when pushing and pulling. */
export const TABLE_SPECS: TableSpec[] = [
  {
    local: 'profiles',
    server: 'profiles',
    fields: ['displayName', 'birthDate', 'goal', 'experience'],
    schema: Profile,
  },
  {
    local: 'exercises',
    server: 'user_exercises',
    fields: [
      'name',
      'primaryMuscle',
      'secondaryMuscles',
      'equipment',
      'category',
      'trackingType',
      'loadMode',
      'instructions',
    ],
    schema: Exercise,
    implied: { isCustom: true },
  },
  {
    local: 'routines',
    server: 'routines',
    fields: ['name', 'description', 'isActive'],
    schema: Routine,
  },
  {
    local: 'routineDays',
    server: 'routine_days',
    fields: ['routineId', 'name', 'order', 'weekdays'],
    schema: RoutineDay,
  },
  {
    local: 'routineExercises',
    server: 'routine_exercises',
    fields: [
      'routineDayId',
      'exerciseId',
      'order',
      'targetSets',
      'repMin',
      'repMax',
      'targetRir',
      'restSeconds',
      'notes',
    ],
    schema: RoutineExercise,
  },
  {
    local: 'workouts',
    server: 'workouts',
    fields: [
      'name',
      'routineId',
      'routineDayId',
      'status',
      'startedAt',
      'endedAt',
      'pausedAt',
      'pausedMs',
      'notes',
      'timeZone',
    ],
    schema: Workout,
  },
  {
    local: 'workoutExercises',
    server: 'workout_exercises',
    fields: ['workoutId', 'exerciseId', 'exerciseName', 'order', 'notes', 'target'],
    schema: WorkoutExercise,
  },
  {
    local: 'sets',
    server: 'sets',
    fields: [
      'workoutId',
      'workoutExerciseId',
      'exerciseId',
      'order',
      'setType',
      'weightKg',
      'reps',
      'rir',
      'rpe',
      'durationSec',
      'distanceM',
      'completedAt',
      'notes',
    ],
    schema: WorkoutSet,
  },
  {
    local: 'bodyWeights',
    server: 'body_weight',
    fields: ['measuredAt', 'weightKg', 'enteredUnit', 'note'],
    schema: BodyWeightEntry,
  },
];

export const specFor = (table: DomainTable) => TABLE_SPECS.find((s) => s.local === table);

const BASE_FIELDS = ['id', 'createdAt', 'updatedAt', 'deletedAt'];
/** Postgres numeric comes back as a number or a string depending on the client. */
const NUMERIC_FIELDS = new Set(['weightKg', 'rir', 'rpe', 'distanceM', 'targetRir', 'pausedMs']);

export function toSnake(field: string): string {
  if (field === 'order') return 'order_index';
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Timestamps are compared as strings for "newer wins", so they must share one format. */
export function normalizeTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function toServerRow(spec: TableSpec, record: object, userId: string): ServerRow {
  const r = record as Record<string, unknown>;
  const row: ServerRow = { user_id: userId };
  for (const f of [...BASE_FIELDS, ...spec.fields]) row[toSnake(f)] = r[f] ?? null;
  return row;
}

/**
 * Converts and validates a server row. Returns null for rows that do not pass the local
 * schema, so a bad row can never break the screens that read it.
 */
export function fromServerRow(spec: TableSpec, row: ServerRow): Record<string, unknown> | null {
  const record: Record<string, unknown> = { origin: 'user', ...spec.implied };
  for (const f of [...BASE_FIELDS, ...spec.fields]) {
    let value = row[toSnake(f)] ?? null;
    if (value !== null && (f.endsWith('At') || f === 'measuredAt'))
      value = normalizeTimestamp(value);
    if (value !== null && NUMERIC_FIELDS.has(f)) value = Number(value);
    record[f] = value;
  }
  const parsed = spec.schema.safeParse(record);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}

// Preferences live in the meta table locally and in user_preferences on the server.

export function preferencesToRow(prefs: Preferences, updatedAt: string, userId: string): ServerRow {
  return {
    user_id: userId,
    weight_unit: prefs.weightUnit,
    effort_metric: prefs.effortMetric,
    week_starts_on: prefs.weekStartsOn,
    default_rest_seconds: prefs.defaultRestSeconds,
    auto_start_rest: prefs.autoStartRest,
    updated_at: updatedAt,
  };
}

export function preferencesFromRow(
  row: ServerRow,
): { prefs: Preferences; updatedAt: string } | null {
  const parsed = Preferences.safeParse({
    weightUnit: row.weight_unit,
    effortMetric: row.effort_metric,
    weekStartsOn: Number(row.week_starts_on),
    defaultRestSeconds: Number(row.default_rest_seconds),
    autoStartRest: row.auto_start_rest,
  });
  const updatedAt = normalizeTimestamp(row.updated_at);
  return parsed.success && updatedAt ? { prefs: parsed.data, updatedAt } : null;
}
