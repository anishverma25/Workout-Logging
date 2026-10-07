import { SYSTEM_EXERCISE_KEYS, SYSTEM_EXERCISES } from '../library/exercises';

const literal = (value: string | null) =>
  value === null ? 'null' : `'${value.replace(/'/g, "''")}'`;

/**
 * SQL that loads the built-in exercise library into the shared `exercises` table, with the
 * same stable ids the app uses on the device. A unit test keeps the migration file in step
 * with the library (run with UPDATE_SEED=1 to rewrite it).
 */
/** The library as first released; later additions are seeded by later migrations. */
export const FIRST_LIBRARY_SIZE = 91;
/** End of the personal training release (migration 0004); later entries go in 0005. */
export const PERSONAL_TRAINING_LIBRARY_SIZE = 101;

export function exerciseSeedSql(from = 0, to = FIRST_LIBRARY_SIZE): string {
  const rows = SYSTEM_EXERCISES.slice(from, to).map((e, j) => {
    const i = from + j;
    const secondary = `array[${e.secondaryMuscles.map((m) => literal(m)).join(', ')}]::text[]`;
    return `  (${[
      literal(e.id),
      literal(SYSTEM_EXERCISE_KEYS[i]!),
      literal(e.name),
      literal(e.primaryMuscle),
      secondary,
      literal(e.equipment),
      literal(e.category),
      literal(e.trackingType),
      literal(e.loadMode),
      literal(e.instructions),
      literal(e.createdAt),
      literal(e.updatedAt),
    ].join(', ')})`;
  });
  return `-- Generated from src/data/library/exercises.ts by src/data/sync/seed.ts. Do not edit by hand.
insert into public.exercises (
  id, key, name, primary_muscle, secondary_muscles, equipment, category, tracking_type,
  load_mode, instructions, created_at, updated_at
) values
${rows.join(',\n')}
on conflict (id) do update set
  key = excluded.key,
  name = excluded.name,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  category = excluded.category,
  tracking_type = excluded.tracking_type,
  load_mode = excluded.load_mode,
  instructions = excluded.instructions,
  updated_at = excluded.updated_at;
`;
}
