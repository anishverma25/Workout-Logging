-- New prices and coupon codes (November 2026). Safe to run more than once. Run it in the SQL
-- editor before the app version and the `billing` function that need it are deployed.
--
-- Prices: monthly 149, 3 months 399, yearly 1499. These are the prices, with nothing crossed out.
-- Razorpay plans have a fixed amount, so the old plans are disconnected here and autopay for a
-- plan opens again once its new Razorpay plan is connected (docs/razorpay-setup.md):
--   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'monthly';
--   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'quarterly';
--   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'yearly';
-- Pay once works straight away. People already on autopay keep their Razorpay plan and price.
--
-- Coupons: codes the owner makes, 10% off the first payment of a Pro plan, one coupon per
-- account. Make one:
--   insert into public.coupons (code, note) values ('RISHABH10', 'Rishabh''s friends');
-- Optional: percent (1 to 50), expires_at, max_uses. Turn one off:
--   update public.coupons set active = false where code = 'RISHABH10';
-- Who used which code: select * from public.coupon_uses order by used_at desc;

update public.billing_plans
set price_inr = 149, once_price_inr = null, razorpay_plan_id = null, updated_at = now()
where id = 'monthly' and price_inr <> 149;
update public.billing_plans
set price_inr = 399, once_price_inr = null, razorpay_plan_id = null, updated_at = now()
where id = 'quarterly' and price_inr <> 399;
update public.billing_plans
set price_inr = 1499, once_price_inr = null, razorpay_plan_id = null, updated_at = now()
where id = 'yearly' and price_inr <> 1499;

create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  percent integer not null default 10 check (percent between 1 and 50),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
alter table public.coupons force row level security;
revoke all on public.coupons from anon, authenticated;

-- One coupon per account, ever. A row is written only once a payment with it is confirmed.
create table if not exists public.coupon_uses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null references public.coupons (code),
  payment_ref text not null,
  discount_inr numeric(10, 2) not null check (discount_inr >= 0),
  used_at timestamptz not null default now()
);
create index if not exists coupon_uses_code_idx on public.coupon_uses (code);
alter table public.coupon_uses enable row level security;
alter table public.coupon_uses force row level security;
revoke all on public.coupon_uses from anon, authenticated;

alter table public.billing_orders add column if not exists coupon_code text;
alter table public.billing_orders add column if not exists discount_inr numeric(10, 2) not null default 0;

-- Whether a code can be used by this account: { ok, percent } or { ok: false, reason }.
-- Reasons: unknown, ended, used_up, already_used.
create or replace function public.coupon_status(p_user uuid, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  select * into c from public.coupons where code = v_code;
  if not found or not c.active then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'ended');
  end if;
  if exists (select 1 from public.coupon_uses u where u.user_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if c.max_uses is not null
    and (select count(*) from public.coupon_uses u where u.code = c.code) >= c.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'used_up');
  end if;
  return jsonb_build_object('ok', true, 'code', c.code, 'percent', c.percent);
end;
$$;
revoke all on function public.coupon_status(uuid, text) from public, anon, authenticated;
grant execute on function public.coupon_status(uuid, text) to service_role;

-- For the app: checks a code for the signed-in account. It never grants anything; the billing
-- function checks the code again on the server when the payment starts.
create or replace function public.check_coupon(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  return public.coupon_status(uid, p_code);
end;
$$;
revoke all on function public.check_coupon(text) from public, anon;
grant execute on function public.check_coupon(text) to authenticated;

-- Service role only, from here on --------------------------------------------------------------

-- Records that an account used a coupon, once. False when it already had one.
create or replace function public.billing_coupon_redeem(
  p_user uuid,
  p_code text,
  p_ref text,
  p_discount numeric
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.coupons c where c.code = p_code) then
    return false;
  end if;
  insert into public.coupon_uses (user_id, code, payment_ref, discount_inr)
  values (p_user, p_code, p_ref, greatest(coalesce(p_discount, 0), 0))
  on conflict (user_id) do nothing;
  return found;
end;
$$;
revoke all on function public.billing_coupon_redeem(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.billing_coupon_redeem(uuid, text, text, numeric) to service_role;

-- What checkout needs, now with the plan's price and kind and how the account pays today.
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
    'price_inr', p.price_inr,
    'plan_kind', p.kind,
    'once_price_inr', coalesce(p.once_price_inr, p.price_inr),
    'current_subscription_id', s.razorpay_subscription_id,
    'current_status', s.razorpay_status,
    'current_months', cp.months,
    'current_kind', s.billing_kind,
    'cancel_at_period_end', s.cancel_at_period_end,
    'pro_expires_at', s.pro_expires_at
  )
  from public.subscriptions s
  left join public.billing_plans p on p.id = p_plan and p.active
  left join public.billing_plans cp on cp.id = s.billing_plan
  where s.user_id = p_user;
$$;
revoke all on function public.billing_checkout_info(uuid, text) from public, anon, authenticated;
grant execute on function public.billing_checkout_info(uuid, text) to service_role;

-- A one-time order, now with the coupon it was priced with. (The four-argument version stays
-- for the billing function deployed before this migration.)
create or replace function public.billing_order_create(
  p_user uuid,
  p_plan text,
  p_order text,
  p_amount numeric,
  p_coupon text,
  p_discount numeric
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.billing_orders (id, user_id, plan, amount_inr, coupon_code, discount_inr)
  values (p_order, p_user, p_plan, p_amount, p_coupon, coalesce(p_discount, 0));
$$;
revoke all on function public.billing_order_create(uuid, text, text, numeric, text, numeric) from public, anon, authenticated;
grant execute on function public.billing_order_create(uuid, text, text, numeric, text, numeric) to service_role;

-- A single payment was made: as before, plus the coupon it used is recorded, once.
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
    if o.coupon_code is not null then
      insert into public.coupon_uses (user_id, code, payment_ref, discount_inr)
      select o.user_id, o.coupon_code, o.id, o.discount_inr
      where exists (select 1 from public.coupons c where c.code = o.coupon_code)
      on conflict (user_id) do nothing;
    end if;
    applied := true;
  end if;
  select s.pro_expires_at into expires from public.subscriptions s where s.user_id = o.user_id;
  return jsonb_build_object('applied', applied, 'user_id', o.user_id, 'pro_expires_at', expires);
end;
$$;
revoke all on function public.billing_order_paid(text, text) from public, anon, authenticated;
grant execute on function public.billing_order_paid(text, text) to service_role;
