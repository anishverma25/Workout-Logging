-- Groups and the early member code (November 2026). Safe to run more than once.
--
-- 1. Groups: one on the free plan (it was three), ten with Pro. Nobody is removed from a group
--    they are already in; the limit applies to creating or joining another.
-- 2. Early members: everyone who had paid Pro time when the prices changed (the 29, 69 and 249
--    rupee plans) is marked once, and gets a code of their own: EARLY15, 15% off their first
--    payment at the new price. Like every code it must be typed, works once per account and on
--    one payment only. Nobody else can use it. There is no discount without a code.
--
--    To end it on a date:  update public.coupons set expires_at = '2026-12-31' where code = 'EARLY15';
--    To rename it: insert a new row with early_members_only = true and set the old one inactive.

create or replace function public.create_group(p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  gid uuid;
  c text;
  limit_n int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.usernames u where u.user_id = uid) then
    raise exception 'Choose a username first' using errcode = 'P0001';
  end if;
  if char_length(clean) not between 1 and 40 then
    raise exception 'Group names are 1 to 40 characters' using errcode = '22023';
  end if;
  limit_n := case when public.community_is_pro(uid) then 10 else 1 end;
  if (select count(*) from public.group_members m where m.user_id = uid) >= limit_n then
    raise exception 'Group limit % reached', limit_n using errcode = 'P0002';
  end if;
  c := public.community_new_code();
  insert into public.groups (name, code, created_by) values (clean, c, uid) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, uid, 'admin');
  return jsonb_build_object('id', gid, 'name', clean, 'code', c);
end;
$$;
revoke all on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;

create or replace function public.join_group(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  g record;
  limit_n int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.usernames u where u.user_id = uid) then
    raise exception 'Choose a username first' using errcode = 'P0001';
  end if;
  select gr.id, gr.name, gr.code into g from public.groups gr where gr.code = clean;
  if g.id is null then
    raise exception 'No group has that code' using errcode = 'P0003';
  end if;
  if exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = uid) then
    return jsonb_build_object('id', g.id, 'name', g.name, 'code', g.code, 'already', true);
  end if;
  limit_n := case when public.community_is_pro(uid) then 10 else 1 end;
  if (select count(*) from public.group_members m where m.user_id = uid) >= limit_n then
    raise exception 'Group limit % reached', limit_n using errcode = 'P0002';
  end if;
  if (select count(*) from public.group_members m where m.group_id = g.id) >= 30 then
    raise exception 'This group is full' using errcode = 'P0004';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, uid);
  return jsonb_build_object('id', g.id, 'name', g.name, 'code', g.code, 'already', false);
end;
$$;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- Early members ---------------------------------------------------------------------------

alter table public.subscriptions add column if not exists early_member boolean not null default false;
alter table public.app_settings add column if not exists early_members_marked_at timestamptz;
alter table public.coupons add column if not exists early_members_only boolean not null default false;

-- Marked once, when this file first runs: accounts with paid Pro time left at that moment.
do $$
begin
  if (select a.early_members_marked_at from public.app_settings a where a.id) is null then
    update public.subscriptions
      set early_member = true
      where pro_expires_at is not null and pro_expires_at > now() and status <> 'revoked';
    update public.app_settings set early_members_marked_at = now() where id;
  end if;
end;
$$;

insert into public.coupons (code, percent, note, early_members_only)
values ('EARLY15', 15, 'Members from before the November 2026 prices', true)
on conflict (code) do nothing;

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

-- The app's view of the account now says which code an early member can still use, so the
-- plans card can tell them. Everything else is as in 0024.
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
        and not exists (select 1 from public.coupon_uses u where u.user_id = uid)
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
        and not exists (select 1 from public.coupon_uses u where u.user_id = uid)
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
