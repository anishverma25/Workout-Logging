-- Training details: bench angle, rest between exercises, the adductors muscle group and two
-- decline presses. Safe to run more than once.

-- Bench angle in degrees on routine and workout exercises: positive incline, negative decline.
alter table public.routine_exercises
  add column if not exists angle_deg smallint check (angle_deg between -45 and 90);
alter table public.workout_exercises
  add column if not exists angle_deg smallint check (angle_deg between -45 and 90);

-- Rest when moving on to the next exercise. Null uses each exercise's own rest.
alter table public.user_preferences
  add column if not exists exercise_change_rest_seconds smallint
    check (exercise_change_rest_seconds between 0 and 900);

-- Library: the hip adduction machine now counts for the adductors (about 90% of its work),
-- and the decline barbell and dumbbell presses are added.

-- Generated from src/data/library/exercises.ts by src/data/sync/seed.ts. Do not edit by hand.
insert into public.exercises (
  id, key, name, primary_muscle, secondary_muscles, equipment, category, tracking_type,
  load_mode, instructions, created_at, updated_at
) values
  ('548049eb-7de7-44da-b4fe-749ca1832fe5', 'hip-adduction', 'Hip adduction machine', 'adductors', array[]::text[], 'machine', 'isolation', 'weight_reps', 'total', 'Also called the adductor machine; it works the inner thighs. Sit tall with the pads on the inside of the knees, squeeze the legs together, pause, then let them open slowly.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('3e96cbc4-8f2a-4f8f-ac1c-172849147750', 'decline-bench-press', 'Decline barbell bench press', 'chest', array['triceps', 'shoulders']::text[], 'barbell', 'compound', 'weight_reps', 'total', 'Hook the feet under the pads on a bench set 15 to 30 degrees head-down. Lower the bar to the lower chest with control, then press up over the shoulders.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('015b38a0-7e92-4c9d-9664-004ac94d8fb7', 'decline-dumbbell-press', 'Decline dumbbell press', 'chest', array['triceps', 'shoulders']::text[], 'dumbbell', 'compound', 'weight_reps', 'per_hand', 'On a bench set 15 to 30 degrees head-down, press the dumbbells up over the lower chest and lower them slowly to chest level. Log one dumbbell.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
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
