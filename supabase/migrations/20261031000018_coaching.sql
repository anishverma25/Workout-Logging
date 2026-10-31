-- 1:1 coaching (November 2026): a monthly plan at Rs 999 that includes Pro for the month and a
-- personal coach on calls and WhatsApp. It is bought through the same Razorpay checkout as Pro
-- (a renewing subscription, or one payment for one month). Safe to run more than once. Run it
-- in the SQL editor before the app version that needs it is deployed.
--
-- After creating the Razorpay plan (Rs 999, monthly), connect it:
--   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'coach_monthly';
-- Set the coach shown to members (the number only ever goes to paying members):
--   update public.app_settings set coach_name = 'Coach name', coach_whatsapp = '919876543210';
-- Read who joined and what they told the coach: docs/admin-coaching.md.

-- Plans are Pro plans or coaching plans; the Pro page shows only Pro plans.
alter table public.billing_plans add column if not exists kind text not null default 'pro';
alter table public.billing_plans drop constraint if exists billing_plans_kind_check;
alter table public.billing_plans add constraint billing_plans_kind_check
  check (kind in ('pro', 'coaching'));

insert into public.billing_plans (id, label, months, price_inr, total_count, sort, kind)
values ('coach_monthly', '1:1 coaching', 1, 999, 120, 10, 'coaching')
on conflict (id) do nothing;

-- Coaching has its own end date: someone with a year of Pro who adds a month of coaching gets
-- one month of coaching, not twelve.
alter table public.subscriptions add column if not exists coaching_expires_at timestamptz;

-- Who coaches, shown only to members with coaching.
alter table public.app_settings add column if not exists coach_name text
  check (coach_name is null or char_length(coach_name) between 1 and 60);
alter table public.app_settings add column if not exists coach_whatsapp text
  check (coach_whatsapp is null or coach_whatsapp ~ '^[1-9][0-9]{9,14}$');

-- What a member tells the coach when they join. One row per account, edited in place.
create table if not exists public.coaching_intake (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null check (phone ~ '^\+?[0-9 ]{10,16}$'),
  goal text not null check (char_length(goal) between 1 and 500),
  schedule text not null default '' check (char_length(schedule) <= 300),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coaching_intake enable row level security;
alter table public.coaching_intake force row level security;
drop policy if exists coaching_intake_select_own on public.coaching_intake;
create policy coaching_intake_select_own on public.coaching_intake for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.coaching_intake from anon, authenticated;

-- Plans, now saying what kind each is.
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
    'once_price_inr', coalesce(p.once_price_inr, p.price_inr),
    'kind', p.kind,
    'available', p.razorpay_plan_id is not null
  ) order by p.sort), '[]'::jsonb)
  from public.billing_plans p
  where p.active;
$$;
revoke all on function public.get_billing_plans() from public;
grant execute on function public.get_billing_plans() to anon, authenticated;

-- The signed-in user's access, now with the end of their coaching.
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
    'billing_kind', s.billing_kind,
    'billing_status', s.razorpay_status,
    'cancel_at_period_end', s.cancel_at_period_end,
    'coaching_expires_at', s.coaching_expires_at
  )
  into result
  from public.subscriptions s
  where s.user_id = uid;
  return result;
end;
$$;
revoke all on function public.get_my_subscription() from public, anon;
grant execute on function public.get_my_subscription() to authenticated;

-- A renewing payment was confirmed: Pro to the period end, and coaching too when the
-- subscription is a coaching plan.
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
  update public.subscriptions s
  set status = 'active',
      razorpay_status = p_status,
      pro_started_at = case
        when s.pro_expires_at is not null and s.pro_expires_at > now() then s.pro_started_at
        else now()
      end,
      pro_expires_at = greatest(coalesce(s.pro_expires_at, now()), p_period_end),
      coaching_expires_at = case
        when exists (
          select 1 from public.billing_plans p where p.id = s.billing_plan and p.kind = 'coaching'
        )
        then greatest(coalesce(s.coaching_expires_at, now()), p_period_end)
        else s.coaching_expires_at
      end
  where s.razorpay_subscription_id = p_subscription
  returning s.user_id into uid;
  return uid;
end;
$$;
revoke all on function public.billing_activate(text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.billing_activate(text, timestamptz, text) to service_role;

-- A single payment was made: add the plan's months to Pro, once; a coaching plan adds the same
-- months of coaching.
create or replace function public.billing_order_paid(p_order text, p_payment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.billing_orders;
  v_months integer;
  v_kind text;
  applied boolean := false;
  expires timestamptz;
begin
  select * into o from public.billing_orders where id = p_order for update;
  if not found then
    return null;
  end if;
  if o.status = 'created' then
    select p.months, p.kind into v_months, v_kind from public.billing_plans p where p.id = o.plan;
    update public.billing_orders
    set status = 'paid', payment_id = p_payment, paid_at = now()
    where id = o.id;
    update public.subscriptions s
    set status = 'active',
        billing_plan = o.plan,
        billing_kind = 'once',
        cancel_at_period_end = false,
        pro_started_at = case
          when s.pro_expires_at is not null and s.pro_expires_at > now() then s.pro_started_at
          else now()
        end,
        pro_expires_at = greatest(coalesce(s.pro_expires_at, now()), now())
          + make_interval(months => v_months),
        coaching_expires_at = case
          when v_kind = 'coaching'
          then greatest(coalesce(s.coaching_expires_at, now()), now())
            + make_interval(months => v_months)
          else s.coaching_expires_at
        end
    where s.user_id = o.user_id;
    if not found then
      raise exception 'No subscription row for this account' using errcode = 'P0002';
    end if;
    applied := true;
  end if;
  select s.pro_expires_at into expires from public.subscriptions s where s.user_id = o.user_id;
  return jsonb_build_object('applied', applied, 'user_id', o.user_id, 'pro_expires_at', expires);
end;
$$;
revoke all on function public.billing_order_paid(text, text) from public, anon, authenticated;
grant execute on function public.billing_order_paid(text, text) to service_role;

-- The signed-in member's coaching: whether it is on, until when, who the coach is (only while
-- it is on) and what they told the coach.
create or replace function public.get_my_coaching()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  until timestamptz;
  active boolean;
  a public.app_settings;
  i public.coaching_intake;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select s.coaching_expires_at into until from public.subscriptions s where s.user_id = uid;
  active := until is not null and until > now();
  select * into a from public.app_settings where id;
  select * into i from public.coaching_intake where user_id = uid;
  return jsonb_build_object(
    'active', active,
    'expires_at', until,
    'coach_name', case when active then a.coach_name end,
    'coach_whatsapp', case when active then a.coach_whatsapp end,
    'intake', case when i.user_id is null then null else jsonb_build_object(
      'phone', i.phone,
      'goal', i.goal,
      'schedule', i.schedule,
      'notes', i.notes,
      'updated_at', i.updated_at
    ) end
  );
end;
$$;
revoke all on function public.get_my_coaching() from public, anon;
grant execute on function public.get_my_coaching() to authenticated;

-- A member tells the coach how to reach them and what they want. Only while coaching is on.
create or replace function public.submit_coaching_intake(
  p_phone text,
  p_goal text,
  p_schedule text,
  p_notes text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+ ]', '', 'g');
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.subscriptions s where s.user_id = uid and s.coaching_expires_at > now()
  ) then
    raise exception 'Coaching is not active on this account' using errcode = '42501';
  end if;
  insert into public.coaching_intake (user_id, phone, goal, schedule, notes)
  values (uid, btrim(phone), btrim(coalesce(p_goal, '')), btrim(coalesce(p_schedule, '')),
          btrim(coalesce(p_notes, '')))
  on conflict (user_id) do update set
    phone = excluded.phone,
    goal = excluded.goal,
    schedule = excluded.schedule,
    notes = excluded.notes,
    updated_at = now();
  return true;
end;
$$;
revoke all on function public.submit_coaching_intake(text, text, text, text) from public, anon;
grant execute on function public.submit_coaching_intake(text, text, text, text) to authenticated;
