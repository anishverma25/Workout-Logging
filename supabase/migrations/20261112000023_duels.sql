-- Duels in a group (November 2026): one member challenges another for the week. The winner is
-- whoever has more points on the group's own weekly score (community_scores), so there is no new
-- scoring to explain. Same privacy as the boards: only usernames and points leave the server,
-- and only for members of the group. Safe to run more than once.

create table if not exists public.group_duels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  challenger uuid not null references auth.users (id) on delete cascade,
  opponent uuid not null references auth.users (id) on delete cascade,
  -- Monday of the week it runs, India time.
  week_start date not null,
  -- Frozen when the week is over: both scores and the winner (null for a tie).
  challenger_score integer,
  opponent_score integer,
  winner uuid references auth.users (id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check (challenger <> opponent)
);
create unique index if not exists group_duels_pair_idx on public.group_duels
  (group_id, week_start, least(challenger, opponent), greatest(challenger, opponent));
create index if not exists group_duels_group_idx on public.group_duels (group_id, week_start);

-- No direct access: everything goes through the functions below.
alter table public.group_duels enable row level security;
alter table public.group_duels force row level security;
revoke all on public.group_duels from anon, authenticated;

-- The most duels one person can start for one week.
create or replace function public.duel_limit() returns integer
language sql immutable set search_path = '' as $$ select 3 $$;

create or replace function public.create_duel(p_group uuid, p_username text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  other uuid;
  wk date;
  started integer;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = uid) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  select un.user_id into other
  from public.usernames un
  join public.group_members m on m.user_id = un.user_id and m.group_id = p_group
  where un.username = lower(btrim(coalesce(p_username, '')));
  if other is null then
    raise exception 'No member with that username' using errcode = '22023';
  end if;
  if other = uid then
    raise exception 'Duel yourself' using errcode = '22023';
  end if;
  select b.starts_on into wk from public.community_bounds('week', 0) b;
  if exists (
    select 1 from public.group_duels d
    where d.group_id = p_group and d.week_start = wk
      and least(d.challenger, d.opponent) = least(uid, other)
      and greatest(d.challenger, d.opponent) = greatest(uid, other)
  ) then
    raise exception 'Duel exists' using errcode = '23505';
  end if;
  select count(*)::int into started from public.group_duels d
  where d.challenger = uid and d.week_start = wk;
  if started >= public.duel_limit() then
    raise exception 'Duel limit %', public.duel_limit() using errcode = '22023';
  end if;
  insert into public.group_duels (group_id, challenger, opponent, week_start)
  values (p_group, uid, other, wk)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'week_start', wk);
end;
$$;
revoke all on function public.create_duel(uuid, text) from public, anon;
grant execute on function public.create_duel(uuid, text) to authenticated;

-- Either of the two can call a duel off while its week is still running.
create or replace function public.cancel_duel(p_duel uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wk date;
  gone integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select b.starts_on into wk from public.community_bounds('week', 0) b;
  delete from public.group_duels d
  where d.id = p_duel and uid in (d.challenger, d.opponent) and d.week_start = wk;
  get diagnostics gone = row_count;
  return gone > 0;
end;
$$;
revoke all on function public.cancel_duel(uuid) from public, anon;
grant execute on function public.cancel_duel(uuid) to authenticated;

-- This week's duels (live points) and last week's (frozen the first time they are read).
create or replace function public.get_group_duels(p_group uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur record;
  prev record;
  d record;
  s record;
  out_rows jsonb := '[]'::jsonb;
  c_score integer;
  o_score integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = uid) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  select * into cur from public.community_bounds('week', 0);
  select * into prev from public.community_bounds('week', -1);

  -- Last week's duels are settled once, from the same scores the board froze.
  for d in
    select * from public.group_duels g
    where g.group_id = p_group and g.week_start = prev.starts_on and g.settled_at is null
  loop
    c_score := 0;
    o_score := 0;
    for s in
      select sc.user_id, sc.score from public.community_scores(
        array[d.challenger, d.opponent], prev.from_ts, prev.to_ts) sc
    loop
      if s.user_id = d.challenger then c_score := s.score; else o_score := s.score; end if;
    end loop;
    update public.group_duels set
      challenger_score = c_score,
      opponent_score = o_score,
      winner = case when c_score > o_score then d.challenger
                    when o_score > c_score then d.opponent else null end,
      settled_at = now()
    where id = d.id;
  end loop;

  for d in
    select g.*, cu.username as challenger_name, ou.username as opponent_name
    from public.group_duels g
    join public.usernames cu on cu.user_id = g.challenger
    join public.usernames ou on ou.user_id = g.opponent
    where g.group_id = p_group and g.week_start in (cur.starts_on, prev.starts_on)
    order by g.week_start desc, g.created_at asc
  loop
    if d.week_start = cur.starts_on then
      c_score := 0;
      o_score := 0;
      for s in
        select sc.user_id, sc.score from public.community_scores(
          array[d.challenger, d.opponent], cur.from_ts, cur.to_ts) sc
      loop
        if s.user_id = d.challenger then c_score := s.score; else o_score := s.score; end if;
      end loop;
    else
      c_score := coalesce(d.challenger_score, 0);
      o_score := coalesce(d.opponent_score, 0);
    end if;
    out_rows := out_rows || jsonb_build_object(
      'id', d.id,
      'week_start', d.week_start,
      'live', d.week_start = cur.starts_on,
      'challenger', d.challenger_name,
      'opponent', d.opponent_name,
      'challenger_score', c_score,
      'opponent_score', o_score,
      'mine', uid in (d.challenger, d.opponent),
      'i_am_challenger', uid = d.challenger
    );
  end loop;
  return jsonb_build_object(
    'week_start', cur.starts_on,
    'ends_on', (cur.to_ts at time zone 'Asia/Kolkata')::date - 1,
    'limit', public.duel_limit(),
    'duels', out_rows
  );
end;
$$;
revoke all on function public.get_group_duels(uuid) from public, anon;
grant execute on function public.get_group_duels(uuid) to authenticated;

-- Leaving a group ends the duels in it that have not been settled.
create or replace function public.group_duels_after_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_duels d
  where d.group_id = old.group_id and old.user_id in (d.challenger, d.opponent)
    and d.settled_at is null;
  return old;
end;
$$;
drop trigger if exists group_members_end_duels on public.group_members;
create trigger group_members_end_duels after delete on public.group_members
  for each row execute function public.group_duels_after_leave();
