-- Pay once (October 2026): Pro for a fixed period with a single Razorpay payment, no mandate and
-- no renewal. Each payment adds the plan's months on top of any Pro time already left.
--
-- Only the `billing` Edge Function (service role) records these payments, after it has checked
-- Razorpay's signature. The one-time price defaults to the plan's price; to change it:
--   update public.billing_plans set once_price_inr = 79 where id = 'quarterly';
-- (set it back to null to follow price_inr again).

alter table public.billing_plans
  add column once_price_inr numeric(10, 2) check (once_price_inr is null or once_price_inr > 0);

alter table public.subscriptions
  add column billing_kind text check (billing_kind is null or billing_kind in ('subscription', 'once'));

-- Existing Razorpay subscriptions keep working as subscriptions.
update public.subscriptions set billing_kind = 'subscription' where razorpay_subscription_id is not null;

-- One row per one-time Razorpay order. A paid order is applied once, however many times the
-- checkout response and the webhook arrive.
create table public.billing_orders (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null references public.billing_plans (id),
  amount_inr numeric(10, 2) not null check (amount_inr > 0),
  status text not null default 'created' check (status in ('created', 'paid')),
  payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index billing_orders_user_idx on public.billing_orders (user_id);
alter table public.billing_orders enable row level security;
alter table public.billing_orders force row level security;
revoke all on public.billing_orders from anon, authenticated;

-- Subscriptions started from now on say so.
create or replace function public.billing_attach(p_user uuid, p_plan text, p_subscription text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set billing_plan = p_plan,
      billing_kind = 'subscription',
      razorpay_subscription_id = p_subscription,
      razorpay_status = 'created',
      cancel_at_period_end = false
  where user_id = p_user;
  if not found then
    raise exception 'No subscription row for this account' using errcode = 'P0002';
  end if;
end;
$$;

-- Plans for the Pro page: now with the pay-once price, which every active plan has.
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
    'available', p.razorpay_plan_id is not null
  ) order by p.sort), '[]'::jsonb)
  from public.billing_plans p
  where p.active;
$$;
revoke all on function public.get_billing_plans() from public;
grant execute on function public.get_billing_plans() to anon, authenticated;

-- The signed-in user's access, now also saying whether Pro came from a subscription or a
-- single payment.
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

-- Same as before, plus the price of a single payment for the plan.
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
    'once_price_inr', coalesce(p.once_price_inr, p.price_inr),
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

-- A one-time Razorpay order was created for the account (checkout not finished yet).
create or replace function public.billing_order_create(
  p_user uuid,
  p_plan text,
  p_order text,
  p_amount numeric
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.billing_orders (id, user_id, plan, amount_inr)
  values (p_order, p_user, p_plan, p_amount);
$$;

-- The order, only if it belongs to this account. Null otherwise.
create or replace function public.billing_order_info(p_user uuid, p_order text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'status', o.status, 'plan', o.plan)
  from public.billing_orders o
  where o.id = p_order and o.user_id = p_user;
$$;

-- An order was paid: add the plan's months to the account's Pro time, once. Returns null for an
-- order we did not create (Razorpay also sends order.paid for subscription charges), and says
-- whether this call was the one that applied it.
create or replace function public.billing_order_paid(p_order text, p_payment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.billing_orders;
  v_months integer;
  applied boolean := false;
  expires timestamptz;
begin
  select * into o from public.billing_orders where id = p_order for update;
  if not found then
    return null;
  end if;
  if o.status = 'created' then
    select p.months into v_months from public.billing_plans p where p.id = o.plan;
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
          + make_interval(months => v_months)
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

revoke all on function public.billing_attach(uuid, text, text) from public, anon, authenticated;
revoke all on function public.billing_checkout_info(uuid, text) from public, anon, authenticated;
revoke all on function public.billing_order_create(uuid, text, text, numeric) from public, anon, authenticated;
revoke all on function public.billing_order_info(uuid, text) from public, anon, authenticated;
revoke all on function public.billing_order_paid(text, text) from public, anon, authenticated;
grant execute on function public.billing_attach(uuid, text, text) to service_role;
grant execute on function public.billing_checkout_info(uuid, text) to service_role;
grant execute on function public.billing_order_create(uuid, text, text, numeric) to service_role;
grant execute on function public.billing_order_info(uuid, text) to service_role;
grant execute on function public.billing_order_paid(text, text) to service_role;
