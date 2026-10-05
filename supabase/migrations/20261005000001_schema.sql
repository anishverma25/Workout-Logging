-- Overload: core schema, row level security and sync support.
--
-- Rules every user-owned table follows:
-- - `id` is generated on the device (client UUID), so offline-created records sync idempotently.
-- - `user_id` defaults to auth.uid() and row level security only lets a user see and change
--   rows where user_id = auth.uid(). The frontend is never trusted to filter.
-- - Child tables reference parents through (user_id, parent_id), so a row can never point at
--   another user's parent even if the id is known.
-- - Deletes from the app are soft (`deleted_at`) so they sync to other devices.
-- - `server_updated_at` is set by the server on every write and drives incremental pulls.
-- - An update with an older `updated_at` than the stored row is ignored (newer change wins).

-- ---------------------------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------------------------

create or replace function public.sync_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    -- Ownership and creation time never change after insert.
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- Newer change wins. Returning null skips the update, so a stale device cannot overwrite
-- a newer edit. Equal timestamps are allowed so retries of the same change are harmless.
create or replace function public.keep_newer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Built-in exercise library (shared, read only for users)
-- ---------------------------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key,
  key text not null unique,
  name text not null check (char_length(name) between 1 and 80),
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  category text not null check (category in ('compound', 'isolation')),
  tracking_type text not null,
  load_mode text not null check (load_mode in ('total', 'per_hand')),
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- User-owned tables
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  birth_date date,
  goal text not null check (goal in ('strength', 'hypertrophy', 'strength_hypertrophy', 'general_fitness')),
  experience text not null check (experience in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.user_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  category text not null check (category in ('compound', 'isolation')),
  tracking_type text not null check (tracking_type in (
    'weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_bodyweight', 'duration', 'distance'
  )),
  load_mode text not null check (load_mode in ('total', 'per_hand')),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, id)
);

create table public.routines (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text,
  is_active boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, id)
);

create table public.routine_days (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  order_index integer not null check (order_index >= 0),
  weekdays smallint[] not null default '{}' check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, id),
  foreign key (user_id, routine_id) references public.routines (user_id, id) on delete cascade
);

create table public.routine_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_day_id uuid not null,
  exercise_id uuid not null,
  order_index integer not null check (order_index >= 0),
  target_sets integer not null check (target_sets between 1 and 20),
  rep_min integer not null check (rep_min between 1 and 100),
  rep_max integer not null check (rep_max between 1 and 100),
  target_rir numeric(3, 1) check (target_rir between 0 and 10),
  rest_seconds integer not null check (rest_seconds between 0 and 900),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  check (rep_min <= rep_max),
  foreign key (user_id, routine_day_id) references public.routine_days (user_id, id) on delete cascade
);

-- Workouts are history: they keep plain references to the routine they came from (no foreign
-- key), because the routine may be deleted or may never have left the device (demo routines).
create table public.workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  routine_id uuid,
  routine_day_id uuid,
  status text not null check (status in ('in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz,
  paused_at timestamptz,
  paused_ms bigint not null default 0 check (paused_ms >= 0),
  notes text,
  time_zone text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  check (ended_at is null or ended_at >= started_at),
  unique (user_id, id)
);

create table public.workout_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  exercise_name text not null,
  order_index integer not null check (order_index >= 0),
  notes text,
  target jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, id),
  foreign key (user_id, workout_id) references public.workouts (user_id, id) on delete cascade
);

create table public.sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  workout_exercise_id uuid not null,
  exercise_id uuid not null,
  order_index integer not null check (order_index >= 0),
  set_type text not null check (set_type in ('warmup', 'working', 'backoff', 'drop')),
  weight_kg numeric check (weight_kg between 0 and 1000),
  reps integer check (reps between 0 and 1000),
  rir numeric(3, 1) check (rir between 0 and 10),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  duration_sec integer check (duration_sec >= 0),
  distance_m numeric check (distance_m >= 0),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  foreign key (user_id, workout_id) references public.workouts (user_id, id) on delete cascade,
  foreign key (user_id, workout_exercise_id) references public.workout_exercises (user_id, id) on delete cascade
);

create table public.body_weight (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric not null check (weight_kg between 20 and 400),
  entered_unit text not null check (entered_unit in ('kg', 'lb')),
  note text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  weight_unit text not null check (weight_unit in ('kg', 'lb')),
  effort_metric text not null check (effort_metric in ('rir', 'rpe')),
  week_starts_on smallint not null check (week_starts_on in (0, 1)),
  default_rest_seconds integer not null check (default_rest_seconds between 15 and 900),
  auto_start_rest boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- An exercise reference must be a built-in exercise or one of the user's own custom exercises.
create or replace function public.check_exercise_ref()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.exercises e where e.id = new.exercise_id)
     and not exists (
       select 1 from public.user_exercises u
       where u.id = new.exercise_id and u.user_id = new.user_id
     ) then
    raise exception 'Unknown exercise %', new.exercise_id using errcode = '23503';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Triggers, indexes and policies for every synced table
-- ---------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_exercises', 'routines', 'routine_days', 'routine_exercises',
    'workouts', 'workout_exercises', 'sets', 'body_weight', 'user_preferences'
  ] loop
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

create trigger routine_exercises_exercise_ref before insert or update of exercise_id on public.routine_exercises
  for each row execute function public.check_exercise_ref();
create trigger workout_exercises_exercise_ref before insert or update of exercise_id on public.workout_exercises
  for each row execute function public.check_exercise_ref();
create trigger sets_exercise_ref before insert or update of exercise_id on public.sets
  for each row execute function public.check_exercise_ref();

create index routine_days_routine_idx on public.routine_days (user_id, routine_id);
create index routine_exercises_day_idx on public.routine_exercises (user_id, routine_day_id);
create index workouts_started_idx on public.workouts (user_id, started_at desc);
create index workout_exercises_workout_idx on public.workout_exercises (user_id, workout_id);
create index sets_workout_idx on public.sets (user_id, workout_id);
create index sets_workout_exercise_idx on public.sets (user_id, workout_exercise_id);
create index body_weight_measured_idx on public.body_weight (user_id, measured_at desc);

-- The built-in library is readable by signed-in users and writable by nobody through the API.
alter table public.exercises enable row level security;
create policy exercises_read on public.exercises for select to authenticated using (true);
revoke all on public.exercises from anon;
grant select on public.exercises to authenticated;
