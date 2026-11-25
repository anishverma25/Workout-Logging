-- Codes on every payment (November 2026, owner request): influencer codes, MACROTROPHY and any
-- new code give their discount every time a member pays with them, not only once. Once-only
-- codes stay once per account: EARLY15 (and any code marked early_members_only), or any code the
-- owner sets `reusable = false`. Autopay: a code still takes its percent off the first charge of
-- each new autopay (the billing function is unchanged); renewals charge the plan's price.
--
-- coupon_uses now keeps one row per payment, so the owner sees whose code every payment used:
--   select * from public.coupon_payments;          -- every payment with a code
--   select * from public.coupon_report;            -- per code: payments, members, discount
--
-- Safe to run more than once.

alter table public.coupons add column if not exists reusable boolean not null default true;
update public.coupons set reusable = false where early_members_only and reusable;

-- One row per payment instead of one per account.
alter table public.coupon_uses add column if not exists id bigint generated always as identity;
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.coupon_uses'::regclass and contype = 'p'
      and conname = 'coupon_uses_pkey'
      and pg_get_constraintdef(oid) like '%(user_id)%'
  ) then
    alter table public.coupon_uses drop constraint coupon_uses_pkey;
    alter table public.coupon_uses add constraint coupon_uses_pkey primary key (id);
  end if;
end;
$$;
-- The same payment confirmed twice (checkout and webhook) is recorded once.
create unique index if not exists coupon_uses_user_payment_key on public.coupon_uses (user_id, payment_ref);
create index if not exists coupon_uses_user_idx on public.coupon_uses (user_id, used_at desc);

-- Records a code used on a payment. False when this payment was already recorded, or the code
-- is once-only and this account has used it.
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
declare c public.coupons;
begin
  select * into c from public.coupons where code = p_code;
  if not found then
    return false;
  end if;
  if not c.reusable
     and exists (select 1 from public.coupon_uses u where u.user_id = p_user and u.code = p_code) then
    return false;
  end if;
  insert into public.coupon_uses (user_id, code, payment_ref, discount_inr)
  values (p_user, p_code, p_ref, greatest(coalesce(p_discount, 0), 0))
  on conflict (user_id, payment_ref) do nothing;
  return found;
end;
$$;
revoke all on function public.billing_coupon_redeem(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.billing_coupon_redeem(uuid, text, text, numeric) to service_role;

-- A single payment was made: as in 0024, with a code recorded on every payment.
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
        -- A once-only code (EARLY15) is recorded once per account.
        and (
          (select c.reusable from public.coupons c where c.code = o.coupon_code)
          or not exists (select 1 from public.coupon_uses x where x.user_id = o.user_id and x.code = o.coupon_code)
        )
      on conflict (user_id, payment_ref) do nothing;
    end if;
    applied := true;
  end if;
  select s.pro_expires_at into expires from public.subscriptions s where s.user_id = o.user_id;
  return jsonb_build_object('applied', applied, 'user_id', o.user_id, 'pro_expires_at', expires);
end;
$$;
revoke all on function public.billing_order_paid(text, text) from public, anon, authenticated;
grant execute on function public.billing_order_paid(text, text) to service_role;

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
  if c.early_members_only and not exists (
    select 1 from public.subscriptions s where s.user_id = p_user and s.early_member
  ) then
    return jsonb_build_object('ok', false, 'reason', 'early_only');
  end if;
  -- Influencer and brand codes work on every payment; a once-only code (EARLY15) once per account.
  if not c.reusable
     and exists (select 1 from public.coupon_uses u where u.user_id = p_user and u.code = c.code) then
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

-- The early member's code shows until they have used it (other codes no longer hide it).
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
    'coaching_expires_at', s.coaching_expires_at,
    'legacy_price', s.legacy_price and s.billing_kind = 'subscription',
    'early_code', case
      when s.early_member
        and not exists (
          select 1 from public.coupon_uses u join public.coupons c on c.code = u.code
          where u.user_id = uid and c.early_members_only
        )
      then (
        select c.code from public.coupons c
        where c.early_members_only and c.active
          and (c.expires_at is null or c.expires_at > now())
        order by c.created_at desc
        limit 1
      )
    end,
    'early_percent', case
      when s.early_member
        and not exists (
          select 1 from public.coupon_uses u join public.coupons c on c.code = u.code
          where u.user_id = uid and c.early_members_only
        )
      then (
        select c.percent from public.coupons c
        where c.early_members_only and c.active
          and (c.expires_at is null or c.expires_at > now())
        order by c.created_at desc
        limit 1
      )
    end
  )
  into result
  from public.subscriptions s
  where s.user_id = uid;
  return result;
end;
$$;
revoke all on function public.get_my_subscription() from public, anon;
grant execute on function public.get_my_subscription() to authenticated;

-- Per code: payments, different members, discount given.
create or replace view public.coupon_report
with (security_invoker = true) as
  select
    c.code,
    c.percent,
    c.active,
    c.note,
    count(u.user_id)::int as times_used,
    coalesce(sum(u.discount_inr), 0)::numeric(10, 2) as discount_given_inr,
    max(u.used_at) as last_used_at,
    c.max_uses,
    c.expires_at,
    c.created_at,
    count(distinct u.user_id)::int as members,
    c.reusable
  from public.coupons c
  left join public.coupon_uses u on u.code = c.code
  group by c.code
  order by times_used desc, c.created_at;
revoke all on public.coupon_report from anon, authenticated;

-- Every payment made with a code: whose code (the note you gave it), who paid, for what.
create or replace view public.coupon_payments
with (security_invoker = true) as
  select
    u.used_at as paid_at,
    u.code,
    c.note as code_owner,
    c.percent,
    a.email as member_email,
    (select x.username from public.usernames x where x.user_id = u.user_id) as member_username,
    coalesce(o.plan, s.billing_plan) as plan,
    case when o.id is not null then 'pay once' else 'autopay' end as kind,
    o.amount_inr as paid_inr,
    u.discount_inr,
    u.payment_ref,
    o.payment_id as razorpay_payment_id
  from public.coupon_uses u
  join public.coupons c on c.code = u.code
  join auth.users a on a.id = u.user_id
  left join public.billing_orders o on o.id = u.payment_ref
  left join public.subscriptions s on s.user_id = u.user_id and o.id is null
  order by u.used_at desc;
revoke all on public.coupon_payments from public, anon, authenticated, service_role;
