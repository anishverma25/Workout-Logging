-- Timed routine targets up to 10 minutes (November 2026, Fable review batch 11, T1).
--
-- Before: rep_min and rep_max were capped at 100, so a 120 s plank target never reached the
-- server. Now they go to 600 (seconds, for timed exercises); the app keeps reps at 100 or less
-- for every other exercise. Existing rows are unchanged. Safe to run before the app.

do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_catalog.pg_constraint con
     where con.conrelid = 'public.routine_exercises'::regclass
       and con.contype = 'c'
       and (
         pg_catalog.pg_get_constraintdef(con.oid) ilike '%rep_min >= 1%rep_min <= 100%'
         or pg_catalog.pg_get_constraintdef(con.oid) ilike '%rep_max >= 1%rep_max <= 100%'
       )
  loop
    execute format('alter table public.routine_exercises drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.routine_exercises drop constraint if exists routine_exercises_rep_min_range;
alter table public.routine_exercises drop constraint if exists routine_exercises_rep_max_range;
alter table public.routine_exercises
  add constraint routine_exercises_rep_min_range check (rep_min between 1 and 600);
alter table public.routine_exercises
  add constraint routine_exercises_rep_max_range check (rep_max between 1 and 600);
