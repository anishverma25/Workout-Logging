-- Error reports and onboarding steps from the app (November 2026, Fable review batch 4).
--
-- Before: a crash on someone's phone was only known when they wrote on Instagram. Now the app
-- sends a short technical report: what kind of failure, where (the route, no query or hash),
-- the app version and a scrubbed message. It never sends food names, notes, AI text, emails or
-- tokens (the app removes them before sending, and SQL caps every length).
--
-- - client_errors: one row per person, day and fingerprint; a repeat adds to count.
-- - At most 20 distinct rows a person a day. Over that, reports are dropped quietly.
-- - Onboarding steps (kind 'step': tour_done, signed_up, setup_done, first_workout, first_food)
--   use the same table, so the funnel needs no third-party analytics.
-- - Nobody reads it from the app: RLS forced, no policies, no grants. Reading is SQL in
--   docs/admin-errors.md.
-- - Rows older than 30 days are deleted by the function itself (the privacy policy says 30).
--
-- Safe to run before or after the app that uses it: a phone that does not find the function
-- keeps its reports for a later try and never shows an error.

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  app_version text not null default '' check (char_length(app_version) <= 40),
  route text not null default '' check (char_length(route) <= 80),
  kind text not null check (
    kind in ('crash', 'route', 'error', 'unhandled', 'chunk', 'sync_rejected', 'step')
  ),
  fingerprint text not null check (char_length(fingerprint) <= 120),
  message text not null default '' check (char_length(message) <= 300),
  stack text not null default '' check (char_length(stack) <= 1500),
  user_agent text not null default '' check (char_length(user_agent) <= 200),
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  unique (user_id, day, kind, fingerprint)
);

create index if not exists client_errors_day on public.client_errors (day desc, kind);

alter table public.client_errors enable row level security;
alter table public.client_errors force row level security;
revoke all on public.client_errors from anon, authenticated;

create or replace function public.report_client_error(
  p_kind text,
  p_fingerprint text,
  p_message text,
  p_stack text,
  p_route text,
  p_app_version text,
  p_user_agent text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  fp text := left(coalesce(nullif(btrim(p_fingerprint), ''), 'unknown'), 120);
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in (
    'crash', 'route', 'error', 'unhandled', 'chunk', 'sync_rejected', 'step'
  ) then
    return false;
  end if;
  -- Kept 30 days, as the privacy policy says. Cheap: the index on day finds them.
  delete from public.client_errors e where e.day < today - 30;
  -- A repeat of today's report only counts.
  update public.client_errors e
     set count = e.count + 1, last_at = now()
   where e.user_id = uid and e.day = today and e.kind = p_kind and e.fingerprint = fp;
  if found then
    return true;
  end if;
  if (
    select count(*) from public.client_errors e where e.user_id = uid and e.day = today
  ) >= 20 then
    return false;
  end if;
  insert into public.client_errors (
    user_id, day, app_version, route, kind, fingerprint, message, stack, user_agent
  )
  values (
    uid,
    today,
    left(coalesce(p_app_version, ''), 40),
    left(coalesce(p_route, ''), 80),
    p_kind,
    fp,
    left(coalesce(p_message, ''), 300),
    left(coalesce(p_stack, ''), 1500),
    left(coalesce(p_user_agent, ''), 200)
  )
  on conflict (user_id, day, kind, fingerprint)
  do update set count = public.client_errors.count + 1, last_at = now();
  return true;
end;
$$;
revoke all on function public.report_client_error(text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.report_client_error(text, text, text, text, text, text, text)
  to authenticated;
