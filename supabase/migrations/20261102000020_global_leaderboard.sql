-- The global leaderboard (November 2026): everyone on Overload, weekly and monthly, scored with
-- the same Overload Score as group boards (community_scores, migration 0019). Safe to run more
-- than once. Run it in the SQL editor before the app version that needs it is deployed.
--
-- Everyone with points in the period appears by default under their profile name. Their
-- username appears only if they switch it on (leaderboard_prefs.show_username). Nobody sees
-- anyone's workouts, weights, food or body weight: only names, usernames when shown, points and
-- the totals behind them. An administrator can keep an account off the board
-- (leaderboard_hidden).
--
-- Scores are worked out for everyone at once, so results are kept in global_results and
-- refreshed at most every app_settings.leaderboard_refresh_seconds (60 by default). A finished
-- week or month is frozen the first time it is shown after it ends.

create table if not exists public.leaderboard_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  show_username boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard_hidden (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.global_results (
  period text not null check (period in ('week', 'month')),
  starts_on date not null,
  computed_at timestamptz not null default now(),
  final boolean not null default false,
  rows jsonb not null,
  primary key (period, starts_on)
);

do $$
declare
  t text;
begin
  foreach t in array array['leaderboard_prefs', 'leaderboard_hidden', 'global_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

alter table public.app_settings
  add column if not exists leaderboard_refresh_seconds integer not null default 60
  check (leaderboard_refresh_seconds between 0 and 3600);

-- Finding everyone active in a period.
create index if not exists workouts_ended_idx on public.workouts (ended_at);
create index if not exists food_logs_date_idx on public.food_logs (date);

-- Everyone's ranked rows for a period (user ids included; never returned as they are).
create or replace function public.community_global_compute(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with active as (
    select w.user_id from public.workouts w
    where w.deleted_at is null and w.status = 'completed'
      and w.ended_at >= p_from and w.ended_at < p_to
    union
    select fl.user_id from public.food_logs fl
    where fl.deleted_at is null
      and fl.date >= (p_from at time zone 'Asia/Kolkata')::date
      and fl.date < (p_to at time zone 'Asia/Kolkata')::date
  ),
  people as (
    select a.user_id from active a
    where not exists (select 1 from public.leaderboard_hidden h where h.user_id = a.user_id)
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank), '[]'::jsonb)
  from (
    select row_number() over (
        order by s.score desc, s.hard_sets desc, s.workouts desc, s.last_at asc nulls last,
          s.user_id
      )::int as rank,
      s.user_id, s.score, s.workouts, s.hard_sets, s.records, s.protein_days
    from public.community_scores(array(select p.user_id from people p), p_from, p_to) s
    where s.score > 0
  ) r;
$$;

-- The rows for a period, from the store when fresh enough (or final), else worked out again.
create or replace function public.community_global_rows(p_period text, p_offset integer)
returns table (starts_on date, ends_on date, final boolean, rows jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  b record;
  cached public.global_results;
  refresh int := coalesce(
    (select a.leaderboard_refresh_seconds from public.app_settings a where a.id), 60
  );
  is_final boolean;
  fresh jsonb;
begin
  if p_period not in ('week', 'month') or p_offset not in (0, -1) then
    raise exception 'Unknown period' using errcode = '22023';
  end if;
  select * into b from public.community_bounds(p_period, p_offset);
  is_final := b.to_ts <= now();
  select * into cached from public.global_results g
  where g.period = p_period and g.starts_on = b.starts_on;
  if cached.period is not null and (
    cached.final or (not is_final and cached.computed_at > now() - make_interval(secs => refresh))
  ) then
    fresh := cached.rows;
  else
    fresh := public.community_global_compute(b.from_ts, b.to_ts);
    insert into public.global_results (period, starts_on, computed_at, final, rows)
    values (p_period, b.starts_on, now(), is_final, fresh)
    on conflict (period, starts_on) do update
      set computed_at = excluded.computed_at, final = excluded.final, rows = excluded.rows
      where not public.global_results.final;
  end if;
  return query select b.starts_on, ((b.to_ts at time zone 'Asia/Kolkata')::date - 1),
    is_final, fresh;
end;
$$;

-- What others see for one row: profile name, the username only when its owner shows it,
-- points and totals, and the photo only when asked for.
create or replace function public.community_global_public(p_row jsonb, p_me uuid, p_photo boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rank', (p_row ->> 'rank')::int,
    'name', coalesce(
      (select pr.display_name from public.profiles pr
       where pr.user_id = (p_row ->> 'user_id')::uuid and pr.deleted_at is null
       order by pr.updated_at desc limit 1),
      'Overload member'
    ),
    'username', (
      select u.username from public.usernames u
      join public.leaderboard_prefs lp on lp.user_id = u.user_id and lp.show_username
      where u.user_id = (p_row ->> 'user_id')::uuid
    ),
    'avatar', case when p_photo then (
      select pr.avatar from public.profiles pr
      where pr.user_id = (p_row ->> 'user_id')::uuid and pr.deleted_at is null
        and pr.avatar is not null
      order by pr.updated_at desc limit 1
    ) end,
    'me', (p_row ->> 'user_id')::uuid = p_me,
    'score', (p_row ->> 'score')::int,
    'workouts', (p_row ->> 'workouts')::int,
    'hard_sets', (p_row ->> 'hard_sets')::int,
    'records', (p_row ->> 'records')::int,
    'protein_days', (p_row ->> 'protein_days')::int
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'community_global_compute(timestamptz, timestamptz)',
    'community_global_rows(text, integer)',
    'community_global_public(jsonb, uuid, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- The board: the top 100, and the caller's own row wherever it is. Photos for the top 3 and
-- the caller only, to keep the answer small.
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
  mine jsonb;
  top jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into g from public.community_global_rows(p_period, p_offset);
  select r into mine from jsonb_array_elements(g.rows) r where (r ->> 'user_id')::uuid = uid;
  select coalesce(jsonb_agg(
      public.community_global_public(e.r, uid, (e.r ->> 'rank')::int <= 3
        or (e.r ->> 'user_id')::uuid = uid)
      order by e.n
    ), '[]'::jsonb)
  into top
  from jsonb_array_elements(g.rows) with ordinality as e (r, n)
  where e.n <= 100;
  return jsonb_build_object(
    'period', p_period,
    'starts_on', g.starts_on,
    'ends_on', g.ends_on,
    'locked', p_offset < 0,
    'total', jsonb_array_length(g.rows),
    'rows', top,
    'mine', case when mine is null then null
      else public.community_global_public(mine, uid, true) end,
    'show_username', coalesce(
      (select lp.show_username from public.leaderboard_prefs lp where lp.user_id = uid), false
    ),
    'has_username', exists (select 1 from public.usernames u where u.user_id = uid)
  );
end;
$$;
revoke all on function public.get_global_board(text, integer) from public, anon;
grant execute on function public.get_global_board(text, integer) to authenticated;

-- The caller's place this week, for the Home card: no other rows.
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
  mine jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into g from public.community_global_rows('week', 0);
  select r into mine from jsonb_array_elements(g.rows) r where (r ->> 'user_id')::uuid = uid;
  return jsonb_build_object(
    'rank', (mine ->> 'rank')::int,
    'score', coalesce((mine ->> 'score')::int, 0),
    'total', jsonb_array_length(g.rows)
  );
end;
$$;
revoke all on function public.get_my_global_standing() from public, anon;
grant execute on function public.get_my_global_standing() to authenticated;

-- Show or hide the caller's username on the global board (their name always shows).
create or replace function public.set_show_username(p_show boolean)
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
  insert into public.leaderboard_prefs (user_id, show_username) values (uid, coalesce(p_show, false))
  on conflict (user_id) do update set show_username = excluded.show_username, updated_at = now();
  return coalesce(p_show, false);
end;
$$;
revoke all on function public.set_show_username(boolean) from public, anon;
grant execute on function public.set_show_username(boolean) to authenticated;
