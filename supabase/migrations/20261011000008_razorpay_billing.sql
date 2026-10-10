-- Pro subscriptions with Razorpay (October 2026).
--
-- Plans and their prices live in billing_plans, so a price change is one update plus a new
-- Razorpay plan, with no app release. Payments are confirmed only on the server: the `billing`
-- Edge Function verifies Razorpay's signatures with secrets the app never sees, then calls the
-- billing_* functions below, which only the service role may run.
--
-- After creating the plans in the Razorpay dashboard, connect them (SQL editor):
--   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'monthly';
--   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'quarterly';
--   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'yearly';

create table public.billing_plans (
  id text primary key check (id ~ '^[a-z_]{2,30}$'),
  label text not null,
  months integer not null check (months between 1 and 36),
  price_inr numeric(10, 2) not null check (price_inr > 0),
  -- Billing cycles Razorpay may charge before the subscription completes.
  total_count integer not null check (total_count between 1 and 120),
  razorpay_plan_id text unique check (razorpay_plan_id is null or razorpay_plan_id ~ '^plan_[A-Za-z0-9]+$'),
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.billing_plans enable row level security;
alter table public.billing_plans force row level security;
revoke all on public.billing_plans from anon, authenticated;

insert into public.billing_plans (id, label, months, price_inr, total_count, sort) values
  ('monthly', 'Monthly', 1, 29, 120, 1),
  ('quarterly', '3 months', 3, 69, 40, 2),
  ('yearly', 'Yearly', 12, 249, 10, 3)
on conflict (id) do nothing;

-- The Razorpay side of each account's subscription.
alter table public.subscriptions
  add column billing_plan text references public.billing_plans (id),
  add column razorpay_subscription_id text unique,
  add column razorpay_status text check (
    razorpay_status is null or razorpay_status in (
      'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
    )
  ),
  add column cancel_at_period_end boolean not null default false;

-- Webhook deliveries already handled, so a retried delivery never applies twice.
create table public.billing_events (
  id text primary key,
  event text not null,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;
revoke all on public.billing_events from anon, authenticated;

-- Plans for the Pro page. `available` is true once a Razorpay plan is connected.
create or replace function public.get_billing_plans()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'label', p.label,
    'months', p.months,
    'price_inr', p.price_inr,
    'available', p.razorpay_plan_id is not null
  ) order by p.sort), '[]'::jsonb)
  from public.billing_plans p
  where p.active;
$$;
revoke all on function public.get_billing_plans() from public;
grant execute on function public.get_billing_plans() to anon, authenticated;

-- The signed-in user's access, now with their plan and whether it renews.
create or replace function public.get_my_subscription()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ended timestamptz := (select a.early_access_ended_at from public.app_settings a where a.id);
  result jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'status', s.status,
    'trial_started_at', s.trial_started_at,
    'trial_expires_at', s.trial_expires_at,
    'pro_started_at', s.pro_started_at,
    'pro_expires_at', s.pro_expires_at,
    'payment_reference', s.payment_reference,
    'payment_submitted_at', s.payment_submitted_at,
    'updated_at', s.updated_at,
    'server_now', now(),
    'early_access', ended is null or now() < ended,
    'founding_member', ended is null or s.created_at < ended,
    'billing_plan', s.billing_plan,
    'billing_status', s.razorpay_status,
    'cancel_at_period_end', s.cancel_at_period_end
  )
  into result
  from public.subscriptions s
  where s.user_id = uid;
  return result;
end;
$$;
revoke all on function public.get_my_subscription() from public, anon;
grant execute on function public.get_my_subscription() to authenticated;

-- Service role only, from here on --------------------------------------------------------------

-- What checkout needs for a plan (null fields when the plan does not exist), and the account's
-- current Razorpay state with the months of the plan it is on.
create or replace function public.billing_checkout_info(p_user uuid, p_plan text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan_exists', p.id is not null,
    'razorpay_plan_id', p.razorpay_plan_id,
    'total_count', p.total_count,
    'months', p.months,
    'current_subscription_id', s.razorpay_subscription_id,
    'current_status', s.razorpay_status,
    'current_months', cp.months,
    'cancel_at_period_end', s.cancel_at_period_end,
    'pro_expires_at', s.pro_expires_at
  )
  from public.subscriptions s
  left join public.billing_plans p on p.id = p_plan and p.active
  left join public.billing_plans cp on cp.id = s.billing_plan
  where s.user_id = p_user;
$$;

-- A new Razorpay subscription was created for the account (checkout not finished yet).
create or replace function public.billing_attach(p_user uuid, p_plan text, p_subscription text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set billing_plan = p_plan,
      razorpay_subscription_id = p_subscription,
      razorpay_status = 'created',
      cancel_at_period_end = false
  where user_id = p_user;
  if not found then
    raise exception 'No subscription row for this account' using errcode = 'P0002';
  end if;
end;
$$;

-- A payment went through: Pro runs to the end of the paid period. Never shortens Pro, so a
-- late or repeated event cannot take time away.
create or replace function public.billing_activate(
  p_subscription text,
  p_period_end timestamptz,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if p_period_end is null or p_period_end <= now() then
    raise exception 'Period end must be in the future' using errcode = '22023';
  end if;
  update public.subscriptions
  set status = 'active',
      razorpay_status = p_status,
      pro_started_at = case
        when pro_expires_at is not null and pro_expires_at > now() then pro_started_at
        else now()
      end,
      pro_expires_at = greatest(coalesce(pro_expires_at, now()), p_period_end)
  where razorpay_subscription_id = p_subscription
  returning user_id into uid;
  return uid;
end;
$$;

-- Any other change of state: pending, halted, cancelled, completed. Pro already paid for stays
-- until its end date; nothing here removes it.
create or replace function public.billing_set_status(
  p_subscription text,
  p_status text,
  p_cancel_at_period_end boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  update public.subscriptions
  set razorpay_status = p_status,
      cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end)
  where razorpay_subscription_id = p_subscription
  returning user_id into uid;
  return uid;
end;
$$;

-- True the first time an event id is seen, false for a repeat delivery.
create or replace function public.billing_record_event(p_id text, p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.billing_events (id, event) values (p_id, p_event);
  return true;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.billing_checkout_info(uuid, text) from public, anon, authenticated;
revoke all on function public.billing_attach(uuid, text, text) from public, anon, authenticated;
revoke all on function public.billing_activate(text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.billing_set_status(text, text, boolean) from public, anon, authenticated;
revoke all on function public.billing_record_event(text, text) from public, anon, authenticated;
grant execute on function public.billing_checkout_info(uuid, text) to service_role;
grant execute on function public.billing_attach(uuid, text, text) to service_role;
grant execute on function public.billing_activate(text, timestamptz, text) to service_role;
grant execute on function public.billing_set_status(text, text, boolean) to service_role;
grant execute on function public.billing_record_event(text, text) to service_role;
