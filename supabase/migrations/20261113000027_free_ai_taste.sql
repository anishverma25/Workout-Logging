-- A taste of Macrotrophy AI for free members (November 2026). Safe to run more than once.
-- Free accounts can log food with Ask AI 3 times a week (Monday to Sunday, India time), so they
-- feel what Pro does before deciding. Pro has no weekly limit. Only a count is kept.

alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('photo', 'free_food'));

create or replace function public.free_ai_per_week() returns integer
language sql immutable set search_path = '' as $$ select 3 $$;

-- The Monday of this week in India: the row the weekly count is kept on.
create or replace function public.free_ai_week() returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', (now() at time zone 'Asia/Kolkata'))::date
$$;

-- Takes one free use for this week; returns how many are left after it, or -1 when none are.
create or replace function public.claim_free_ai()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cap integer := public.free_ai_per_week();
  n integer;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  insert into public.ai_usage as u (user_id, day, kind, used)
  values (uid, public.free_ai_week(), 'free_food', 1)
  on conflict (user_id, day, kind) do update
    set used = u.used + 1
    where u.used < cap
  returning used into n;
  if n is null then
    return -1;
  end if;
  return cap - n;
end;
$$;

-- Gives one back (nothing usable came back from the AI service).
create or replace function public.release_free_ai()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_usage
  set used = greatest(0, used - 1)
  where user_id = auth.uid() and day = public.free_ai_week() and kind = 'free_food';
end;
$$;

-- How many free uses are left this week, for the app to show.
create or replace function public.get_free_ai_left()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, public.free_ai_per_week() - coalesce((
    select u.used from public.ai_usage u
    where u.user_id = auth.uid() and u.day = public.free_ai_week() and u.kind = 'free_food'
  ), 0));
$$;

revoke all on function public.claim_free_ai() from public, anon;
revoke all on function public.release_free_ai() from public, anon;
revoke all on function public.get_free_ai_left() from public, anon;
grant execute on function public.claim_free_ai() to authenticated;
grant execute on function public.release_free_ai() to authenticated;
grant execute on function public.get_free_ai_left() to authenticated;
