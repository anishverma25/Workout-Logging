-- Round 6 (November 2026): more body measurements, and notes pinned to an exercise. Safe to
-- run more than once. Run it in the SQL editor before the app version that needs it is
-- deployed.

-- More tape measurements: shoulders, forearm, wrist, under the bust, and the right side of
-- the arm, forearm, thigh and calf for people who measure both (the existing columns are the
-- left side, or the only side measured).
alter table public.body_measurements add column if not exists shoulders_cm numeric(5, 1);
alter table public.body_measurements add column if not exists forearm_cm numeric(5, 1);
alter table public.body_measurements add column if not exists wrist_cm numeric(5, 1);
alter table public.body_measurements add column if not exists underbust_cm numeric(5, 1);
alter table public.body_measurements add column if not exists arm_right_cm numeric(5, 1);
alter table public.body_measurements add column if not exists forearm_right_cm numeric(5, 1);
alter table public.body_measurements add column if not exists thigh_right_cm numeric(5, 1);
alter table public.body_measurements add column if not exists calf_right_cm numeric(5, 1);

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('shoulders_cm', 60, 200),
      ('forearm_cm', 15, 60),
      ('wrist_cm', 10, 30),
      ('underbust_cm', 50, 200),
      ('arm_right_cm', 10, 80),
      ('forearm_right_cm', 15, 60),
      ('thigh_right_cm', 20, 120),
      ('calf_right_cm', 15, 80)
    ) as v (col, lo, hi)
  loop
    execute format('alter table public.body_measurements drop constraint if exists %I',
      'body_measurements_' || c.col || '_check');
    execute format(
      'alter table public.body_measurements add constraint %I check (%I is null or %I between %s and %s)',
      'body_measurements_' || c.col || '_check', c.col, c.col, c.lo, c.hi);
  end loop;
end;
$$;

-- A note pinned to an exercise: shown every time the person does it (seat height, grip, cues).
-- One live note per exercise; the app keeps the newest if two devices each made one.
create table if not exists public.exercise_notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null,
  note text not null check (char_length(note) between 1 and 500),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

drop trigger if exists exercise_notes_stamp on public.exercise_notes;
create trigger exercise_notes_stamp before insert or update on public.exercise_notes
  for each row execute function public.sync_stamp();
drop trigger if exists exercise_notes_keep_newer on public.exercise_notes;
create trigger exercise_notes_keep_newer before update on public.exercise_notes
  for each row execute function public.keep_newer();
-- The exercise must be built in or one of the person's own.
drop trigger if exists exercise_notes_exercise_ref on public.exercise_notes;
create trigger exercise_notes_exercise_ref before insert or update of exercise_id
  on public.exercise_notes
  for each row execute function public.check_exercise_ref();

create index if not exists exercise_notes_pull_idx
  on public.exercise_notes (user_id, server_updated_at);

alter table public.exercise_notes enable row level security;
alter table public.exercise_notes force row level security;
drop policy if exists exercise_notes_select_own on public.exercise_notes;
create policy exercise_notes_select_own on public.exercise_notes for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists exercise_notes_insert_own on public.exercise_notes;
create policy exercise_notes_insert_own on public.exercise_notes for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists exercise_notes_update_own on public.exercise_notes;
create policy exercise_notes_update_own on public.exercise_notes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists exercise_notes_delete_own on public.exercise_notes;
create policy exercise_notes_delete_own on public.exercise_notes for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.exercise_notes from anon;
grant select, insert, update, delete on public.exercise_notes to authenticated;
