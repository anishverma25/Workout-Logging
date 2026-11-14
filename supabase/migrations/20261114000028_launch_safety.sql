-- Launch safety (November 2026): one file for everything the launch fixes need on the server.
--
-- 1. AI limits per account and kind, and a daily budget for the whole app (the coach Edge
--    Function claims as the service role, for the user it has already checked).
-- 2. A webhook event whose processing failed can be forgotten, so Razorpay's retry is applied.
-- 3. Usernames that look like the brand are refused.
-- 4. Deleting an account is refused while autopay can still charge it.
-- 5. Switches the owner can flip without a deploy (get_app_flags).
-- 6. Payments that match no account (orphans), refunds and disputes are recorded, and a paid
--    subscription that lost its account link can be attached back (billing_adopt).
--
-- Safe to run more than once. The old claim_ai_use and release_ai_use stay usable until
-- 20261114000029 is run, after the coach function is deployed.

-- ---------------------------------------------------------------------------------------------
-- 1. AI limits
-- ---------------------------------------------------------------------------------------------

alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage
  add constraint ai_usage_kind_check check (kind in ('photo', 'chat', 'food'));

-- Uses across everyone in a day before the AI pauses for all (the free AI allowance is shared).
alter table public.app_settings add column if not exists ai_daily_budget integer not null
  default 3000 check (ai_daily_budget >= 0);

-- Takes one use of a kind for today and returns how many are left, -1 when this account's limit
-- for the kind is reached, or -2 when the whole app's budget for today is used up.
create or replace function public.ai_claim(p_user uuid, p_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  cap integer;
  budget integer;
  total integer;
  n integer;
begin
  if p_user is null then
    raise exception 'No account' using errcode = '22023';
  end if;
  cap := case p_kind when 'photo' then 15 when 'chat' then 60 when 'food' then 80 else null end;
  if cap is null then
    raise exception 'Unknown kind.' using errcode = '22023';
  end if;
  select s.ai_daily_budget into budget from public.app_settings s where s.id;
  select coalesce(sum(u.used), 0) into total from public.ai_usage u where u.day = today;
  if budget is not null and total >= budget then
    return -2;
  end if;
  insert into public.ai_usage as u (user_id, day, kind, used)
  values (p_user, today, p_kind, 1)
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

-- Gives back one use of today's allowance of a kind (after the AI service failed).
create or replace function public.ai_release(p_user uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  update public.ai_usage
    set used = greatest(used - 1, 0)
    where user_id = p_user and day = today and kind = p_kind;
end;
$$;

revoke all on function public.ai_claim(uuid, text) from public, anon, authenticated;
revoke all on function public.ai_release(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_claim(uuid, text) to service_role;
grant execute on function public.ai_release(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Webhook events that failed are forgotten, so Razorpay's retry is applied
-- ---------------------------------------------------------------------------------------------

create or replace function public.billing_forget_event(p_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.billing_events where id = p_id;
$$;
revoke all on function public.billing_forget_event(text) from public, anon, authenticated;
grant execute on function public.billing_forget_event(text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Names nobody may take: the brand too
-- ---------------------------------------------------------------------------------------------

create or replace function public.community_reserved(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name = any (array[
    'overload', 'overloadgym', 'overloadgpt', 'admin', 'administrator', 'support', 'help',
    'coach', 'official', 'team', 'staff', 'moderator', 'root', 'system', 'null', 'undefined',
    'macrotrophy', 'macrotrophyai'
  ])
    or p_name like 'overload%'
    or p_name like 'macrotrophy%';
$$;
revoke all on function public.community_reserved(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. No account is deleted while autopay can still charge it
-- ---------------------------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns boolean
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
  if exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.razorpay_subscription_id is not null
      and coalesce(s.billing_kind, 'subscription') = 'subscription'
      and s.razorpay_status in ('created', 'authenticated', 'active', 'pending', 'halted')
      and s.cancel_at_period_end is not true
  ) then
    raise exception 'cancel_autopay_first' using errcode = 'P0001';
  end if;
  delete from auth.users where id = uid;
  return true;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Switches: turn a feature off in seconds, with no deploy
-- ---------------------------------------------------------------------------------------------

-- Keys: ai_chat, ai_food, ai_photo, payments, groups (true or false) and notice (one line of
-- text for everyone, at most 140 characters). Anything left out is on.
alter table public.app_settings add column if not exists flags jsonb not null default '{}'::jsonb;

create or replace function public.get_app_flags()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.flags from public.app_settings s where s.id), '{}'::jsonb);
$$;
revoke all on function public.get_app_flags() from public;
grant execute on function public.get_app_flags() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. Payments with no account, refunds and disputes
-- ---------------------------------------------------------------------------------------------

create table if not exists public.billing_orphans (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('orphan', 'refund', 'dispute')),
  -- A subscription or payment id from Razorpay.
  razorpay_id text not null,
  user_id uuid,
  event text not null,
  amount_inr numeric,
  -- What was done about it: 'cancelled' (an orphan stopped at Razorpay) or 'recorded'.
  action text not null default 'recorded',
  created_at timestamptz not null default now()
);
alter table public.billing_orphans enable row level security;
alter table public.billing_orphans force row level security;
revoke all on public.billing_orphans from anon, authenticated;

create or replace function public.billing_record_orphan(
  p_kind text,
  p_razorpay_id text,
  p_user uuid,
  p_event text,
  p_amount numeric,
  p_action text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.billing_orphans (kind, razorpay_id, user_id, event, amount_inr, action)
  values (p_kind, p_razorpay_id, p_user, p_event, p_amount, coalesce(p_action, 'recorded'));
$$;
revoke all on function public.billing_record_orphan(text, text, uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.billing_record_orphan(text, text, uuid, text, numeric, text)
  to service_role;

-- A paid subscription whose account now stores a different one (a second checkout replaced
-- it) is attached back, but only when the account has nothing live of its own. True when it was.
create or replace function public.billing_adopt(p_user uuid, p_plan text, p_subscription text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.billing_plans p where p.id = p_plan) then
    return false;
  end if;
  update public.subscriptions s
  set billing_plan = p_plan,
      billing_kind = 'subscription',
      razorpay_subscription_id = p_subscription,
      razorpay_status = 'created',
      cancel_at_period_end = false
  where s.user_id = p_user
    and (
      s.razorpay_subscription_id is null
      or s.razorpay_status is null
      or s.billing_kind = 'once'
      or s.razorpay_status in ('created', 'cancelled', 'completed', 'expired')
    );
  return found;
end;
$$;
revoke all on function public.billing_adopt(uuid, text, text) from public, anon, authenticated;
grant execute on function public.billing_adopt(uuid, text, text) to service_role;

-- Anyone who already holds a name that is now reserved keeps it; the owner sees who.
select u.user_id, u.username
from public.usernames u
where public.community_reserved(u.username);
