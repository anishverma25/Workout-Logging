-- Two more parts of the Free and Pro split (November 2026). Safe to run more than once.
--
-- 1. Groups: one on the free plan (it was three), ten with Pro. Nobody is removed from a group
--    they are already in; the limit applies to creating or joining another.
-- 2. When the free trial ends: 10% off the first Pro payment for 48 hours, once per account. The
--    billing function applies it by itself; the app shows when it ends. A typed coupon code or a
--    food thank-you credit is used instead when one is given.

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

-- The trial offer open for this account now: { percent, ends_at }, or null.
create or replace function public.trial_offer_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('percent', 10, 'ends_at', s.trial_expires_at + interval '48 hours')
  from public.subscriptions s, public.app_settings a
  where s.user_id = p_user and a.id
    and a.early_access_ended_at is not null
    and s.status <> 'revoked'
    and s.trial_expires_at is not null
    and now() >= s.trial_expires_at
    and now() < s.trial_expires_at + interval '48 hours'
    -- Never paid: no paid time ever, and no paid order.
    and s.pro_expires_at is null
    and s.coaching_expires_at is null
    and not exists (select 1 from public.billing_orders o where o.user_id = p_user and o.status = 'paid');
$$;
revoke all on function public.trial_offer_for(uuid) from public, anon, authenticated;
grant execute on function public.trial_offer_for(uuid) to service_role;

-- For the app: the caller's own trial offer, if open.
create or replace function public.get_trial_offer()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  return public.trial_offer_for(auth.uid());
end;
$$;
revoke all on function public.get_trial_offer() from public, anon;
grant execute on function public.get_trial_offer() to authenticated;
