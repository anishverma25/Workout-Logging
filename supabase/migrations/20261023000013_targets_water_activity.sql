-- Food targets chosen or typed by the person (carbs, fat, fibre, water, and whether targets are
-- calculated or their own), water logs, and activity logs (cardio sessions and daily steps).
-- Same rules as every other user table: client ids, user_id from auth.uid(), row level security
-- on every operation, newer change wins. Safe to run more than once.

alter table public.profiles
  add column if not exists target_mode text check (target_mode in ('calculated', 'own')),
  add column if not exists carbs_target_g smallint check (carbs_target_g between 0 and 1500),
  add column if not exists fat_target_g smallint check (fat_target_g between 10 and 500),
  add column if not exists fibre_target_g smallint check (fibre_target_g between 0 and 150),
  add column if not exists water_target_ml smallint check (water_target_ml between 500 and 8000),
  add column if not exists water_glass_ml smallint check (water_glass_ml between 100 and 1000);

alter table public.workouts
  add column if not exists kcal_burned smallint check (kcal_burned between 0 and 10000);

create table if not exists public.water_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  ml smallint not null check (ml between 50 and 5000),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.activity_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('cardio', 'steps')),
  activity text check (activity in (
    'treadmill_walk', 'treadmill_run', 'stair_machine', 'cycle_indoor', 'elliptical',
    'rowing_machine', 'walk_outdoor', 'run_outdoor', 'cycle_outdoor', 'swimming', 'hiit', 'other'
  )),
  minutes smallint check (minutes between 1 and 1000),
  distance_km numeric(6, 2) check (distance_km between 0 and 500),
  speed_kmh numeric(4, 1) check (speed_kmh between 0.5 and 30),
  incline_pct numeric(4, 1) check (incline_pct between 0 and 40),
  watts smallint check (watts between 10 and 1000),
  effort text check (effort in ('light', 'moderate', 'hard')),
  steps integer check (steps between 1 and 200000),
  kcal smallint not null check (kcal between 0 and 10000),
  kcal_source text not null check (kcal_source in ('estimated', 'typed')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

do $$
declare
  t text;
begin
  foreach t in array array['water_logs', 'activity_logs'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_stamp', t);
    execute format('create trigger %I before insert or update on public.%I
      for each row execute function public.sync_stamp()', t || '_stamp', t);
    execute format('drop trigger if exists %I on public.%I', t || '_keep_newer', t);
    execute format('create trigger %I before update on public.%I
      for each row execute function public.keep_newer()', t || '_keep_newer', t);
    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)',
      t || '_pull_idx', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (user_id = (select auth.uid()))', t || '_delete_own', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

create index if not exists water_logs_date_idx on public.water_logs (user_id, date desc);
create index if not exists activity_logs_date_idx on public.activity_logs (user_id, date desc);
