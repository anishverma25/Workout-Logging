-- Personal training: profile details, body measurements, goals, readiness and session effort,
-- supersets, cardio and deleting your own account.
--
-- Every new column is nullable (or has a default), so rows written by older app versions stay
-- valid. New tables follow the same rules as every other user table: client ids, user_id from
-- auth.uid(), row level security on every operation, newer change wins.

-- ---------------------------------------------------------------------------------------------
-- Profile details used by the formulas (all optional)
-- ---------------------------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_goal_check;
alter table public.profiles add constraint profiles_goal_check check (goal in (
  'hypertrophy', 'strength', 'strength_hypertrophy', 'fat_loss', 'recomposition', 'general_fitness'
));

alter table public.profiles
  add column sex text check (sex in ('male', 'female', 'unspecified')),
  add column height_cm numeric(4, 1) check (height_cm between 100 and 250),
  add column training_days smallint check (training_days between 1 and 7),
  add column session_minutes smallint check (session_minutes between 15 and 240),
  add column equipment text check (equipment in ('full_gym', 'dumbbells', 'home')),
  add column daily_activity text check (daily_activity in ('sitting', 'mixed', 'on_feet', 'physical'));

-- ---------------------------------------------------------------------------------------------
-- Workouts: readiness before, effort after. Supersets in routines and workouts.
-- ---------------------------------------------------------------------------------------------

alter table public.workouts
  add column readiness jsonb check (
    readiness is null or (
      jsonb_typeof(readiness) = 'object'
      and (readiness ->> 'sleep')::int between 1 and 5
      and (readiness ->> 'energy')::int between 1 and 5
      and (readiness ->> 'soreness')::int between 1 and 5
    )
  ),
  add column session_rpe numeric(3, 1) check (session_rpe between 1 and 10);

alter table public.routine_exercises
  add column superset_group smallint check (superset_group between 1 and 50);
alter table public.workout_exercises
  add column superset_group smallint check (superset_group between 1 and 50);

-- Cardio exercises log time and distance together.
alter table public.user_exercises drop constraint if exists user_exercises_tracking_type_check;
alter table public.user_exercises add constraint user_exercises_tracking_type_check check (tracking_type in (
  'weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_bodyweight', 'duration',
  'distance', 'cardio'
));

alter table public.user_preferences
  add column length_unit text not null default 'cm' check (length_unit in ('cm', 'in'));

-- ---------------------------------------------------------------------------------------------
-- Body measurements and goals
-- ---------------------------------------------------------------------------------------------

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null,
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  neck_cm numeric(5, 1) check (neck_cm between 15 and 80),
  hip_cm numeric(5, 1) check (hip_cm between 40 and 250),
  chest_cm numeric(5, 1) check (chest_cm between 40 and 250),
  arm_cm numeric(5, 1) check (arm_cm between 10 and 80),
  thigh_cm numeric(5, 1) check (thigh_cm between 20 and 120),
  calf_cm numeric(5, 1) check (calf_cm between 15 and 80),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('exercise_e1rm', 'exercise_load', 'body_weight')),
  exercise_id uuid,
  target_value numeric not null check (target_value between 1 and 1000),
  start_value numeric check (start_value between 0 and 1000),
  target_date date,
  achieved_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  check ((kind = 'body_weight') = (exercise_id is null))
);

do $$
declare
  t text;
begin
  foreach t in array array['body_measurements', 'goals'] loop
    execute format('create trigger %I before insert or update on public.%I
      for each row execute function public.sync_stamp()', t || '_stamp', t);
    execute format('create trigger %I before update on public.%I
      for each row execute function public.keep_newer()', t || '_keep_newer', t);
    execute format('create index %I on public.%I (user_id, server_updated_at)',
      t || '_pull_idx', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (user_id = (select auth.uid()))', t || '_delete_own', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- A goal's exercise must be built in or one of the user's own.
create trigger goals_exercise_ref before insert or update of exercise_id on public.goals
  for each row when (new.exercise_id is not null)
  execute function public.check_exercise_ref();

create index body_measurements_measured_idx on public.body_measurements (user_id, measured_at desc);

-- ---------------------------------------------------------------------------------------------
-- Deleting your own account
-- ---------------------------------------------------------------------------------------------

-- Deletes the signed-in user and, through the foreign keys, every row they own. It can only
-- ever delete the caller: the id comes from the verified session, never from an argument.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Generated from src/data/library/exercises.ts by src/data/sync/seed.ts. Do not edit by hand.
insert into public.exercises (
  id, key, name, primary_muscle, secondary_muscles, equipment, category, tracking_type,
  load_mode, instructions, created_at, updated_at
) values
  ('f3f5969f-700b-4d06-bef4-298b056fe7c9', 'pike-push-up', 'Pike push-up', 'shoulders', array['triceps']::text[], 'bodyweight', 'compound', 'bodyweight_reps', 'total', 'Start in a push-up with the hips high, so the body makes an upside-down V. Bend the elbows to bring the top of the head toward the floor, then press back up.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('3758736e-69e0-4746-bb21-2787f5529fc2', 'band-pull-apart', 'Band pull-apart', 'shoulders', array['back']::text[], 'band', 'isolation', 'bodyweight_reps', 'total', 'Hold a light band at shoulder height with straight arms. Pull it apart until it touches the chest, squeezing the shoulder blades, then return slowly.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('2bcde78b-fb83-48ff-a597-8e27ad38c3ed', 'treadmill-run', 'Treadmill run', 'cardio', array[]::text[], 'machine', 'compound', 'cardio', 'total', 'Warm up with a few minutes of walking, then run at a pace you can hold. Log the minutes and the distance the display shows.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('09357f6a-49cf-4f72-9580-0789cda63b70', 'outdoor-run', 'Outdoor run', 'cardio', array[]::text[], 'bodyweight', 'compound', 'cardio', 'total', 'Start easy for the first few minutes and settle into a steady rhythm. Log the time and the distance from your watch or phone.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('03edfb4a-f09d-41cd-aeee-5cb50912d786', 'incline-walk', 'Incline treadmill walk', 'cardio', array[]::text[], 'machine', 'compound', 'cardio', 'total', 'Set a steep incline and a brisk walking pace. Walk tall without holding the rails. Log the minutes and distance.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('bdc0d786-d9f1-4b60-b5fc-8759e599b743', 'stationary-bike', 'Stationary bike', 'cardio', array[]::text[], 'machine', 'compound', 'cardio', 'total', 'Set the saddle so the knee stays slightly bent at the bottom of the stroke. Keep a steady cadence. Log the minutes and distance.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('2702dd61-3a1f-4abc-b0aa-337a791a9f03', 'rowing-machine', 'Rowing machine', 'cardio', array['back', 'quads']::text[], 'machine', 'compound', 'cardio', 'total', 'Drive with the legs first, then lean back slightly and pull the handle to the lower ribs. Reverse the order on the way back. Log the minutes and metres.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('1072edc9-ea0a-4d26-b700-2409414fab40', 'elliptical', 'Elliptical', 'cardio', array[]::text[], 'machine', 'compound', 'cardio', 'total', 'Stand tall, push and pull the handles with the stride, and keep the whole foot on the pedal. Log the minutes and distance.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('ffa0ab21-e7fc-4ca9-b591-22cebda49b83', 'stair-climber', 'Stair climber', 'cardio', array['glutes', 'quads']::text[], 'machine', 'compound', 'duration', 'total', 'Take full steps and keep a light grip on the rails, if any. Log the minutes worked.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('ba9f9873-9922-4eba-9650-5f8c99a66b7c', 'jump-rope', 'Jump rope', 'cardio', array['calves']::text[], 'other', 'compound', 'duration', 'total', 'Small jumps on the balls of the feet, turning the rope from the wrists. Log the time skipped.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
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
