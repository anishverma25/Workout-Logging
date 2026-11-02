-- Friends, groups and leaderboards (November 2026). Safe to run more than once. Run it in the
-- SQL editor before the app version that needs it is deployed.
--
-- People pick a unique username, create a group (which gets a join code) or join one by typing
-- its code, and see a weekly and a monthly leaderboard for each group. Scores are worked out
-- here, on the server, from workouts and food logs the app has already synced; the phone never
-- sends a score. Nobody can read anyone else's workouts: the functions return only usernames,
-- points and the totals behind them, and only to members of the same group. The new tables
-- have row level security and no direct access at all.
--
-- Overload Score (weekly; monthly caps grow with the length of the month):
--   10 points a workout   (completed, 10+ minutes, 3+ working sets, logged live: at most 2 a
--                          day and 6 a week)
--    1 point a hard set   (working, back-off or drop set; not one logged as easy, 5+ reps in
--                          reserve or RPE under 6; at most 25 a week)
--    5 points a record    (best estimated 1RM on an exercise done in at least 2 earlier
--                          workouts, at most 40% above the old best; at most 5 a week)
--    3 points a day       (on which logged protein reached 90% of the person's own target)
-- Ties go to more hard sets, then more workouts, then whoever got there first.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table if not exists public.usernames (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (
    username ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' and username !~ '[._]{2}'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists usernames_username_key on public.usernames (username);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists groups_code_key on public.groups (code);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default clock_timestamp(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- Finished weeks and months, frozen the first time anyone looks at them, so editing old
-- workouts later cannot change a result.
create table if not exists public.group_results (
  group_id uuid not null references public.groups (id) on delete cascade,
  period text not null check (period in ('week', 'month')),
  starts_on date not null,
  rows jsonb not null,
  created_at timestamptz not null default now(),
  primary key (group_id, period, starts_on)
);

do $$
declare
  t text;
begin
  foreach t in array array['usernames', 'groups', 'group_members', 'group_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- Scoring reads these by person and time; the sync tables only had indexes for syncing.
create index if not exists workouts_user_ended_idx on public.workouts (user_id, ended_at);
create index if not exists sets_user_workout_idx on public.sets (user_id, workout_id);
create index if not exists sets_user_exercise_idx on public.sets (user_id, exercise_id);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, date);

-- ---------------------------------------------------------------------------------------------
-- Helpers (not callable from the app)
-- ---------------------------------------------------------------------------------------------

-- Pro on the server, the same rules as the app's entitlement: early access, a paid period,
-- the free trial or coaching, and never for a revoked account.
create or replace function public.community_is_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.status <> 'revoked' and (
      (a.early_access_ended_at is null or now() < a.early_access_ended_at)
      or (s.pro_expires_at > now() and (s.pro_started_at is null or s.pro_started_at <= now()))
      or s.trial_expires_at > now()
      or coalesce(s.coaching_expires_at > now(), false)
    )
    from public.subscriptions s, public.app_settings a
    where s.user_id = p_user and a.id
  ), false);
$$;

-- A join code nobody else has: six letters and digits, leaving out 0, O, 1 and I.
create or replace function public.community_new_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups g where g.code = c);
  end loop;
  return c;
end;
$$;

-- The start and end of a week (Monday) or month in India time, `p_offset` periods back.
create or replace function public.community_bounds(p_period text, p_offset integer)
returns table (starts_on date, from_ts timestamptz, to_ts timestamptz)
language sql
stable
set search_path = ''
as $$
  with b as (
    select case
      when p_period = 'month' then
        (date_trunc('month', now() at time zone 'Asia/Kolkata')
          + make_interval(months => p_offset))::date
      else
        (date_trunc('week', now() at time zone 'Asia/Kolkata')
          + make_interval(days => 7 * p_offset))::date
    end as d
  )
  select
    b.d,
    b.d::timestamp at time zone 'Asia/Kolkata',
    (case when p_period = 'month' then (b.d + interval '1 month')::date else b.d + 7 end)::timestamp
      at time zone 'Asia/Kolkata'
  from b;
$$;

-- Everyone's points for one period, from synced data only.
create or replace function public.community_scores(
  p_users uuid[],
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  user_id uuid,
  workouts integer,
  hard_sets integer,
  records integer,
  protein_days integer,
  has_protein_target boolean,
  active_days integer,
  volume_kg numeric,
  progress_pct numeric,
  score integer,
  last_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  k as (
    select greatest(1, round(extract(epoch from (p_to - p_from)) / 86400.0))::numeric / 7 as f
  ),
  caps as (
    select ceil(6 * f)::int as w, ceil(25 * f)::int as h, ceil(5 * f)::int as r from k
  ),
  -- Workouts that count: completed in the period, 10+ minutes, 3+ working sets done, and
  -- logged live (created within two days of starting, so imports and back-filling never count).
  valid_w as (
    select w.user_id, w.id, w.started_at, w.ended_at,
      (w.ended_at at time zone 'Asia/Kolkata')::date as day
    from public.workouts w
    where w.user_id = any (p_users)
      and w.deleted_at is null
      and w.status = 'completed'
      and w.ended_at >= p_from and w.ended_at < p_to
      and w.ended_at - w.started_at >= interval '10 minutes'
      and w.created_at <= w.started_at + interval '48 hours'
      and (
        select count(*) from public.sets s
        where s.user_id = w.user_id and s.workout_id = w.id and s.deleted_at is null
          and s.completed_at is not null and s.set_type <> 'warmup'
      ) >= 3
  ),
  -- At most two a day.
  counted_w as (
    select v.* from (
      select vw.*, row_number() over (partition by vw.user_id, vw.day order by vw.ended_at) as rn
      from valid_w vw
    ) v
    where v.rn <= 2
  ),
  w_agg as (
    select cw.user_id, count(*)::int as n, count(distinct cw.day)::int as days,
      max(cw.ended_at) as last_at
    from counted_w cw group by cw.user_id
  ),
  work_sets as (
    select s.user_id, s.workout_id, s.exercise_id, s.set_type, s.weight_kg, s.reps, s.rir,
      s.rpe, s.reps_left, s.reps_right, s.duration_sec, s.distance_m, cw.started_at,
      coalesce(e.load_mode, ue.load_mode, 'total') as load_mode
    from public.sets s
    join counted_w cw on cw.id = s.workout_id and cw.user_id = s.user_id
    left join public.exercises e on e.id = s.exercise_id
    left join public.user_exercises ue on ue.id = s.exercise_id and ue.user_id = s.user_id
    where s.deleted_at is null and s.completed_at is not null and s.set_type <> 'warmup'
      and (coalesce(s.reps, 0) > 0 or coalesce(s.duration_sec, 0) > 0
        or coalesce(s.distance_m, 0) > 0)
  ),
  hard as (
    select ws.user_id, count(*)::int as n
    from work_sets ws
    where coalesce(ws.rir <= 4, ws.rpe >= 6, true)
    group by ws.user_id
  ),
  volume as (
    select ws.user_id,
      sum(ws.weight_kg * coalesce(ws.reps_left + ws.reps_right, ws.reps)
        * case when ws.load_mode = 'per_hand' then 2 else 1 end) as kg
    from work_sets ws
    where ws.weight_kg > 0 and coalesce(ws.reps, 0) > 0
    group by ws.user_id
  ),
  -- Each workout's best estimated 1RM per exercise (Epley, 1 to 10 reps).
  best_in_workout as (
    select ws.user_id, ws.workout_id, ws.exercise_id, ws.started_at,
      max(ws.weight_kg * (1 + ws.reps::numeric / 30)) as e1rm
    from work_sets ws
    where ws.weight_kg > 0 and ws.reps between 1 and 10 and ws.set_type in ('working', 'backoff')
    group by ws.user_id, ws.workout_id, ws.exercise_id, ws.started_at
  ),
  history as (
    select b.*,
      (
        select count(distinct pw.id) from public.workouts pw
        join public.sets ps on ps.workout_id = pw.id and ps.user_id = pw.user_id
        where pw.user_id = b.user_id and pw.deleted_at is null and pw.status = 'completed'
          and pw.started_at < b.started_at and ps.exercise_id = b.exercise_id
          and ps.deleted_at is null and ps.completed_at is not null and ps.set_type <> 'warmup'
      ) as sessions,
      (
        select max(ps.weight_kg * (1 + ps.reps::numeric / 30)) from public.sets ps
        join public.workouts pw on pw.id = ps.workout_id and pw.user_id = ps.user_id
        where ps.user_id = b.user_id and ps.exercise_id = b.exercise_id
          and pw.deleted_at is null and pw.status = 'completed' and pw.started_at < b.started_at
          and ps.deleted_at is null and ps.completed_at is not null
          and ps.set_type in ('working', 'backoff') and ps.weight_kg > 0
          and ps.reps between 1 and 10
      ) as best_before,
      (
        select max(ps.weight_kg * (1 + ps.reps::numeric / 30)) from public.sets ps
        join public.workouts pw on pw.id = ps.workout_id and pw.user_id = ps.user_id
        where ps.user_id = b.user_id and ps.exercise_id = b.exercise_id
          and pw.deleted_at is null and pw.status = 'completed'
          and pw.started_at >= p_from - interval '28 days' and pw.started_at < p_from
          and ps.deleted_at is null and ps.completed_at is not null
          and ps.set_type in ('working', 'backoff') and ps.weight_kg > 0
          and ps.reps between 1 and 10
      ) as best_last_4_weeks
    from best_in_workout b
  ),
  records as (
    select h.user_id, count(*)::int as n
    from history h
    where h.sessions >= 2 and h.best_before is not null
      and h.e1rm > h.best_before and h.e1rm <= h.best_before * 1.4
    group by h.user_id
  ),
  -- Progress: average change in best estimated 1RM per exercise against the 4 weeks before,
  -- each exercise held between -50% and +40% so one odd entry cannot decide it.
  progress as (
    select x.user_id, round(avg(greatest(-0.5, least(0.4, x.e1rm / x.base - 1))) * 100, 1) as pct
    from (
      select h.user_id, h.exercise_id, max(h.e1rm) as e1rm, max(h.best_last_4_weeks) as base
      from history h
      group by h.user_id, h.exercise_id
    ) x
    where x.base is not null and x.base > 0
    group by x.user_id
  ),
  target as (
    select distinct on (p.user_id) p.user_id, p.protein_target_g
    from public.profiles p
    where p.user_id = any (p_users) and p.deleted_at is null
    order by p.user_id, p.updated_at desc
  ),
  -- Protein per day in India time, counting what was logged by the end of the next day.
  food_days as (
    select fl.user_id, fl.date, sum(fl.protein_g) as protein
    from public.food_logs fl
    where fl.user_id = any (p_users) and fl.deleted_at is null
      and fl.date >= (p_from at time zone 'Asia/Kolkata')::date
      and fl.date < (p_to at time zone 'Asia/Kolkata')::date
      and fl.created_at < ((fl.date + 2)::timestamp at time zone 'Asia/Kolkata')
    group by fl.user_id, fl.date
  ),
  protein as (
    select fd.user_id, count(*)::int as n
    from food_days fd join target t on t.user_id = fd.user_id
    where t.protein_target_g is not null and fd.protein >= 0.9 * t.protein_target_g
    group by fd.user_id
  ),
  combined as (
    select u.uid,
      least(coalesce(wa.n, 0), caps.w) as workouts,
      least(coalesce(h.n, 0), caps.h) as hard_sets,
      least(coalesce(r.n, 0), caps.r) as records,
      coalesce(pr.n, 0) as protein_days,
      coalesce(t.protein_target_g is not null, false) as has_protein_target,
      coalesce(wa.days, 0) as active_days,
      round(coalesce(v.kg, 0)) as volume_kg,
      pg.pct as progress_pct,
      wa.last_at
    from unnest(p_users) as u (uid)
    cross join caps
    left join w_agg wa on wa.user_id = u.uid
    left join hard h on h.user_id = u.uid
    left join records r on r.user_id = u.uid
    left join protein pr on pr.user_id = u.uid
    left join target t on t.user_id = u.uid
    left join volume v on v.user_id = u.uid
    left join progress pg on pg.user_id = u.uid
  )
  select c.uid, c.workouts, c.hard_sets, c.records, c.protein_days, c.has_protein_target,
    c.active_days, c.volume_kg, c.progress_pct,
    10 * c.workouts + c.hard_sets + 5 * c.records + 3 * c.protein_days,
    c.last_at
  from combined c;
$$;

-- A ranked board for one group and period, as JSON rows (user ids included; callers strip them).
create or replace function public.community_board(p_group uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank), '[]'::jsonb)
  from (
    select row_number() over (
        order by s.score desc, s.hard_sets desc, s.workouts desc, s.last_at asc nulls last,
          un.username asc
      )::int as rank,
      s.user_id, un.username, s.score, s.workouts, s.hard_sets, s.records, s.protein_days,
      s.has_protein_target, s.active_days, s.volume_kg, s.progress_pct
    from public.community_scores(
      array(select m.user_id from public.group_members m where m.group_id = p_group),
      p_from, p_to
    ) s
    join public.usernames un on un.user_id = s.user_id
  ) r;
$$;

-- The frozen result of a finished period, made the first time it is needed.
create or replace function public.community_result(p_group uuid, p_period text, p_offset integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b record;
  created timestamptz;
  result jsonb;
begin
  select * into b from public.community_bounds(p_period, p_offset);
  if b.to_ts > now() then
    return null;
  end if;
  select g.created_at into created from public.groups g where g.id = p_group;
  if created is null or created >= b.to_ts then
    return null;
  end if;
  select gr.rows into result from public.group_results gr
  where gr.group_id = p_group and gr.period = p_period and gr.starts_on = b.starts_on;
  if result is null then
    result := public.community_board(p_group, b.from_ts, b.to_ts);
    insert into public.group_results (group_id, period, starts_on, rows)
    values (p_group, p_period, b.starts_on, result)
    on conflict do nothing;
  end if;
  return result;
end;
$$;

-- Rows as members see them: no user ids, `me` on their own row, and the extra totals (used by
-- the Pro boards) only for Pro members.
create or replace function public.community_public_rows(p_rows jsonb, p_me uuid, p_pro boolean)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    (r - 'user_id' - case when p_pro then '{}'::text[]
      else array['active_days', 'volume_kg', 'progress_pct'] end)
    || jsonb_build_object('me', (r ->> 'user_id')::uuid = p_me)
    order by (r ->> 'rank')::int
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
$$;

-- Whoever is left becomes the admin when the last admin leaves; an empty group is deleted.
create or replace function public.group_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.groups g where g.id = old.group_id) then
    return null;
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = old.group_id) then
    delete from public.groups g where g.id = old.group_id;
  elsif not exists (
    select 1 from public.group_members m where m.group_id = old.group_id and m.role = 'admin'
  ) then
    update public.group_members m set role = 'admin'
    where m.group_id = old.group_id and m.user_id = (
      select m2.user_id from public.group_members m2 where m2.group_id = old.group_id
      order by m2.joined_at, m2.user_id limit 1
    );
  end if;
  return null;
end;
$$;
drop trigger if exists group_members_after_delete on public.group_members;
create trigger group_members_after_delete after delete on public.group_members
  for each row execute function public.group_members_after_delete();

do $$
declare
  f text;
begin
  foreach f in array array[
    'community_is_pro(uuid)', 'community_new_code()', 'community_bounds(text, integer)',
    'community_scores(uuid[], timestamptz, timestamptz)',
    'community_board(uuid, timestamptz, timestamptz)',
    'community_result(uuid, text, integer)', 'community_public_rows(jsonb, uuid, boolean)',
    'group_members_after_delete()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------------------------

-- Names nobody may take.
create or replace function public.community_reserved(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name = any (array[
    'overload', 'overloadgym', 'overloadgpt', 'admin', 'administrator', 'support', 'help',
    'coach', 'official', 'team', 'staff', 'moderator', 'root', 'system', 'null', 'undefined'
  ]) or p_name like 'overload%';
$$;
revoke all on function public.community_reserved(text) from public, anon, authenticated;

-- What a typed username becomes: lower case, no spaces, no leading @.
create or replace function public.community_clean_username(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '^@+', ''));
$$;
revoke all on function public.community_clean_username(text) from public, anon, authenticated;

-- ok, taken, reserved or invalid. The caller's own username counts as ok.
create or replace function public.check_username(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  uname text := public.community_clean_username(p_username);
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if uname !~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' or uname ~ '[._]{2}' then
    return 'invalid';
  end if;
  if public.community_reserved(uname) then
    return 'reserved';
  end if;
  if exists (select 1 from public.usernames u where u.username = uname and u.user_id <> uid) then
    return 'taken';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.check_username(text) from public, anon;
grant execute on function public.check_username(text) to authenticated;

create or replace function public.get_my_username()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.username from public.usernames u where u.user_id = auth.uid();
$$;
revoke all on function public.get_my_username() from public, anon;
grant execute on function public.get_my_username() to authenticated;

create or replace function public.set_username(p_username text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  uname text := public.community_clean_username(p_username);
  status text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  status := public.check_username(uname);
  if status = 'invalid' then
    raise exception 'Invalid username' using errcode = '22023';
  elsif status = 'reserved' then
    raise exception 'Reserved username' using errcode = '22023';
  elsif status = 'taken' then
    raise exception 'Username taken' using errcode = '23505';
  end if;
  begin
    insert into public.usernames (user_id, username) values (uid, uname)
    on conflict (user_id) do update set username = excluded.username, updated_at = now();
  exception when unique_violation then
    raise exception 'Username taken' using errcode = '23505';
  end;
  return uname;
end;
$$;
revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

-- The caller's groups, each with their place this week and who they are chasing.
create or replace function public.get_my_groups()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  b record;
  result jsonb := '[]'::jsonb;
  g record;
  board jsonb;
  mine jsonb;
  above jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into b from public.community_bounds('week', 0);
  for g in
    select gr.id, gr.name, gr.code, m.role, m.joined_at,
      (select count(*) from public.group_members x where x.group_id = gr.id)::int as members
    from public.group_members m join public.groups gr on gr.id = m.group_id
    where m.user_id = uid
    order by m.joined_at
  loop
    board := public.community_board(g.id, b.from_ts, b.to_ts);
    select r into mine from jsonb_array_elements(board) r where (r ->> 'user_id')::uuid = uid;
    above := null;
    if mine is not null and (mine ->> 'rank')::int > 1 then
      select r into above from jsonb_array_elements(board) r
      where (r ->> 'rank')::int = (mine ->> 'rank')::int - 1;
    end if;
    result := result || jsonb_build_array(jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'code', g.code,
      'role', g.role,
      'members', g.members,
      'rank', (mine ->> 'rank')::int,
      'score', coalesce((mine ->> 'score')::int, 0),
      'leader', board -> 0 ->> 'username',
      'above', above ->> 'username',
      'behind_by', case when above is null then null
        else (above ->> 'score')::int - (mine ->> 'score')::int end
    ));
  end loop;
  return result;
end;
$$;
revoke all on function public.get_my_groups() from public, anon;
grant execute on function public.get_my_groups() to authenticated;

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
  limit_n := case when public.community_is_pro(uid) then 10 else 3 end;
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
  limit_n := case when public.community_is_pro(uid) then 10 else 3 end;
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

-- One group's leaderboard. p_period is week or month; p_offset 0 is now, -1 the one before.
create or replace function public.get_group_board(p_group uuid, p_period text, p_offset integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g record;
  b record;
  board_rows jsonb;
  pro boolean;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  trained jsonb;
  members int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_period not in ('week', 'month') or p_offset not in (0, -1) then
    raise exception 'Unknown period' using errcode = '22023';
  end if;
  select gr.id, gr.name, gr.code, m.role into g
  from public.groups gr join public.group_members m on m.group_id = gr.id and m.user_id = uid
  where gr.id = p_group;
  if g.id is null then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  pro := public.community_is_pro(uid);
  select * into b from public.community_bounds(p_period, p_offset);
  if p_offset = 0 then
    board_rows := public.community_board(p_group, b.from_ts, b.to_ts);
  else
    board_rows := public.community_result(p_group, p_period, p_offset);
  end if;

  -- Who has trained today (a completed or running workout started today, India time).
  select coalesce(jsonb_agg(un.username), '[]'::jsonb) into trained
  from public.group_members m
  join public.usernames un on un.user_id = m.user_id
  where m.group_id = p_group and exists (
    select 1 from public.workouts w
    where w.user_id = m.user_id and w.deleted_at is null
      and w.status in ('completed', 'in_progress')
      and (w.started_at at time zone 'Asia/Kolkata')::date = today
  );
  select count(*)::int into members from public.group_members m where m.group_id = p_group;

  return jsonb_build_object(
    'group', jsonb_build_object('id', g.id, 'name', g.name, 'code', g.code, 'role', g.role,
      'members', members),
    'period', p_period,
    'starts_on', b.starts_on,
    'ends_on', (b.to_ts at time zone 'Asia/Kolkata')::date - 1,
    'locked', p_offset < 0,
    'available', board_rows is not null,
    'pro', pro,
    'trained_today', trained,
    'rows', public.community_public_rows(board_rows, uid, pro)
  );
end;
$$;
revoke all on function public.get_group_board(uuid, text, integer) from public, anon;
grant execute on function public.get_group_board(uuid, text, integer) to authenticated;

-- Past winners: the last 8 finished weeks and 3 finished months since the group began.
create or replace function public.get_group_winners(p_group uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '[]'::jsonb;
  board_rows jsonb;
  b record;
  p text;
  n int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.group_members m where m.group_id = p_group and m.user_id = uid
  ) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  foreach p in array array['week', 'month'] loop
    for n in 1..(case when p = 'week' then 8 else 3 end) loop
      board_rows := public.community_result(p_group, p, -n);
      exit when board_rows is null;
      select * into b from public.community_bounds(p, -n);
      if jsonb_array_length(board_rows) > 0 and (board_rows -> 0 ->> 'score')::int > 0 then
        result := result || jsonb_build_array(jsonb_build_object(
          'period', p,
          'starts_on', b.starts_on,
          'username', board_rows -> 0 ->> 'username',
          'score', (board_rows -> 0 ->> 'score')::int,
          'me', (board_rows -> 0 ->> 'user_id')::uuid = uid
        ));
      end if;
    end loop;
  end loop;
  return result;
end;
$$;
revoke all on function public.get_group_winners(uuid) from public, anon;
grant execute on function public.get_group_winners(uuid) to authenticated;

-- Photos for a few members (podium and the caller), by username, members only.
create or replace function public.get_group_avatars(p_group uuid, p_usernames text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(un.username, p.avatar), '{}'::jsonb)
  from public.group_members m
  join public.usernames un on un.user_id = m.user_id
  join lateral (
    select pr.avatar from public.profiles pr
    where pr.user_id = m.user_id and pr.deleted_at is null and pr.avatar is not null
    order by pr.updated_at desc limit 1
  ) p on true
  where m.group_id = p_group
    and un.username = any (p_usernames[1:6])
    and exists (
      select 1 from public.group_members me where me.group_id = p_group and me.user_id = auth.uid()
    );
$$;
revoke all on function public.get_group_avatars(uuid, text[]) from public, anon;
grant execute on function public.get_group_avatars(uuid, text[]) to authenticated;

create or replace function public.leave_group(p_group uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.group_members m where m.group_id = p_group and m.user_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- Admin only: rename, a new code (the old one stops working) and removing someone.
create or replace function public.community_require_admin(p_group uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = auth.uid() and m.role = 'admin'
  ) then
    raise exception 'Only the group admin can do that' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.community_require_admin(uuid) from public, anon, authenticated;

create or replace function public.rename_group(p_group uuid, p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  perform public.community_require_admin(p_group);
  if char_length(clean) not between 1 and 40 then
    raise exception 'Group names are 1 to 40 characters' using errcode = '22023';
  end if;
  update public.groups g set name = clean where g.id = p_group;
  return clean;
end;
$$;
revoke all on function public.rename_group(uuid, text) from public, anon;
grant execute on function public.rename_group(uuid, text) to authenticated;

create or replace function public.new_group_code(p_group uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c text;
begin
  perform public.community_require_admin(p_group);
  c := public.community_new_code();
  update public.groups g set code = c where g.id = p_group;
  return c;
end;
$$;
revoke all on function public.new_group_code(uuid) from public, anon;
grant execute on function public.new_group_code(uuid) to authenticated;

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
  return found;
end;
$$;
revoke all on function public.remove_group_member(uuid, text) from public, anon;
grant execute on function public.remove_group_member(uuid, text) to authenticated;
