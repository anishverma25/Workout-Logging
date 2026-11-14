-- Privacy and community for a public launch (November 2026, Fable review batch 12).
--
-- 1. Everyone chooses how they appear on the public leaderboard: by name, by username, by
--    initials, or not at all. Hidden people still see their own standing. Photos only for name
--    or username.
-- 2. Reports: report_content stores a report of a person or a group for the owner (no direct
--    access). A person removed from a group cannot rejoin it with the same code.
-- 3. Words nobody may use in a username or a group name, in one function the owner can edit.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------------------------
-- 1. How people appear on the public board
-- ---------------------------------------------------------------------------------------------

alter table public.leaderboard_prefs add column if not exists name_style text not null
  default 'name' check (name_style in ('name', 'username', 'initials', 'hidden'));
-- When they answered the one-time question. Null: not asked yet.
alter table public.leaderboard_prefs add column if not exists style_chosen_at timestamptz;

create or replace function public.community_name_style(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select lp.name_style from public.leaderboard_prefs lp where lp.user_id = p_user),
    'name'
  );
$$;
revoke all on function public.community_name_style(uuid) from public, anon, authenticated;

-- "Anish Verma" -> "A. V."
create or replace function public.community_initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      (select string_agg(upper(left(w, 1)) || '.', ' ')
       from unnest(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+')) as w
       where w <> ''),
      ''
    ),
    'M.'
  );
$$;

create or replace function public.community_global_public(p_row jsonb, p_me uuid, p_photo boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with who as (
    select
      (p_row ->> 'user_id')::uuid as id,
      public.community_name_style((p_row ->> 'user_id')::uuid) as style,
      coalesce(
        (select pr.display_name from public.profiles pr
         where pr.user_id = (p_row ->> 'user_id')::uuid and pr.deleted_at is null
         order by pr.updated_at desc limit 1),
        'Macrotrophy member'
      ) as display,
      (select u.username from public.usernames u
       where u.user_id = (p_row ->> 'user_id')::uuid) as uname
  )
  select jsonb_build_object(
    'rank', (p_row ->> 'rank')::int,
    'name', case
      when who.style = 'initials' then public.community_initials(who.display)
      when who.style = 'username' and who.uname is not null then who.uname
      else who.display
    end,
    'username', case
      when who.style = 'initials' then null
      when who.style = 'username' then who.uname
      when exists (
        select 1 from public.leaderboard_prefs lp where lp.user_id = who.id and lp.show_username
      ) then who.uname
    end,
    'avatar', case when p_photo and who.style in ('name', 'username') then (
      select pr.avatar from public.profiles pr
      where pr.user_id = who.id and pr.deleted_at is null and pr.avatar is not null
      order by pr.updated_at desc limit 1
    ) end,
    'me', who.id = p_me,
    'score', (p_row ->> 'score')::int,
    'workouts', (p_row ->> 'workouts')::int,
    'hard_sets', (p_row ->> 'hard_sets')::int,
    'records', (p_row ->> 'records')::int,
    'protein_days', (p_row ->> 'protein_days')::int,
    'consistency_weeks', coalesce((p_row ->> 'consistency_weeks')::int, 0),
    'progress_points', coalesce((p_row ->> 'progress_points')::int, 0),
    'pro', coalesce((p_row ->> 'pro')::boolean, false)
  )
  from who;
$$;
revoke all on function public.community_global_public(jsonb, uuid, boolean) from public, anon, authenticated;

-- The board as one person sees it: everyone who shows on it, plus themselves, ranked again so
-- nobody hidden leaves a gap.
create or replace function public.community_visible_rows(p_rows jsonb, p_me uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_set(v.r, '{rank}', to_jsonb(v.new_rank)) order by v.n
  ), '[]'::jsonb)
  from (
    select e.r, e.n,
      rank() over (order by (e.r ->> 'rank')::int) as new_rank
    from jsonb_array_elements(p_rows) with ordinality as e (r, n)
    where (e.r ->> 'user_id')::uuid = p_me
      or public.community_name_style((e.r ->> 'user_id')::uuid) <> 'hidden'
  ) v;
$$;
revoke all on function public.community_visible_rows(jsonb, uuid) from public, anon, authenticated;

create or replace function public.get_global_board(p_period text, p_offset integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g record;
  shown jsonb;
  mine jsonb;
  top jsonb;
  prefs record;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into g from public.community_global_rows(p_period, p_offset);
  shown := public.community_visible_rows(g.rows, uid);
  select r into mine from jsonb_array_elements(shown) r where (r ->> 'user_id')::uuid = uid;
  -- Someone hidden sees their own place, but is not in the list others see, nor in theirs.
  select coalesce(jsonb_agg(
      public.community_global_public(e.r, uid, (e.r ->> 'rank')::int <= 3
        or (e.r ->> 'user_id')::uuid = uid)
      order by e.n
    ), '[]'::jsonb)
  into top
  from jsonb_array_elements(shown) with ordinality as e (r, n)
  where e.n <= 100
    and ((e.r ->> 'user_id')::uuid <> uid or public.community_name_style(uid) <> 'hidden');
  select lp.show_username, lp.share_routine, lp.name_style, lp.style_chosen_at
  into prefs from public.leaderboard_prefs lp where lp.user_id = uid;
  return jsonb_build_object(
    'period', p_period,
    'starts_on', g.starts_on,
    'ends_on', g.ends_on,
    'locked', p_offset < 0,
    'total', (
      select count(*) from jsonb_array_elements(shown) r
      where (r ->> 'user_id')::uuid <> uid or public.community_name_style(uid) <> 'hidden'
    ),
    'rows', top,
    'mine', case when mine is null then null
      else public.community_global_public(mine, uid, true) end,
    'show_username', coalesce(prefs.show_username, false),
    'has_username', exists (select 1 from public.usernames u where u.user_id = uid),
    'share_routine', coalesce(prefs.share_routine, true),
    'name_style', coalesce(prefs.name_style, 'name'),
    'style_chosen', prefs.style_chosen_at is not null
  );
end;
$$;
revoke all on function public.get_global_board(text, integer) from public, anon;
grant execute on function public.get_global_board(text, integer) to authenticated;

create or replace function public.get_my_global_standing()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g record;
  shown jsonb;
  mine jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into g from public.community_global_rows('week', 0);
  shown := public.community_visible_rows(g.rows, uid);
  select r into mine from jsonb_array_elements(shown) r where (r ->> 'user_id')::uuid = uid;
  return jsonb_build_object(
    'rank', (mine ->> 'rank')::int,
    'score', coalesce((mine ->> 'score')::int, 0),
    'total', jsonb_array_length(shown)
  );
end;
$$;
revoke all on function public.get_my_global_standing() from public, anon;
grant execute on function public.get_my_global_standing() to authenticated;

-- The one-time question, and changing it later in Groups.
create or replace function public.set_leaderboard_style(p_style text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_style not in ('name', 'username', 'initials', 'hidden') then
    raise exception 'Unknown style' using errcode = '22023';
  end if;
  insert into public.leaderboard_prefs (user_id, name_style, style_chosen_at, show_username)
  values (uid, p_style, now(), p_style = 'username')
  on conflict (user_id) do update
    set name_style = excluded.name_style,
        style_chosen_at = now(),
        show_username = excluded.show_username,
        updated_at = now();
  return p_style;
end;
$$;
revoke all on function public.set_leaderboard_style(text) from public, anon;
grant execute on function public.set_leaderboard_style(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Reports, and no rejoining after being removed
-- ---------------------------------------------------------------------------------------------

create table if not exists public.content_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('person', 'group')),
  -- A username or a group id.
  target text not null check (char_length(target) between 1 and 80),
  reason text not null check (reason in ('name', 'photo', 'cheating', 'harassment', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
alter table public.content_reports enable row level security;
alter table public.content_reports force row level security;
revoke all on public.content_reports from anon, authenticated;

create or replace function public.report_content(
  p_kind text,
  p_target text,
  p_reason text,
  p_note text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if (select count(*) from public.content_reports r
      where r.reporter = uid and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many reports today' using errcode = 'P0001';
  end if;
  insert into public.content_reports (reporter, kind, target, reason, note)
  values (uid, p_kind, btrim(coalesce(p_target, '')), p_reason, left(btrim(coalesce(p_note, '')), 500));
  return true;
end;
$$;
revoke all on function public.report_content(text, text, text, text) from public, anon;
grant execute on function public.report_content(text, text, text, text) to authenticated;

create table if not exists public.group_bans (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_bans enable row level security;
alter table public.group_bans force row level security;
revoke all on public.group_bans from anon, authenticated;

create or replace function public.remove_group_member(p_group uuid, p_username text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  perform public.community_require_admin(p_group);
  select u.user_id into target from public.usernames u
  where u.username = public.community_clean_username(p_username);
  if target is null or target = auth.uid() then
    return false;
  end if;
  delete from public.group_members m where m.group_id = p_group and m.user_id = target;
  if not found then
    return false;
  end if;
  -- Removed means removed: the same code does not let them back in.
  insert into public.group_bans (group_id, user_id) values (p_group, target)
  on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.remove_group_member(uuid, text) from public, anon;
grant execute on function public.remove_group_member(uuid, text) to authenticated;

-- Joining checks the ban before anything else; the rest is unchanged from 0027.
create or replace function public.community_not_banned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.group_bans b where b.group_id = new.group_id and b.user_id = new.user_id
  ) then
    raise exception 'You were removed from this group' using errcode = 'P0005';
  end if;
  return new;
end;
$$;
drop trigger if exists group_members_not_banned on public.group_members;
create trigger group_members_not_banned before insert on public.group_members
  for each row execute function public.community_not_banned();

-- ---------------------------------------------------------------------------------------------
-- 3. Words nobody may use in a username or a group name
-- ---------------------------------------------------------------------------------------------

-- Edit this list to add or remove words. Matching ignores case, dots, underscores and spaces.
create or replace function public.community_blocked(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]', '', 'g') ~ (
    'fuck|shit|bitch|bastard|cunt|pussy|porn|nude|rape|nazi|hitler|' ||
    'chutiya|chutiye|madarchod|behenchod|bhenchod|bhosdi|bhosda|gandu|randi|harami|lauda|lavda|' ||
    'terrorist'
  );
$$;

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
    or p_name like 'macrotrophy%'
    or public.community_blocked(p_name);
$$;
revoke all on function public.community_reserved(text) from public, anon, authenticated;

create or replace function public.community_clean_group_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.community_blocked(new.name) then
    raise exception 'Choose a different group name' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists groups_clean_name on public.groups;
create trigger groups_clean_name before insert or update of name on public.groups
  for each row execute function public.community_clean_group_name();
