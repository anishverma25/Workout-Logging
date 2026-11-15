-- A 14-day Pro trial for new accounts (November 2026, Fable review batch 8, Anish's decision).
--
-- Before: every account's trial was exactly 168 hours (7 days), pinned by a check and a trigger.
-- Now: accounts created from this migration on get 336 hours (14 days), so a new member sees
-- the weekly report and the Brain's first weeks before the trial ends.
--
-- - Existing rows are not touched: a trial that started at 7 days stays 7 days.
-- - The trial still cannot move once created (the subscriptions_touch trigger is unchanged),
--   and the check allows exactly the two lengths, nothing else.
-- - Run this before deploying the app that says "14 days".

do $$
declare
  c record;
begin
  -- The old unnamed check (trial_expires_at = trial_started_at + 168 hours), found by its text
  -- rather than its generated name.
  for c in
    select con.conname
      from pg_catalog.pg_constraint con
     where con.conrelid = 'public.subscriptions'::regclass
       and con.contype = 'c'
       and pg_catalog.pg_get_constraintdef(con.oid) ilike '%trial_expires_at = (trial_started_at +%'
  loop
    execute format('alter table public.subscriptions drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.subscriptions
  drop constraint if exists subscriptions_trial_length;
alter table public.subscriptions
  add constraint subscriptions_trial_length check (
    trial_expires_at = trial_started_at + interval '168 hours'
    or trial_expires_at = trial_started_at + interval '336 hours'
  );

alter table public.subscriptions
  alter column trial_expires_at set default now() + interval '336 hours';
