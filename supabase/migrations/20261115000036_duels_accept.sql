-- Duels v2 (November 2026, Fable review Du1 to Du4). Safe to run more than once.
-- - A challenge waits for the opponent to accept. Unanswered ones end with the week and never
--   count against anyone.
-- - Points count from the moment of acceptance (accepted_at) to the end of the week.
-- - Once accepted a duel cannot be called off; either side can forfeit, which is a loss.
-- - Finished duels are settled whenever anyone in the group reads the duels, and the last four
--   weeks stay visible. Leaving the group forfeits open duels; settled ones stay.

-- New columns. Duels made before this migration were live at once, so they count as accepted
-- when they were made (only the first time this runs).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'group_duels' and column_name = 'accepted_at'
  ) then
    alter table public.group_duels add column accepted_at timestamptz;
    update public.group_duels set accepted_at = created_at;
  end if;
end;
$$;
alter table public.group_duels
  add column if not exists forfeited_by uuid references auth.users (id) on delete set null;

-- The week a duel runs in, India time, as timestamps.
create or replace function public.duel_week(p_start date)
returns table (from_ts timestamptz, to_ts timestamptz)
language sql
stable
set search_path = ''
as $$
  select p_start::timestamp at time zone 'Asia/Kolkata',
         (p_start + 7)::timestamp at time zone 'Asia/Kolkata'
$$;
revoke all on function public.duel_week(date) from public, anon, authenticated;

-- One duel's points: from acceptance to the end of its week (or to now while it runs).
create or replace function public.duel_scores(p_duel uuid)
returns table (challenger_score integer, opponent_score integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.group_duels;
  w record;
  s record;
  c integer := 0;
  o integer := 0;
begin
  select * into d from public.group_duels where id = p_duel;
  if d.id is null or d.accepted_at is null then
    return query select 0, 0;
    return;
  end if;
  select * into w from public.duel_week(d.week_start);
  for s in
    select sc.user_id, sc.score from public.community_scores(
      array[d.challenger, d.opponent], greatest(d.accepted_at, w.from_ts), w.to_ts) sc
  loop
    if s.user_id = d.challenger then c := s.score; else o := s.score; end if;
  end loop;
  return query select c, o;
end;
$$;
revoke all on function public.duel_scores(uuid) from public, anon, authenticated;

-- Settles every finished, accepted duel of a group once, and drops challenges nobody answered.
create or replace function public.settle_group_duels(p_group uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cur date;
  d record;
  sc record;
begin
  select b.starts_on into cur from public.community_bounds('week', 0) b;
  delete from public.group_duels g
  where g.group_id = p_group and g.week_start < cur and g.accepted_at is null;
  for d in
    select g.id, g.challenger, g.opponent from public.group_duels g
    where g.group_id = p_group and g.week_start < cur and g.settled_at is null
  loop
    select * into sc from public.duel_scores(d.id);
    update public.group_duels set
      challenger_score = sc.challenger_score,
      opponent_score = sc.opponent_score,
      winner = case when sc.challenger_score > sc.opponent_score then d.challenger
                    when sc.opponent_score > sc.challenger_score then d.opponent else null end,
      settled_at = now()
    where id = d.id;
  end loop;
end;
$$;
revoke all on function public.settle_group_duels(uuid) from public, anon, authenticated;

-- Ends a running duel as a loss for p_user (forfeit or leaving the group).
create or replace function public.forfeit_duel_for(p_duel uuid, p_user uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d public.group_duels;
  sc record;
begin
  select * into d from public.group_duels
  where id = p_duel and p_user in (challenger, opponent)
    and accepted_at is not null and settled_at is null
  for update;
  if d.id is null then
    return false;
  end if;
  select * into sc from public.duel_scores(d.id);
  update public.group_duels set
    challenger_score = sc.challenger_score,
    opponent_score = sc.opponent_score,
    winner = case when p_user = d.challenger then d.opponent else d.challenger end,
    forfeited_by = p_user,
    settled_at = now()
  where id = d.id;
  return true;
end;
$$;
revoke all on function public.forfeit_duel_for(uuid, uuid) from public, anon, authenticated;

-- A challenge. It uses one of the challenger's duels for the week while it waits or runs.
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
  -- Every group counts: the allowance is for the account.
  select count(*)::int into started from public.group_duels d
  where d.challenger = uid and d.week_start = wk;
  if started >= public.duel_limit_for(uid) then
    raise exception 'Duel limit %', public.duel_limit_for(uid) using errcode = '22023';
  end if;
  insert into public.group_duels (group_id, challenger, opponent, week_start)
  values (p_group, uid, other, wk)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'week_start', wk);
end;
$$;
revoke all on function public.create_duel(uuid, text) from public, anon;
grant execute on function public.create_duel(uuid, text) to authenticated;

-- The opponent accepts this week's challenge; points count from now.
create or replace function public.accept_duel(p_duel uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wk date;
  done integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select b.starts_on into wk from public.community_bounds('week', 0) b;
  update public.group_duels d set accepted_at = now()
  where d.id = p_duel and d.opponent = uid and d.accepted_at is null and d.week_start = wk
    and exists (
      select 1 from public.group_members m
      where m.group_id = d.group_id and m.user_id = d.challenger
    );
  get diagnostics done = row_count;
  return done > 0;
end;
$$;
revoke all on function public.accept_duel(uuid) from public, anon;
grant execute on function public.accept_duel(uuid) to authenticated;

-- Before acceptance: the challenger withdraws or the opponent declines. Never after.
create or replace function public.cancel_duel(p_duel uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gone integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.group_duels d
  where d.id = p_duel and uid in (d.challenger, d.opponent) and d.accepted_at is null;
  get diagnostics gone = row_count;
  return gone > 0;
end;
$$;
revoke all on function public.cancel_duel(uuid) from public, anon;
grant execute on function public.cancel_duel(uuid) to authenticated;

-- After acceptance: either side can give up, which counts as a loss.
create or replace function public.forfeit_duel(p_duel uuid)
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
  return public.forfeit_duel_for(p_duel, uid);
end;
$$;
revoke all on function public.forfeit_duel(uuid) from public, anon;
grant execute on function public.forfeit_duel(uuid) to authenticated;

-- This week's duels (waiting or live) and the last four weeks' results.
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
  d record;
  sc record;
  out_rows jsonb := '[]'::jsonb;
  c_score integer;
  o_score integer;
  started integer;
  status text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = uid) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  select * into cur from public.community_bounds('week', 0);
  perform public.settle_group_duels(p_group);

  for d in
    select g.*, cu.username as challenger_name, ou.username as opponent_name,
           wu.username as winner_name
    from public.group_duels g
    join public.usernames cu on cu.user_id = g.challenger
    join public.usernames ou on ou.user_id = g.opponent
    left join public.usernames wu on wu.user_id = g.winner
    where g.group_id = p_group and g.week_start >= cur.starts_on - 28
    order by g.week_start desc, g.created_at asc
  loop
    if d.settled_at is not null then
      status := 'settled';
      c_score := coalesce(d.challenger_score, 0);
      o_score := coalesce(d.opponent_score, 0);
    elsif d.accepted_at is null then
      status := 'pending';
      c_score := 0;
      o_score := 0;
    else
      status := 'live';
      select * into sc from public.duel_scores(d.id);
      c_score := sc.challenger_score;
      o_score := sc.opponent_score;
    end if;
    out_rows := out_rows || jsonb_build_object(
      'id', d.id,
      'week_start', d.week_start,
      'live', status <> 'settled',
      'status', status,
      'challenger', d.challenger_name,
      'opponent', d.opponent_name,
      'challenger_score', c_score,
      'opponent_score', o_score,
      'winner', d.winner_name,
      'forfeit', d.forfeited_by is not null,
      'forfeited_by_me', d.forfeited_by = uid,
      'mine', uid in (d.challenger, d.opponent),
      'i_am_challenger', uid = d.challenger
    );
  end loop;
  select count(*)::int into started from public.group_duels g
  where g.challenger = uid and g.week_start = cur.starts_on;
  return jsonb_build_object(
    'week_start', cur.starts_on,
    'ends_on', (cur.to_ts at time zone 'Asia/Kolkata')::date - 1,
    'limit', public.duel_limit_for(uid),
    'started', started,
    'duels', out_rows
  );
end;
$$;
revoke all on function public.get_group_duels(uuid) from public, anon;
grant execute on function public.get_group_duels(uuid) to authenticated;

-- Leaving a group: open duels there are lost, unanswered ones dropped, settled ones kept.
create or replace function public.group_duels_after_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
begin
  for d in
    select g.id from public.group_duels g
    where g.group_id = old.group_id and old.user_id in (g.challenger, g.opponent)
      and g.accepted_at is not null and g.settled_at is null
  loop
    perform public.forfeit_duel_for(d.id, old.user_id);
  end loop;
  delete from public.group_duels g
  where g.group_id = old.group_id and old.user_id in (g.challenger, g.opponent)
    and g.accepted_at is null;
  return old;
end;
$$;
drop trigger if exists group_members_end_duels on public.group_members;
create trigger group_members_end_duels after delete on public.group_members
  for each row execute function public.group_duels_after_leave();
