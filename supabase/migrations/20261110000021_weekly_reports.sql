-- Macrotrophy Weekly Intelligence (November 2026): one report per person per week, Pro only.
-- The phone calculates the report from its own logs and saves it here once; a second save for
-- the same week returns the first one and changes nothing, so a week can never be generated
-- twice. The server clock decides which weeks are open, never the phone's clock.

create table if not exists public.weekly_reports (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The first day of the week the report covers (the person's own week start).
  week_start date not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  origin text not null default 'user' check (origin = 'user'),
  unique (user_id, week_start),
  check (octet_length(report::text) <= 262144)
);

alter table public.weekly_reports enable row level security;
alter table public.weekly_reports force row level security;
-- No policies: read and written only through the functions below.
revoke all on public.weekly_reports from anon, authenticated;

-- Saves this week's report, or returns the one already saved for that week.
-- A week opens on its last day (from the start of that day anywhere in the world) and stays
-- open for 8 more days, so last week's report can still be made the next week.
create or replace function public.claim_weekly_report(p_id uuid, p_week_start date, p_report jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  opens timestamptz;
  closes timestamptz;
  row_ public.weekly_reports;
  made boolean := false;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not public.community_is_pro(uid) then
    raise exception 'The weekly report comes with Pro.' using errcode = '42501';
  end if;
  if p_week_start is null or p_report is null or jsonb_typeof(p_report) <> 'object' then
    raise exception 'Nothing to save.' using errcode = '22023';
  end if;
  if extract(isodow from p_week_start) not in (1, 7) then
    raise exception 'A week starts on a Monday or a Sunday.' using errcode = '22023';
  end if;
  -- The week's last day begins at 00:00 in the furthest-ahead time zone (UTC+14).
  opens := (p_week_start + 6)::timestamp at time zone 'UTC' - interval '14 hours';
  closes := (p_week_start + 15)::timestamp at time zone 'UTC' + interval '12 hours';
  if now() < opens then
    raise exception 'This week''s report opens on its last day.' using errcode = '22023';
  end if;
  if now() > closes then
    raise exception 'That week is too far back to make a report.' using errcode = '22023';
  end if;
  if octet_length(p_report::text) > 262144 then
    raise exception 'The report is too large.' using errcode = '22023';
  end if;

  insert into public.weekly_reports (id, user_id, week_start, report)
  values (coalesce(p_id, gen_random_uuid()), uid, p_week_start, p_report)
  on conflict (user_id, week_start) do nothing
  returning * into row_;
  if found then
    made := true;
  else
    select * into row_ from public.weekly_reports
      where user_id = uid and week_start = p_week_start;
  end if;

  return jsonb_build_object(
    'id', row_.id,
    'week_start', row_.week_start,
    'created_at', row_.created_at,
    'created', made,
    'report', row_.report
  );
end;
$$;

-- The person's own reports, newest first. History is never gated: past reports stay readable
-- after Pro ends.
create or replace function public.get_my_weekly_reports(p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'week_start', r.week_start,
    'created_at', r.created_at,
    'report', r.report
  ) order by r.week_start desc), '[]'::jsonb)
  from (
    select * from public.weekly_reports
    where user_id = auth.uid() and deleted_at is null
    order by week_start desc
    limit greatest(1, least(coalesce(p_limit, 12), 60))
  ) r;
$$;

revoke all on function public.claim_weekly_report(uuid, date, jsonb) from public, anon;
revoke all on function public.get_my_weekly_reports(integer) from public, anon;
grant execute on function public.claim_weekly_report(uuid, date, jsonb) to authenticated;
grant execute on function public.get_my_weekly_reports(integer) to authenticated;
