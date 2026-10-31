-- Photo food logging (Pro): a small daily allowance per account, so a few people cannot use up
-- the AI service's shared free allowance for everyone. Only the count is kept: never the photo,
-- the food or anything else. The coach Edge Function calls claim_ai_use as the signed-in person
-- before it sends a photo, and release_ai_use when nothing usable came back.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The day in India, where the app is used, so the allowance resets at midnight there.
  day date not null,
  kind text not null check (kind in ('photo')),
  used integer not null default 0 check (used >= 0),
  primary key (user_id, day, kind)
);

alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;
-- No policies: nobody reads or writes the table directly, only through the functions below.
revoke all on public.ai_usage from anon, authenticated;

-- Takes one use for today and returns how many are left, or -1 when the day's allowance
-- (15 photos) is used up.
create or replace function public.claim_ai_use(p_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
  cap integer := 15;
  n integer;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_kind is distinct from 'photo' then
    raise exception 'Unknown kind.' using errcode = '22023';
  end if;
  insert into public.ai_usage as u (user_id, day, kind, used)
  values (uid, today, p_kind, 1)
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

-- Gives back one use of today's allowance (after the AI service failed).
create or replace function public.release_ai_use(p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  update public.ai_usage
    set used = greatest(used - 1, 0)
    where user_id = uid and day = today and kind = p_kind;
end;
$$;

revoke all on function public.claim_ai_use(text) from public, anon;
revoke all on function public.release_ai_use(text) from public, anon;
grant execute on function public.claim_ai_use(text) to authenticated;
grant execute on function public.release_ai_use(text) to authenticated;
