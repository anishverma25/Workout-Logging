-- Leaderboards follow the app's own rules (November 2026, Fable review batches 20 and 15).
--
-- - A workout's length leaves out paused time, as the app does, so pausing never pads the
--   10-minute rule (O6).
-- - Records and progress use the app's e1RM rule: compound weight-and-reps lifts only, Epley
--   for 2 to 10 reps, and a single counts as its own weight (S2). Reps in reserve are not used
--   for leaderboard records.
-- - Days and weeks stay India time, Monday to Sunday (stated on the Groups page and in the
--   science topic).
--
-- Only community_scores changes; its signature and every caller stay the same.

create or replace function public.community_e1rm(p_weight numeric, p_reps integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_reps = 1 then p_weight else p_weight * (1 + p_reps::numeric / 30) end;
$$;
revoke all on function public.community_e1rm(numeric, integer) from public, anon, authenticated;

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
      -- Paused time does not count toward the 10 minutes (batch 20), as in the app.
      and w.ended_at - w.started_at - make_interval(secs => coalesce(w.paused_ms, 0) / 1000.0)
        >= interval '10 minutes'
      and w.created_at <= w.started_at + interval '48 hours'
      and (
        select count(*) from public.sets s
        where s.user_id = w.user_id and s.workout_id = w.id and s.deleted_at is null
          and s.completed_at is not null and s.set_type <> 'warmup'
      ) >= 3
      -- Sets ticked as they were done: the working sets span 2 minutes or more. Ticking a whole
      -- workout in one go at the end does not count.
      and (
        select max(s.completed_at) - min(s.completed_at) from public.sets s
        where s.user_id = w.user_id and s.workout_id = w.id and s.deleted_at is null
          and s.completed_at is not null and s.set_type <> 'warmup'
      ) >= interval '2 minutes'
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
      coalesce(e.load_mode, ue.load_mode, 'total') as load_mode,
      coalesce(e.category, ue.category) = 'compound'
        and coalesce(e.tracking_type, ue.tracking_type) = 'weight_reps' as e1rm_lift
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
  -- Each workout's best estimated 1RM per exercise, by the app's rule (batch 15): compound
  -- weight and reps lifts only, Epley for 2 to 10 reps, a single equals its weight.
  best_in_workout as (
    select ws.user_id, ws.workout_id, ws.exercise_id, ws.started_at,
      max(public.community_e1rm(ws.weight_kg, ws.reps)) as e1rm
    from work_sets ws
    where ws.weight_kg > 0 and ws.reps between 1 and 10 and ws.set_type in ('working', 'backoff')
      and ws.e1rm_lift
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
        select max(public.community_e1rm(ps.weight_kg, ps.reps)) from public.sets ps
        join public.workouts pw on pw.id = ps.workout_id and pw.user_id = ps.user_id
        where ps.user_id = b.user_id and ps.exercise_id = b.exercise_id
          and pw.deleted_at is null and pw.status = 'completed' and pw.started_at < b.started_at
          and ps.deleted_at is null and ps.completed_at is not null
          and ps.set_type in ('working', 'backoff') and ps.weight_kg > 0
          and ps.reps between 1 and 10
      ) as best_before,
      (
        select max(public.community_e1rm(ps.weight_kg, ps.reps)) from public.sets ps
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
revoke all on function public.community_scores(uuid[], timestamptz, timestamptz) from public, anon, authenticated;
