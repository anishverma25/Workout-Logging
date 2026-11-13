-- Fairer points and visible routines on the leaderboards (November 2026). Safe to run more than
-- once. Finished weeks and months stay exactly as they were frozen; the running week is worked
-- out again with the new rules.
--
-- What changed in the Macrotrophy Score, all on the server and hard to fake:
--   * A workout counts only if its working sets were ticked over 5 minutes or more (not all at the
--     end), and only one workout a day earns the 10 points (a second session still adds hard sets).
--   * Consistency: +10 for each Monday to Sunday week with 3 or more training days.
--   * Progress: +1 for each 1% stronger on average than the 4 weeks before, from 3 or more lifts,
--     up to +10. Each lift is held between -50% and +40%, so one odd entry cannot decide it.
--   * A protein day needs food logged at two or more meals that day.
-- Nothing typed by hand alone (steps, body weight, a single food entry) earns points.
--
-- Routines on the boards: tapping someone on a board shows their active routine's plan (days,
-- exercises, sets and rep targets; never weights). It is on unless they turn it off
-- (set_share_routine). Only library exercises are shown and can be copied.

drop function if exists public.community_scores(uuid[], timestamptz, timestamptz);

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
  last_at timestamptz,
  consistency_weeks integer,
  progress_points integer
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
      -- Sets ticked as they were done: the working sets span 5 minutes or more. Ticking a whole
      -- workout in one go at the end does not count.
      and (
        select max(s.completed_at) - min(s.completed_at) from public.sets s
        where s.user_id = w.user_id and s.workout_id = w.id and s.deleted_at is null
          and s.completed_at is not null and s.set_type <> 'warmup'
      ) >= interval '5 minutes'
  ),
  -- One a day: a second session the same day adds hard sets, not another workout.
  counted_w as (
    select v.* from (
      select vw.*, row_number() over (partition by vw.user_id, vw.day order by vw.ended_at) as rn
      from valid_w vw
    ) v
    where v.rn <= 1
  ),
  -- Hard sets come from every valid session of the day, not only the first.
  set_w as (
    select vw.* from valid_w vw
  ),
  -- Consistency: each Monday-to-Sunday week (India time) in the period with 3+ training days.
  consistency as (
    select d.user_id, count(*)::int as weeks
    from (
      select cw.user_id, date_trunc('week', cw.day::timestamp) as wk, count(distinct cw.day) as days
      from counted_w cw group by cw.user_id, date_trunc('week', cw.day::timestamp)
    ) d
    where d.days >= 3
    group by d.user_id
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
    join set_w cw on cw.id = s.workout_id and cw.user_id = s.user_id
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
    select x.user_id, round(avg(greatest(-0.5, least(0.4, x.e1rm / x.base - 1))) * 100, 1) as pct,
      count(*)::int as compared
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
  -- Protein per day in India time, counting what was logged by the end of the next day, on
  -- days with food logged at two or more meals (one big typed entry is not a day of eating).
  food_days as (
    select fl.user_id, fl.date, sum(fl.protein_g) as protein, count(distinct fl.meal) as meals
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
      and fd.meals >= 2
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
      wa.last_at,
      coalesce(cs.weeks, 0) as consistency_weeks,
      -- 1 point per 1% stronger on average than the 4 weeks before, from 3+ lifts, up to 10.
      case when coalesce(pg.compared, 0) >= 3
        then least(10, greatest(0, floor(pg.pct)))::int else 0 end as progress_points
    from unnest(p_users) as u (uid)
    cross join caps
    left join w_agg wa on wa.user_id = u.uid
    left join hard h on h.user_id = u.uid
    left join records r on r.user_id = u.uid
    left join protein pr on pr.user_id = u.uid
    left join target t on t.user_id = u.uid
    left join volume v on v.user_id = u.uid
    left join progress pg on pg.user_id = u.uid
    left join consistency cs on cs.user_id = u.uid
  )
  select c.uid, c.workouts, c.hard_sets, c.records, c.protein_days, c.has_protein_target,
    c.active_days, c.volume_kg, c.progress_pct,
    10 * c.workouts + c.hard_sets + 5 * c.records + 3 * c.protein_days
      + 10 * c.consistency_weeks + c.progress_points,
    c.last_at, c.consistency_weeks, c.progress_points
  from combined c;
$$;

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
      s.has_protein_target, s.active_days, s.volume_kg, s.progress_pct,
      s.consistency_weeks, s.progress_points
    from public.community_scores(
      array(select m.user_id from public.group_members m where m.group_id = p_group),
      p_from, p_to
    ) s
    join public.usernames un on un.user_id = s.user_id
  ) r;
$$;

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
      s.user_id, s.score, s.workouts, s.hard_sets, s.records, s.protein_days,
      s.consistency_weeks, s.progress_points
    from public.community_scores(array(select p.user_id from people p), p_from, p_to) s
    where s.score > 0
  ) r;
$$;

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
      'Macrotrophy member'
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
    'protein_days', (p_row ->> 'protein_days')::int,
    'consistency_weeks', coalesce((p_row ->> 'consistency_weeks')::int, 0),
    'progress_points', coalesce((p_row ->> 'progress_points')::int, 0)
  );
$$;

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
    'has_username', exists (select 1 from public.usernames u where u.user_id = uid),
    'share_routine', coalesce(
      (select lp.share_routine from public.leaderboard_prefs lp where lp.user_id = uid), true
    )
  );
end;
$$;
revoke all on function public.get_global_board(text, integer) from public, anon;
grant execute on function public.get_global_board(text, integer) to authenticated;

-- The running week and month are worked out again with the new rules on the next view.
delete from public.global_results where not final;

alter table public.leaderboard_prefs add column if not exists share_routine boolean not null default true;

create or replace function public.set_share_routine(p_on boolean)
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
  insert into public.leaderboard_prefs (user_id, share_routine) values (uid, coalesce(p_on, true))
  on conflict (user_id) do update set share_routine = excluded.share_routine, updated_at = now();
  return coalesce(p_on, true);
end;
$$;
revoke all on function public.set_share_routine(boolean) from public, anon;
grant execute on function public.set_share_routine(boolean) to authenticated;

-- One person's active routine as a plan: days, weekdays, exercises, sets and rep targets.
-- Null when they have none or keep it to themselves.
create or replace function public.community_routine(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce((select lp.share_routine from public.leaderboard_prefs lp
                   where lp.user_id = p_user), true) is not true then null
    else (
      select jsonb_build_object(
        'name', r.name,
        'days', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', d.name,
            'weekdays', to_jsonb(d.weekdays),
            'exercises', coalesce((
              select jsonb_agg(jsonb_build_object(
                'exercise_id', case when e.id is not null then re.exercise_id end,
                'name', coalesce(e.name, 'Their own exercise'),
                'sets', re.target_sets,
                'rep_min', re.rep_min,
                'rep_max', re.rep_max,
                'rir', re.target_rir
              ) order by re.order_index)
              from public.routine_exercises re
              left join public.exercises e on e.id = re.exercise_id
              where re.user_id = p_user and re.routine_day_id = d.id and re.deleted_at is null
            ), '[]'::jsonb)
          ) order by d.order_index)
          from public.routine_days d
          where d.user_id = p_user and d.routine_id = r.id and d.deleted_at is null
        ), '[]'::jsonb)
      )
      from public.routines r
      where r.user_id = p_user and r.is_active and r.deleted_at is null
      order by r.updated_at desc
      limit 1
    )
  end;
$$;
revoke all on function public.community_routine(uuid) from public, anon, authenticated;

-- The routine of whoever is at a rank on the global board (the caller sees what the board shows).
create or replace function public.get_board_routine(p_period text, p_offset integer, p_rank integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g record;
  who uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into g from public.community_global_rows(p_period, p_offset);
  select (r ->> 'user_id')::uuid into who
  from jsonb_array_elements(g.rows) r where (r ->> 'rank')::int = p_rank;
  if who is null then
    return null;
  end if;
  return public.community_routine(who);
end;
$$;
revoke all on function public.get_board_routine(text, integer, integer) from public, anon;
grant execute on function public.get_board_routine(text, integer, integer) to authenticated;

-- The routine of another member of a group the caller is in.
create or replace function public.get_member_routine(p_group uuid, p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  who uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group and m.user_id = uid) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
  select un.user_id into who
  from public.usernames un
  join public.group_members m on m.user_id = un.user_id and m.group_id = p_group
  where un.username = lower(btrim(coalesce(p_username, '')));
  if who is null then
    return null;
  end if;
  return public.community_routine(who);
end;
$$;
revoke all on function public.get_member_routine(uuid, text) from public, anon;
grant execute on function public.get_member_routine(uuid, text) to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'community_scores(uuid[], timestamptz, timestamptz)',
    'community_board(uuid, timestamptz, timestamptz)',
    'community_global_compute(timestamptz, timestamptz)',
    'community_global_public(jsonb, uuid, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;
