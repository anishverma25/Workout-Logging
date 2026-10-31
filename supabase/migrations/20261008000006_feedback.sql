-- Feedback from people using the app: a rating, quick tags and a message.
--
-- People add feedback only through submit_feedback (validated, at most 10 a day) and read only
-- their own through get_my_feedback. The administrator reads everything in the dashboard and
-- can mark feedback as seen or reply (see docs/admin-pro-payments.md); the reply is shown to the
-- person in the app.

create table if not exists public.feedback (
  -- Made on the phone, so feedback written offline is sent exactly once.
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  tags text[] not null default '{}'
    check (tags <@ array['love', 'idea', 'confusing', 'bug']::text[]),
  message text not null default '' check (char_length(message) <= 2000),
  -- Where it was sent from, to help with bugs. Nothing else about the device is kept.
  source text not null default 'more' check (source in ('more', 'prompt', 'error', 'pro')),
  screen text check (char_length(screen) <= 120),
  app_version text check (char_length(app_version) <= 40),
  created_at timestamptz not null default now(),
  -- For the administrator: when it was read, and an optional reply.
  seen_at timestamptz,
  reply text check (char_length(reply) <= 2000),
  replied_at timestamptz,
  check (rating is not null or btrim(message) <> '')
);

create index if not exists feedback_user_created on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;
alter table public.feedback force row level security;
-- Defence in depth: even with a grant, a user could only ever see their own rows.
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(
  p_id uuid,
  p_rating integer,
  p_tags text[],
  p_message text,
  p_source text,
  p_screen text,
  p_app_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(p_message, ''));
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  -- Sent twice (a retry after a lost answer): nothing to do.
  if exists (select 1 from public.feedback f where f.id = p_id and f.user_id = uid) then
    return true;
  end if;
  if p_rating is null and clean = '' then
    raise exception 'Add a rating or a message' using errcode = '22023';
  end if;
  if (
    select count(*) from public.feedback f
    where f.user_id = uid and f.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'Too much feedback today. Try again tomorrow' using errcode = '22023';
  end if;
  insert into public.feedback (id, user_id, rating, tags, message, source, screen, app_version)
  values (
    p_id,
    uid,
    p_rating,
    coalesce(p_tags, '{}'),
    clean,
    coalesce(p_source, 'more'),
    left(p_screen, 120),
    left(p_app_version, 40)
  );
  return true;
end;
$$;

create or replace function public.get_my_feedback()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'rating', f.rating,
          'tags', f.tags,
          'message', f.message,
          'created_at', f.created_at,
          'seen_at', f.seen_at,
          'reply', f.reply,
          'replied_at', f.replied_at
        )
        order by f.created_at desc
      )
      from (
        select * from public.feedback where user_id = uid order by created_at desc limit 50
      ) f
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.submit_feedback(uuid, integer, text[], text, text, text, text)
  from public, anon;
revoke all on function public.get_my_feedback() from public, anon;
grant execute on function public.submit_feedback(uuid, integer, text[], text, text, text, text)
  to authenticated;
grant execute on function public.get_my_feedback() to authenticated;
