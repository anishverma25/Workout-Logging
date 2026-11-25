-- Community (November 2026): questions and journeys, replies, Helpful and Support, optional
-- anonymity on every post and reply, photos, karma with a 30-day Pro reward, reports, blocks,
-- Macrotrophy Verified creators, and the owner's SQL tools. Spec: docs/community.md. Owner SQL:
-- docs/community-owner-sql.md.
--
-- Names: the groups and leaderboards already use `community_*` for their own functions, so the
-- forum's tables and member functions are `forum_*`. The owner's tools are `community_owner_*`.
--
-- Privacy model:
-- - Every row stores the real author (`author`), set from auth.uid() on the server. Members never
--   read these tables directly (no grants); they read through forum_* functions that return a
--   public identity object: a username, a photo and a verified mark, or an anonymous label that
--   is only stable inside one thread ("Anonymous Lifter 2"). Anonymous content never carries a
--   username, photo, verified mark, profile link or the real id.
-- - The owner finds the real account with community_owner_find_author (SQL editor only).
-- - Bans, mutes, limits and karma apply to the account, whatever the post's display identity.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------

create table if not exists public.forum_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rules_accepted_at timestamptz,
  banned_at timestamptz,
  ban_reason text,
  muted_until timestamptz,
  mute_reason text,
  -- Macrotrophy Verified: granted and removed only by the owner (community_owner_verify).
  verified_at timestamptz,
  verified_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  author uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('question', 'journey')),
  topic text not null check (topic in ('training', 'nutrition', 'technique', 'beginner', 'journeys')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 3000),
  anonymous boolean not null default false,
  -- visible, held (waiting for the owner), hidden (removed by the owner), deleted (by the author)
  status text not null default 'visible' check (status in ('visible', 'held', 'hidden', 'deleted')),
  card jsonb,
  best_reply uuid,
  reply_count integer not null default 0,
  helpful_count integer not null default 0,
  support_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'B')
  ) stored,
  unique (author, client_id)
);
create index if not exists forum_posts_latest_idx on public.forum_posts (created_at desc, id desc);
create index if not exists forum_posts_author_idx on public.forum_posts (author, created_at desc);
create index if not exists forum_posts_search_idx on public.forum_posts using gin (search);
create index if not exists forum_posts_topic_idx on public.forum_posts (topic, created_at desc);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  author uuid not null references auth.users (id) on delete cascade,
  anonymous boolean not null default false,
  body text not null default '' check (char_length(body) <= 2000),
  -- A reply it refers to (one level only: replies are never nested).
  quote_reply uuid references public.forum_replies (id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'held', 'hidden', 'deleted')),
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (author, client_id)
);
create index if not exists forum_replies_post_idx on public.forum_replies (post_id, created_at);
create index if not exists forum_replies_author_idx on public.forum_replies (author, created_at desc);

alter table public.forum_posts drop constraint if exists forum_posts_best_reply_fkey;
alter table public.forum_posts add constraint forum_posts_best_reply_fkey
  foreign key (best_reply) references public.forum_replies (id) on delete set null;

-- Photos: resized and re-encoded on the phone (which drops EXIF and GPS), checked again here.
-- Kept in Postgres as JPEG data URLs and only ever served through forum_* functions to signed-in
-- members who may see the post. Never public URLs.
create table if not exists public.forum_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  full_data text check (full_data is null or (
    length(full_data) <= 400000 and full_data ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+$')),
  thumb_data text check (thumb_data is null or (
    length(thumb_data) <= 80000 and thumb_data ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+$')),
  width integer not null check (width between 16 and 4096),
  height integer not null check (height between 16 and 4096),
  status text not null default 'visible' check (status in ('visible', 'held', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create table if not exists public.forum_reactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'reply')),
  target_id uuid not null,
  reaction text not null check (reaction in ('helpful', 'support')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_kind, target_id, reaction)
);
create index if not exists forum_reactions_target_idx on public.forum_reactions (target_kind, target_id);

create table if not exists public.forum_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.forum_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.forum_hidden (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- Blocks. `anonymous_only`: made from an anonymous post or reply, so it hides that person's
-- anonymous content only; their username content stays, so a block never reveals who they are.
create table if not exists public.forum_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  anonymous_only boolean not null default false,
  -- What the blocker saw, for their list: "@name" or "Anonymous Lifter in: <title>".
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (blocker, blocked, anonymous_only)
);

create table if not exists public.forum_activity (
  id bigint generated always as identity primary key,
  recipient uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'reply', 'followed_reply', 'best_answer', 'karma_milestone', 'reward', 'moderation')),
  post_id uuid references public.forum_posts (id) on delete cascade,
  reply_id uuid references public.forum_replies (id) on delete cascade,
  -- The public name of who did it ("@name" or "Anonymous Lifter 2"), never an id.
  actor text not null default '',
  detail text not null default '',
  dedupe text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient, dedupe)
);
create index if not exists forum_activity_recipient_idx on public.forum_activity (recipient, id desc);

create table if not exists public.forum_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'reply', 'media', 'member')),
  target_id uuid not null,
  reason text not null check (reason in (
    'harassment', 'explicit', 'spam', 'health_risk', 'self_harm', 'privacy', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  priority text not null default 'normal' check (priority in ('urgent', 'normal')),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  unique (reporter, target_kind, target_id)
);
create index if not exists forum_reports_open_idx on public.forum_reports (status, priority, created_at);

-- Every owner action and every automatic hold. Never updated or deleted.
create table if not exists public.forum_mod_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  target_kind text,
  target_id uuid,
  user_id uuid,
  reason text not null default '',
  report_id bigint,
  actor text not null default current_user
);

-- The text before every edit or delete, for reports and appeals. Never shown to members.
create table if not exists public.forum_edits (
  id bigint generated always as identity primary key,
  target_kind text not null check (target_kind in ('post', 'reply')),
  target_id uuid not null,
  title text,
  body text,
  anonymous boolean,
  action text not null check (action in ('edit', 'delete')),
  at timestamptz not null default now()
);

-- Karma, append-only. A reversal is a new row pointing at the award it cancels.
create table if not exists public.forum_karma (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  source text not null check (source in ('helpful_reply', 'helpful_post', 'best_answer', 'owner', 'reversal')),
  target_id uuid,
  voter uuid,
  reverses bigint references public.forum_karma (id),
  reason text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists forum_karma_reverses_key on public.forum_karma (reverses)
  where reverses is not null;
create index if not exists forum_karma_user_idx on public.forum_karma (user_id, created_at);
create index if not exists forum_karma_source_idx on public.forum_karma (source, target_id, voter);

-- Owner-adjustable reward rules (one row). Changing them is one update.
create table if not exists public.forum_reward_rules (
  id boolean primary key default true check (id),
  karma integer not null default 300,
  window_days integer not null default 180,
  best_answers integer not null default 3,
  helpful_voters integer not null default 15,
  replies integer not null default 12,
  reply_threads integer not null default 8,
  active_days integer not null default 10,
  account_days integer not null default 30,
  reward_days integer not null default 30,
  -- Helpful votes from one member to another that count for karma.
  voter_daily integer not null default 5,
  voter_monthly integer not null default 20,
  -- A voter's account must be this old for their votes to give karma.
  voter_account_days integer not null default 3,
  updated_at timestamptz not null default now()
);
insert into public.forum_reward_rules (id) values (true) on conflict (id) do nothing;

create table if not exists public.forum_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  status text not null check (status in ('applied', 'held', 'revoked')),
  days integer not null,
  snapshot jsonb not null,
  claimed_at timestamptz not null default now(),
  applied_at timestamptz,
  pro_until timestamptz,
  unique (user_id, client_id)
);
create index if not exists forum_reward_claims_user_idx on public.forum_reward_claims (user_id, claimed_at desc);

-- Locked down: members reach all of this only through the functions below.
do $$
declare t text;
begin
  foreach t in array array[
    'forum_members', 'forum_posts', 'forum_replies', 'forum_media', 'forum_reactions',
    'forum_saves', 'forum_follows', 'forum_hidden', 'forum_blocks', 'forum_activity',
    'forum_reports', 'forum_mod_log', 'forum_edits', 'forum_karma', 'forum_reward_rules',
    'forum_reward_claims'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Helpers (not callable by members)
-- ---------------------------------------------------------------------------------------------

-- The switches in app_settings.flags: community, community_posting, community_photos,
-- community_rewards. Anything left out is on.
create or replace function public.forum_flag(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.flags ->> p_name) <> 'false' from public.app_settings s where s.id), true);
$$;
revoke all on function public.forum_flag(text) from public, anon, authenticated;

create or replace function public.forum_is_verified(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.forum_members m
                 where m.user_id = p_user and m.verified_at is not null);
$$;
revoke all on function public.forum_is_verified(uuid) from public, anon, authenticated;

-- Under 18 by the birth date on their profile: read-only.
create or replace function public.forum_is_minor(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pr.birth_date > (current_date - interval '18 years')
    from public.profiles pr
    where pr.user_id = p_user and pr.deleted_at is null and pr.birth_date is not null
    order by pr.updated_at desc limit 1
  ), false);
$$;
revoke all on function public.forum_is_minor(uuid) from public, anon, authenticated;

create or replace function public.forum_banned(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.forum_members m
                 where m.user_id = p_user and m.banned_at is not null);
$$;
revoke all on function public.forum_banned(uuid) from public, anon, authenticated;

-- Why this account cannot write now, or null. One check for every write.
create or replace function public.forum_write_problem(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare m public.forum_members;
begin
  if p_user is null then return 'signed_out'; end if;
  if not public.forum_flag('community') or not public.forum_flag('community_posting') then
    return 'paused';
  end if;
  select * into m from public.forum_members where user_id = p_user;
  if m.banned_at is not null then return 'banned'; end if;
  if m.muted_until is not null and m.muted_until > now() then return 'muted'; end if;
  if not exists (select 1 from public.usernames u where u.user_id = p_user) then
    return 'username';
  end if;
  if m.rules_accepted_at is null then return 'rules'; end if;
  if public.forum_is_minor(p_user) then return 'minor'; end if;
  return null;
end;
$$;
revoke all on function public.forum_write_problem(uuid) from public, anon, authenticated;

create or replace function public.forum_require_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  problem text := public.forum_write_problem(uid);
begin
  if problem is not null then
    raise exception 'Community: %', problem using errcode = 'P0001';
  end if;
  return uid;
end;
$$;
revoke all on function public.forum_require_writer() from public, anon, authenticated;

-- Whether a viewer sees content by `p_author` posted with this display identity.
create or replace function public.forum_can_see(p_viewer uuid, p_author uuid, p_anonymous boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer = p_author or not exists (
    select 1 from public.forum_blocks b
    where b.blocker = p_viewer and b.blocked = p_author and (not b.anonymous_only or p_anonymous)
  );
$$;
revoke all on function public.forum_can_see(uuid, uuid, boolean) from public, anon, authenticated;

-- "Anonymous Lifter", "Anonymous Lifter 2": the order anonymous people first wrote in this
-- thread. Different threads give unrelated labels.
create or replace function public.forum_anon_label(p_post uuid, p_author uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with firsts as (
    select a.author, min(a.at) as at
    from (
      select p.author, p.created_at as at from public.forum_posts p
      where p.id = p_post and p.anonymous
      union all
      select r.author, r.created_at from public.forum_replies r
      where r.post_id = p_post and r.anonymous
    ) a
    group by a.author
  ),
  ranked as (
    select f.author, row_number() over (order by f.at, f.author) as n from firsts f
  )
  select case when coalesce(n, 1) = 1 then 'Anonymous Lifter' else 'Anonymous Lifter ' || n end
  from (select (select r.n from ranked r where r.author = p_author) as n) x;
$$;
revoke all on function public.forum_anon_label(uuid, uuid) from public, anon, authenticated;

create or replace function public.forum_username(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.username from public.usernames u where u.user_id = p_user;
$$;
revoke all on function public.forum_username(uuid) from public, anon, authenticated;

create or replace function public.forum_avatar(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pr.avatar from public.profiles pr
  where pr.user_id = p_user and pr.deleted_at is null and pr.avatar is not null
  order by pr.updated_at desc limit 1;
$$;
revoke all on function public.forum_avatar(uuid) from public, anon, authenticated;

-- The only shape in which an author leaves the server.
create or replace function public.forum_author(p_post uuid, p_author uuid, p_anonymous boolean, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_anonymous then jsonb_build_object(
      'anonymous', true,
      'label', public.forum_anon_label(p_post, p_author),
      'me', p_author = p_viewer)
    else jsonb_build_object(
      'anonymous', false,
      'username', coalesce(public.forum_username(p_author), 'member'),
      'avatar', public.forum_avatar(p_author),
      'verified', public.forum_is_verified(p_author),
      'me', p_author = p_viewer)
  end;
$$;
revoke all on function public.forum_author(uuid, uuid, boolean, uuid) from public, anon, authenticated;

-- Text checks shared by posts and replies: words, links, phone numbers.
create or replace function public.forum_text_problem(p_text text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare links integer;
begin
  if public.community_blocked(p_text)
     and regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]', '', 'g') ~
       'fuck|bitch|cunt|chutiya|chutiye|madarchod|behenchod|bhenchod|bhosdi|bhosda|gandu|randi|lauda|lavda|nazi|hitler'
  then
    return 'words';
  end if;
  select count(*) into links from regexp_matches(coalesce(p_text, ''), 'https?://', 'gi');
  if links > 3 then return 'links'; end if;
  if coalesce(p_text, '') ~* '(whatsapp|telegram|dm me|call me)[^.]{0,30}[0-9]{5}'
     -- An Indian mobile number on its own, not digits inside a longer number.
     or coalesce(p_text, '') ~ '(^|[^0-9])(\+?91[ -]?)?[6-9][0-9]{4}[ -]?[0-9]{5}([^0-9]|$)' then
    return 'contact';
  end if;
  if coalesce(p_text, '') ~* '(buy|order|sourc|selling|for sale)[^.]{0,40}(steroid|sarm|testosterone|tren|anavar|dianabol|clen)'
  then
    return 'drugs';
  end if;
  return null;
end;
$$;

create or replace function public.forum_check_text(p_text text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare problem text := public.forum_text_problem(p_text);
begin
  if problem is not null then
    raise exception 'Community text: %', problem using errcode = 'P0001';
  end if;
end;
$$;

-- New accounts get tighter limits. Raises when a limit is reached.
create or replace function public.forum_rate_limit(p_user uuid, p_what text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  young boolean := coalesce(
    (select u.created_at > now() - interval '14 days' from auth.users u where u.id = p_user), true);
  n integer;
begin
  if p_what = 'post' then
    select count(*) into n from public.forum_posts p
    where p.author = p_user and p.created_at > now() - interval '1 day';
    if n >= (case when young then 3 else 10 end) then
      raise exception 'Community limit: posts' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.forum_posts p
               where p.author = p_user and p.created_at > now() - interval '60 seconds') then
      raise exception 'Community limit: slow down' using errcode = 'P0001';
    end if;
  elsif p_what = 'reply' then
    select count(*) into n from public.forum_replies r
    where r.author = p_user and r.created_at > now() - interval '1 day';
    if n >= (case when young then 20 else 80 end) then
      raise exception 'Community limit: replies' using errcode = 'P0001';
    end if;
    if (select count(*) from public.forum_replies r
        where r.author = p_user and r.created_at > now() - interval '60 seconds') >= 4 then
      raise exception 'Community limit: slow down' using errcode = 'P0001';
    end if;
  end if;
end;
$$;
revoke all on function public.forum_rate_limit(uuid, text) from public, anon, authenticated;

create or replace function public.forum_notify(
  p_recipient uuid, p_kind text, p_post uuid, p_reply uuid, p_actor text, p_detail text, p_dedupe text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.forum_activity (recipient, kind, post_id, reply_id, actor, detail, dedupe)
  values (p_recipient, p_kind, p_post, p_reply, coalesce(p_actor, ''), coalesce(p_detail, ''), p_dedupe)
  on conflict (recipient, dedupe) do nothing;
$$;
revoke all on function public.forum_notify(uuid, text, uuid, uuid, text, text, text) from public, anon, authenticated;

-- Whether a vote from `p_voter` for `p_author` may earn karma (eligible voter, under the caps).
create or replace function public.forum_vote_counts(p_voter uuid, p_author uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rules public.forum_reward_rules;
  given_day integer;
  given_month integer;
begin
  select * into rules from public.forum_reward_rules where id;
  if p_voter = p_author or public.forum_banned(p_voter) then return false; end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_voter and u.email_confirmed_at is not null
      and u.created_at <= now() - make_interval(days => rules.voter_account_days)
  ) then
    return false;
  end if;
  select count(*) filter (where k.created_at > now() - interval '1 day'),
         count(*) filter (where k.created_at > now() - interval '30 days')
  into given_day, given_month
  from public.forum_karma k
  where k.voter = p_voter and k.user_id = p_author and k.delta > 0
    and k.source in ('helpful_reply', 'helpful_post')
    and not exists (select 1 from public.forum_karma r where r.reverses = k.id);
  return given_day < rules.voter_daily and given_month < rules.voter_monthly;
end;
$$;
revoke all on function public.forum_vote_counts(uuid, uuid) from public, anon, authenticated;

create or replace function public.forum_reverse(p_award bigint, p_reason text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.forum_karma (user_id, delta, source, target_id, voter, reverses, reason)
  select k.user_id, -k.delta, 'reversal', k.target_id, k.voter, k.id, p_reason
  from public.forum_karma k
  where k.id = p_award
    and not exists (select 1 from public.forum_karma r where r.reverses = k.id)
  on conflict do nothing;
$$;
revoke all on function public.forum_reverse(bigint, text) from public, anon, authenticated;

-- Reverses every award that came from one post or reply (removed for abuse or deleted).
create or replace function public.forum_reverse_target(p_target uuid, p_reason text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select public.forum_reverse(k.id, p_reason)
  from public.forum_karma k
  where k.target_id = p_target and k.delta > 0 and k.source <> 'reversal'
    and not exists (select 1 from public.forum_karma r where r.reverses = k.id);
$$;
revoke all on function public.forum_reverse_target(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Reading
-- ---------------------------------------------------------------------------------------------

-- One post as a card (feed) or in full (detail).
create or replace function public.forum_post_json(p public.forum_posts, p_viewer uuid, p_full boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'kind', p.kind,
    'topic', p.topic,
    'title', p.title,
    'body', case when p_full then p.body else left(p.body, 280) end,
    'author', public.forum_author(p.id, p.author, p.anonymous, p_viewer),
    'status', p.status,
    'card', p.card,
    'answered', p.best_reply is not null,
    'best_reply', p.best_reply,
    'replies', p.reply_count,
    'helpful', p.helpful_count,
    'support', p.support_count,
    'created_at', p.created_at,
    'edited', p.edited_at is not null,
    'mine', p.author = p_viewer,
    'my_helpful', exists (select 1 from public.forum_reactions x where x.user_id = p_viewer
      and x.target_kind = 'post' and x.target_id = p.id and x.reaction = 'helpful'),
    'my_support', exists (select 1 from public.forum_reactions x where x.user_id = p_viewer
      and x.target_kind = 'post' and x.target_id = p.id and x.reaction = 'support'),
    'saved', exists (select 1 from public.forum_saves s where s.user_id = p_viewer and s.post_id = p.id),
    'following', exists (select 1 from public.forum_follows f where f.user_id = p_viewer and f.post_id = p.id),
    'photo_count', (select count(*) from public.forum_media m where m.post_id = p.id
      and (m.status = 'visible' or (m.status = 'held' and p.author = p_viewer))),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'thumb', m.thumb_data, 'w', m.width, 'h', m.height, 'held', m.status = 'held')
        order by m.position)
      from public.forum_media m
      where m.post_id = p.id
        and (m.status = 'visible' or (m.status = 'held' and p.author = p_viewer))
        and (p_full or m.position = 0)
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.forum_post_json(public.forum_posts, uuid, boolean) from public, anon, authenticated;

-- Whether a viewer sees this post in lists and by link.
create or replace function public.forum_post_visible(p public.forum_posts, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p.status = 'visible' or (p.status = 'held' and p.author = p_viewer))
    and public.forum_can_see(p_viewer, p.author, p.anonymous)
    and not exists (select 1 from public.forum_hidden h where h.user_id = p_viewer and h.post_id = p.id);
$$;
revoke all on function public.forum_post_visible(public.forum_posts, uuid) from public, anon, authenticated;

-- The feed. p_mode: for_you, latest, unanswered. p_cursor: an offset as text. 20 a page.
create or replace function public.forum_feed(
  p_mode text, p_topic text, p_kind text, p_query text, p_cursor text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  q text := nullif(btrim(coalesce(p_query, '')), '');
  off integer := greatest(coalesce(nullif(p_cursor, '')::integer, 0), 0);
  items jsonb;
  n integer;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not public.forum_flag('community') then
    return jsonb_build_object('items', '[]'::jsonb, 'next', null, 'paused', true);
  end if;
  with base as (
    select p.id,
      row_number() over (order by
        case when q is not null then
          ts_rank(p.search, websearch_to_tsquery('simple', q))
          + case when p.title ilike '%' || q || '%' then 2 when p.body ilike '%' || q || '%' then 1 else 0 end
        end desc nulls last,
        -- For you: fresh discussions first, unanswered questions lifted, reactions count a little.
        case when p_mode = 'for_you' and q is null then
          (extract(epoch from p.last_activity_at) / 3600.0)
          + case when p.kind = 'question' and p.reply_count = 0 then 18 else 0 end
          + least(p.helpful_count + p.reply_count, 20) * 0.6
        end desc nulls last,
        p.created_at desc, p.id desc) as ord
    from public.forum_posts p
    where public.forum_post_visible(p, uid)
      and (p_topic is null or p_topic = '' or p.topic = p_topic)
      and (p_kind is null or p_kind = '' or p.kind = p_kind)
      and (coalesce(p_mode, '') <> 'unanswered' or (p.kind = 'question' and p.best_reply is null and p.reply_count = 0))
      and (q is null or p.search @@ websearch_to_tsquery('simple', q)
           or p.title ilike '%' || q || '%' or p.body ilike '%' || q || '%')
  ),
  page as (select b.id, b.ord from base b where b.ord > off and b.ord <= off + 21)
  select coalesce(jsonb_agg(public.forum_post_json(p, uid, false) order by pg.ord)
                    filter (where pg.ord <= off + 20), '[]'::jsonb),
         count(*)
  into items, n
  from page pg join public.forum_posts p on p.id = pg.id;
  return jsonb_build_object('items', items, 'next', case when n > 20 then (off + 20)::text else null end);
end;
$$;
revoke all on function public.forum_feed(text, text, text, text, text) from public, anon;
grant execute on function public.forum_feed(text, text, text, text, text) to authenticated;

-- A post with its replies. Not found when it is hidden, deleted, blocked or does not exist.
create or replace function public.forum_post(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.forum_posts;
  replies jsonb;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into p from public.forum_posts where id = p_id;
  if not found or not public.forum_flag('community')
     or not (p.status = 'visible' or (p.status = 'held' and p.author = uid))
     or not public.forum_can_see(uid, p.author, p.anonymous) then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'body', case when r.status = 'deleted' then '' else r.body end,
      'deleted', r.status = 'deleted',
      'held', r.status = 'held',
      'author', case when r.status = 'deleted'
        then jsonb_build_object('anonymous', true, 'label', 'Deleted', 'me', false)
        else public.forum_author(p.id, r.author, r.anonymous, uid) end,
      'is_op', r.status <> 'deleted' and r.author = p.author and r.anonymous = p.anonymous,
      'best', p.best_reply = r.id,
      'helpful', r.helpful_count,
      'my_helpful', exists (select 1 from public.forum_reactions x where x.user_id = uid
        and x.target_kind = 'reply' and x.target_id = r.id and x.reaction = 'helpful'),
      'mine', r.author = uid and r.status <> 'deleted',
      'edited', r.edited_at is not null,
      'created_at', r.created_at,
      'quote', case when q.id is null then null else jsonb_build_object(
        'id', q.id,
        'label', case when q.status <> 'visible' then 'Removed'
          when q.anonymous then public.forum_anon_label(p.id, q.author)
          else '@' || coalesce(public.forum_username(q.author), 'member') end,
        'excerpt', case when q.status <> 'visible' then '' else left(q.body, 140) end) end
    ) order by (p.best_reply = r.id) desc, r.created_at), '[]'::jsonb)
  into replies
  from public.forum_replies r
  left join public.forum_replies q on q.id = r.quote_reply
  where r.post_id = p.id
    and (r.status = 'visible' or r.status = 'deleted' or (r.status = 'held' and r.author = uid))
    and (r.status = 'deleted' or public.forum_can_see(uid, r.author, r.anonymous))
    -- A deleted reply stays as a placeholder only when someone quoted it.
    and (r.status <> 'deleted' or exists (
      select 1 from public.forum_replies z where z.quote_reply = r.id and z.status = 'visible'));
  update public.forum_activity a set read_at = now()
  where a.recipient = uid and a.post_id = p.id and a.read_at is null;
  return public.forum_post_json(p, uid, true) || jsonb_build_object('reply_list', replies);
end;
$$;
revoke all on function public.forum_post(uuid) from public, anon;
grant execute on function public.forum_post(uuid) to authenticated;

-- A full-size photo.
create or replace function public.forum_photo(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m public.forum_media;
  p public.forum_posts;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into m from public.forum_media where id = p_id;
  if found then select * into p from public.forum_posts where id = m.post_id; end if;
  if m.id is null or p.id is null
     or not (m.status = 'visible' or (m.status = 'held' and m.owner = uid))
     or not public.forum_post_visible(p, uid) then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  return m.full_data;
end;
$$;
revoke all on function public.forum_photo(uuid) from public, anon;
grant execute on function public.forum_photo(uuid) to authenticated;

-- The signed-in member: what they can do, verified, unread, karma (theirs only).
create or replace function public.forum_me()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m public.forum_members;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into m from public.forum_members where user_id = uid;
  return jsonb_build_object(
    'username', public.forum_username(uid),
    'avatar', public.forum_avatar(uid),
    'verified', m.verified_at is not null,
    'rules_accepted', m.rules_accepted_at is not null,
    'problem', public.forum_write_problem(uid),
    'muted_until', m.muted_until,
    'enabled', public.forum_flag('community'),
    'photos', public.forum_flag('community_photos'),
    'rewards', public.forum_flag('community_rewards'),
    'unread', (select count(*) from public.forum_activity a where a.recipient = uid and a.read_at is null),
    'karma', (select coalesce(sum(k.delta), 0) from public.forum_karma k where k.user_id = uid)
  );
end;
$$;
revoke all on function public.forum_me() from public, anon;
grant execute on function public.forum_me() to authenticated;

-- Just the unread count, for Home and More.
create or replace function public.forum_unread()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.forum_activity a
  where a.recipient = auth.uid() and a.read_at is null;
$$;
revoke all on function public.forum_unread() from public, anon;
grant execute on function public.forum_unread() to authenticated;

-- Home: a few fresh posts for the Community card.
create or replace function public.forum_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not public.forum_flag('community') then return jsonb_build_object('paused', true); end if;
  return jsonb_build_object(
    'unread', public.forum_unread(),
    'unanswered', (select count(*) from public.forum_posts p
      where p.status = 'visible' and p.kind = 'question' and p.reply_count = 0
        and p.created_at > now() - interval '7 days'),
    'posts', coalesce((
      select jsonb_agg(public.forum_post_json(p, uid, false) order by p.last_activity_at desc)
      from public.forum_posts p
      where p.id in (select x.id from public.forum_posts x
                     where public.forum_post_visible(x, uid) and x.author <> uid
                     order by x.last_activity_at desc limit 2)
    ), '[]'::jsonb));
end;
$$;
revoke all on function public.forum_home() from public, anon;
grant execute on function public.forum_home() to authenticated;

-- A public profile: username content only. Anonymous posts and replies are never counted or
-- listed, and exact karma is never shown to others.
create or replace function public.forum_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  who uuid;
  lifetime integer;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select u.user_id into who from public.usernames u
  where u.username = lower(btrim(coalesce(p_username, '')));
  if who is null or not public.forum_can_see(uid, who, false) then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  select coalesce(sum(k.delta), 0) into lifetime from public.forum_karma k where k.user_id = who;
  return jsonb_build_object(
    'username', public.forum_username(who),
    'avatar', public.forum_avatar(who),
    'verified', public.forum_is_verified(who),
    'me', who = uid,
    'banned', public.forum_banned(who),
    'joined', (select min(x) from (
      select min(p.created_at) as x from public.forum_posts p where p.author = who and not p.anonymous
      union all select min(r.created_at) from public.forum_replies r where r.author = who and not r.anonymous) j),
    -- Broad recognition only, so anonymous help cannot be traced by watching a number move.
    'recognition', case when lifetime >= 300 then 'trusted' when lifetime >= 50 then 'helpful' else null end,
    'karma', case when who = uid then lifetime else null end,
    'answers', (select count(*) from public.forum_replies r join public.forum_posts p on p.id = r.post_id
                where r.author = who and not r.anonymous and r.status = 'visible' and p.status = 'visible'),
    'posts', coalesce((
      select jsonb_agg(public.forum_post_json(p, uid, false) order by p.created_at desc)
      from public.forum_posts p
      where p.id in (select x.id from public.forum_posts x
                     where x.author = who and not x.anonymous and x.status = 'visible'
                     order by x.created_at desc limit 20)), '[]'::jsonb),
    -- Their recent answers given with their username, in threads the viewer can see.
    'replies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'post_id', p.id, 'post_title', p.title, 'body', left(r.body, 200),
        'helpful', r.helpful_count, 'best', p.best_reply = r.id, 'created_at', r.created_at)
        order by r.created_at desc)
      from public.forum_replies r join public.forum_posts p on p.id = r.post_id
      where r.id in (select x.id from public.forum_replies x
                     where x.author = who and not x.anonymous and x.status = 'visible'
                     order by x.created_at desc limit 40)
        and public.forum_post_visible(p, uid)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.forum_profile(text) from public, anon;
grant execute on function public.forum_profile(text) to authenticated;

-- Mine: my posts (anonymous ones too, marked), my replies, saved, following.
create or replace function public.forum_mine(p_tab text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_tab = 'replies' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'post_id', p.id, 'post_title', p.title, 'body', left(r.body, 200),
        'anonymous', r.anonymous, 'helpful', r.helpful_count, 'best', p.best_reply = r.id,
        'held', r.status = 'held', 'created_at', r.created_at) order by r.created_at desc)
      from (select * from public.forum_replies x where x.author = uid and x.status in ('visible', 'held')
            order by x.created_at desc limit 50) r
      join public.forum_posts p on p.id = r.post_id
      where p.status in ('visible', 'held')), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(public.forum_post_json(p, uid, false) || jsonb_build_object('anonymous', p.anonymous)
                     order by p.created_at desc)
    from public.forum_posts p
    where p.id in (
      select x.id from public.forum_posts x
      where case p_tab
        when 'saved' then exists (select 1 from public.forum_saves s where s.user_id = uid and s.post_id = x.id)
          and public.forum_post_visible(x, uid)
        when 'following' then exists (select 1 from public.forum_follows f where f.user_id = uid and f.post_id = x.id)
          and public.forum_post_visible(x, uid)
        else x.author = uid and x.status in ('visible', 'held') end
      order by x.created_at desc limit 50
    )), '[]'::jsonb);
end;
$$;
revoke all on function public.forum_mine(text) from public, anon;
grant execute on function public.forum_mine(text) to authenticated;

create or replace function public.forum_activity_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'kind', a.kind, 'post_id', a.post_id, 'reply_id', a.reply_id,
    'post_title', p.title, 'actor', a.actor, 'detail', a.detail,
    'created_at', a.created_at, 'read', a.read_at is not null) order by a.id desc), '[]'::jsonb)
  from (select * from public.forum_activity x where x.recipient = auth.uid()
        order by x.id desc limit 60) a
  left join public.forum_posts p on p.id = a.post_id;
$$;
revoke all on function public.forum_activity_list() from public, anon;
grant execute on function public.forum_activity_list() to authenticated;

create or replace function public.forum_activity_read()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.forum_activity set read_at = now()
  where recipient = auth.uid() and read_at is null;
$$;
revoke all on function public.forum_activity_read() from public, anon;
grant execute on function public.forum_activity_read() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Writing
-- ---------------------------------------------------------------------------------------------

create or replace function public.forum_accept_rules()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  insert into public.forum_members (user_id, rules_accepted_at) values (uid, now())
  on conflict (user_id) do update
    set rules_accepted_at = coalesce(public.forum_members.rules_accepted_at, now()), updated_at = now();
end;
$$;
revoke all on function public.forum_accept_rules() from public, anon;
grant execute on function public.forum_accept_rules() to authenticated;

-- A progress card worked out here from the member's synced workouts, never sent by the phone.
create or replace function public.forum_card(p_user uuid, p_card text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days integer;
  n integer;
begin
  if p_card is null or p_card = '' then return null; end if;
  days := case p_card when 'workouts_30' then 30 when 'workouts_90' then 90
                      when 'workouts_365' then 365 when 'workouts_all' then null else -1 end;
  if days = -1 then raise exception 'Community: card' using errcode = 'P0001'; end if;
  select count(*) into n from public.workouts w
  where w.user_id = p_user and w.status = 'completed' and w.deleted_at is null
    and (days is null or w.started_at > now() - make_interval(days => days));
  -- Nothing synced for that period: no card, never a card that says 0.
  if n = 0 then return null; end if;
  return jsonb_build_object(
    'type', 'workouts', 'value', n, 'days', days,
    'label', case when days is null then 'Workouts logged' else 'Workouts in ' || days || ' days' end);
end;
$$;
revoke all on function public.forum_card(uuid, text) from public, anon, authenticated;

create or replace function public.forum_create_post(
  p_client uuid, p_kind text, p_topic text, p_title text, p_body text, p_anonymous boolean,
  p_media jsonb, p_card text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.forum_require_writer();
  existing uuid;
  new_id uuid;
  m jsonb;
  i integer := 0;
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_body text := btrim(coalesce(p_body, ''));
begin
  select p.id into existing from public.forum_posts p where p.author = uid and p.client_id = p_client;
  if existing is not null then return existing; end if;
  perform public.forum_rate_limit(uid, 'post');
  if char_length(v_title) < 3 or char_length(v_title) > 120 then
    raise exception 'Community: title' using errcode = 'P0001';
  end if;
  if char_length(v_body) > (case when p_kind = 'journey' then 3000 else 2000 end) then
    raise exception 'Community: body' using errcode = 'P0001';
  end if;
  perform public.forum_check_text(v_title || ' ' || v_body);
  if p_media is not null and jsonb_typeof(p_media) = 'array' and jsonb_array_length(p_media) > 0 then
    if not public.forum_flag('community_photos') then
      raise exception 'Community: photos paused' using errcode = 'P0001';
    end if;
    if jsonb_array_length(p_media) > 4 then
      raise exception 'Community: photos' using errcode = 'P0001';
    end if;
  end if;
  insert into public.forum_posts (client_id, author, kind, topic, title, body, anonymous, card)
  values (p_client, uid, p_kind, p_topic, v_title, v_body, coalesce(p_anonymous, false),
          public.forum_card(uid, p_card))
  returning id into new_id;
  if p_media is not null and jsonb_typeof(p_media) = 'array' then
    for m in select * from jsonb_array_elements(p_media) loop
      insert into public.forum_media (post_id, owner, position, full_data, thumb_data, width, height)
      values (new_id, uid, i, m ->> 'full', m ->> 'thumb', (m ->> 'w')::integer, (m ->> 'h')::integer);
      i := i + 1;
    end loop;
  end if;
  insert into public.forum_follows (user_id, post_id) values (uid, new_id) on conflict do nothing;
  return new_id;
end;
$$;
revoke all on function public.forum_create_post(uuid, text, text, text, text, boolean, jsonb, text) from public, anon;
grant execute on function public.forum_create_post(uuid, text, text, text, text, boolean, jsonb, text) to authenticated;

create or replace function public.forum_reply(
  p_client uuid, p_post uuid, p_body text, p_anonymous boolean, p_quote uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.forum_require_writer();
  existing uuid;
  p public.forum_posts;
  new_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_label text;
  f record;
begin
  select r.id into existing from public.forum_replies r where r.author = uid and r.client_id = p_client;
  if existing is not null then return existing; end if;
  select * into p from public.forum_posts where id = p_post for update;
  if not found or p.status <> 'visible' or not public.forum_can_see(uid, p.author, p.anonymous) then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  perform public.forum_rate_limit(uid, 'reply');
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'Community: body' using errcode = 'P0001';
  end if;
  perform public.forum_check_text(v_body);
  if p_quote is not null and not exists (
    select 1 from public.forum_replies q where q.id = p_quote and q.post_id = p_post and q.status = 'visible') then
    p_quote := null;
  end if;
  insert into public.forum_replies (client_id, post_id, author, anonymous, body, quote_reply)
  values (p_client, p_post, uid, coalesce(p_anonymous, false), v_body, p_quote)
  returning id into new_id;
  update public.forum_posts
  set reply_count = reply_count + 1, last_activity_at = now()
  where id = p_post;
  v_label := case when coalesce(p_anonymous, false) then public.forum_anon_label(p_post, uid)
                else '@' || public.forum_username(uid) end;
  if p.author <> uid and public.forum_can_see(p.author, uid, coalesce(p_anonymous, false)) then
    perform public.forum_notify(p.author, 'reply', p_post, new_id, v_label, left(v_body, 120), 'reply:' || new_id);
  end if;
  for f in select fo.user_id from public.forum_follows fo
           where fo.post_id = p_post and fo.user_id not in (uid, p.author) loop
    if public.forum_can_see(f.user_id, uid, coalesce(p_anonymous, false)) then
      perform public.forum_notify(f.user_id, 'followed_reply', p_post, new_id, v_label, left(v_body, 120),
                                  'reply:' || new_id);
    end if;
  end loop;
  insert into public.forum_follows (user_id, post_id) values (uid, p_post) on conflict do nothing;
  return new_id;
end;
$$;
revoke all on function public.forum_reply(uuid, uuid, text, boolean, uuid) from public, anon;
grant execute on function public.forum_reply(uuid, uuid, text, boolean, uuid) to authenticated;

-- Edits keep the old text in forum_edits. The same "not found" for someone else's content as
-- for content that does not exist, so ownership cannot be probed.
create or replace function public.forum_edit_post(p_id uuid, p_title text, p_body text, p_topic text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.forum_require_writer();
  p public.forum_posts;
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into p from public.forum_posts where id = p_id and author = uid for update;
  if not found or p.status not in ('visible', 'held') then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  if char_length(v_title) < 3 or char_length(v_title) > 120
     or char_length(v_body) > (case when p.kind = 'journey' then 3000 else 2000 end) then
    raise exception 'Community: body' using errcode = 'P0001';
  end if;
  perform public.forum_check_text(v_title || ' ' || v_body);
  if v_title = p.title and v_body = p.body and coalesce(p_topic, p.topic) = p.topic then return; end if;
  insert into public.forum_edits (target_kind, target_id, title, body, anonymous, action)
  values ('post', p.id, p.title, p.body, p.anonymous, 'edit');
  update public.forum_posts
  set title = v_title, body = v_body, topic = coalesce(nullif(p_topic, ''), p.topic), edited_at = now()
  where id = p.id;
end;
$$;
revoke all on function public.forum_edit_post(uuid, text, text, text) from public, anon;
grant execute on function public.forum_edit_post(uuid, text, text, text) to authenticated;

create or replace function public.forum_edit_reply(p_id uuid, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.forum_require_writer();
  r public.forum_replies;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into r from public.forum_replies where id = p_id and author = uid for update;
  if not found or r.status not in ('visible', 'held') then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'Community: body' using errcode = 'P0001';
  end if;
  perform public.forum_check_text(v_body);
  if v_body = r.body then return; end if;
  insert into public.forum_edits (target_kind, target_id, body, anonymous, action)
  values ('reply', r.id, r.body, r.anonymous, 'edit');
  update public.forum_replies set body = v_body, edited_at = now() where id = r.id;
end;
$$;
revoke all on function public.forum_edit_reply(uuid, text) from public, anon;
grant execute on function public.forum_edit_reply(uuid, text) to authenticated;

-- Deleting your own post or reply. Banned members may still delete their own content.
create or replace function public.forum_delete(p_kind text, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.forum_posts;
  r public.forum_replies;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_kind = 'post' then
    select * into p from public.forum_posts where id = p_id and author = uid for update;
    if not found or p.status = 'deleted' then
      raise exception 'Community: not found' using errcode = 'P0002';
    end if;
    insert into public.forum_edits (target_kind, target_id, title, body, anonymous, action)
    values ('post', p.id, p.title, p.body, p.anonymous, 'delete');
    update public.forum_posts set status = 'deleted', deleted_at = now() where id = p.id;
    -- Photos go, unless a report is open on them (kept as evidence for the owner).
    update public.forum_media m set status = 'deleted', full_data = null, thumb_data = null
    where m.post_id = p.id and not exists (
      select 1 from public.forum_reports x where x.status = 'open'
        and ((x.target_kind = 'media' and x.target_id = m.id) or (x.target_kind = 'post' and x.target_id = p.id)));
    perform public.forum_reverse_target(p.id, 'post deleted');
  else
    select * into r from public.forum_replies where id = p_id and author = uid for update;
    if not found or r.status = 'deleted' then
      raise exception 'Community: not found' using errcode = 'P0002';
    end if;
    insert into public.forum_edits (target_kind, target_id, body, anonymous, action)
    values ('reply', r.id, r.body, r.anonymous, 'delete');
    update public.forum_replies set status = 'deleted', deleted_at = now() where id = r.id;
    update public.forum_posts
    set reply_count = greatest(reply_count - 1, 0),
        best_reply = case when best_reply = r.id then null else best_reply end
    where id = r.post_id;
    perform public.forum_reverse_target(r.id, 'reply deleted');
  end if;
end;
$$;
revoke all on function public.forum_delete(text, uuid) from public, anon;
grant execute on function public.forum_delete(text, uuid) to authenticated;

-- Helpful (replies, journeys) and Support (posts). One of each per member per item; never on
-- your own. Helpful may earn the author karma; Support never does.
create or replace function public.forum_react(p_kind text, p_id uuid, p_reaction text, p_on boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.forum_require_writer();
  author uuid;
  anon boolean;
  post_kind text;
  post_id uuid;
  visible boolean;
  award bigint;
  inserted integer;
  total integer;
begin
  if p_kind = 'post' then
    select p.author, p.anonymous, p.kind, p.id, p.status = 'visible' into author, anon, post_kind, post_id, visible
    from public.forum_posts p where p.id = p_id;
    if p_reaction = 'helpful' and post_kind <> 'journey' then
      raise exception 'Community: reaction' using errcode = 'P0001';
    end if;
  elsif p_kind = 'reply' then
    select r.author, r.anonymous, 'reply', r.post_id, r.status = 'visible' into author, anon, post_kind, post_id, visible
    from public.forum_replies r where r.id = p_id;
    if p_reaction <> 'helpful' then raise exception 'Community: reaction' using errcode = 'P0001'; end if;
  end if;
  if author is null or not visible or not public.forum_can_see(uid, author, anon) then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  if author = uid then raise exception 'Community: own' using errcode = 'P0001'; end if;

  if p_on then
    insert into public.forum_reactions (user_id, target_kind, target_id, reaction)
    values (uid, p_kind, p_id, p_reaction) on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted = 1 and p_reaction = 'helpful' and public.forum_vote_counts(uid, author)
       and not exists (
         select 1 from public.forum_karma k
         where k.source in ('helpful_reply', 'helpful_post') and k.target_id = p_id and k.voter = uid
           and not exists (select 1 from public.forum_karma z where z.reverses = k.id)) then
      insert into public.forum_karma (user_id, delta, source, target_id, voter)
      values (author, case when p_kind = 'reply' then 5 else 3 end,
              case when p_kind = 'reply' then 'helpful_reply' else 'helpful_post' end, p_id, uid);
      select coalesce(sum(k.delta), 0) into total from public.forum_karma k where k.user_id = author;
      if total >= 50 and total - (case when p_kind = 'reply' then 5 else 3 end) < 50 then
        perform public.forum_notify(author, 'karma_milestone', null, null, '', '50 karma', 'karma:50');
      elsif total >= 300 and total - (case when p_kind = 'reply' then 5 else 3 end) < 300 then
        perform public.forum_notify(author, 'karma_milestone', null, null, '', '300 karma', 'karma:300');
      end if;
    end if;
  else
    delete from public.forum_reactions
    where user_id = uid and target_kind = p_kind and target_id = p_id and reaction = p_reaction;
    get diagnostics inserted = row_count;
    if inserted = 1 and p_reaction = 'helpful' then
      select k.id into award from public.forum_karma k
      where k.source in ('helpful_reply', 'helpful_post') and k.target_id = p_id and k.voter = uid
        and not exists (select 1 from public.forum_karma z where z.reverses = k.id)
      order by k.id desc limit 1;
      if award is not null then perform public.forum_reverse(award, 'vote removed'); end if;
    end if;
  end if;

  if inserted = 1 then
    if p_kind = 'post' then
      update public.forum_posts set
        helpful_count = helpful_count + case when p_reaction = 'helpful' then (case when p_on then 1 else -1 end) else 0 end,
        support_count = support_count + case when p_reaction = 'support' then (case when p_on then 1 else -1 end) else 0 end
      where id = p_id;
    else
      update public.forum_replies set helpful_count = helpful_count + case when p_on then 1 else -1 end
      where id = p_id;
    end if;
  end if;
  return jsonb_build_object(
    'helpful', case when p_kind = 'post' then (select helpful_count from public.forum_posts where id = p_id)
                    else (select helpful_count from public.forum_replies where id = p_id) end,
    'support', case when p_kind = 'post' then (select support_count from public.forum_posts where id = p_id) else 0 end);
end;
$$;
revoke all on function public.forum_react(text, uuid, text, boolean) from public, anon;
grant execute on function public.forum_react(text, uuid, text, boolean) to authenticated;

-- Best Answer: only the question's author, never their own reply. Changing it moves the karma.
create or replace function public.forum_best_answer(p_post uuid, p_reply uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.forum_require_writer();
  p public.forum_posts;
  r public.forum_replies;
  award bigint;
begin
  select * into p from public.forum_posts where id = p_post and author = uid for update;
  if not found or p.kind <> 'question' or p.status <> 'visible' then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  if p_reply is not null then
    select * into r from public.forum_replies where id = p_reply and post_id = p_post and status = 'visible';
    if not found then raise exception 'Community: not found' using errcode = 'P0002'; end if;
    if r.author = uid then raise exception 'Community: own' using errcode = 'P0001'; end if;
  end if;
  if p.best_reply is not distinct from p_reply then return; end if;
  -- Take back the karma of the earlier choice.
  if p.best_reply is not null then
    select k.id into award from public.forum_karma k
    where k.source = 'best_answer' and k.target_id = p.best_reply
      and not exists (select 1 from public.forum_karma z where z.reverses = k.id)
    order by k.id desc limit 1;
    if award is not null then perform public.forum_reverse(award, 'best answer changed'); end if;
  end if;
  update public.forum_posts set best_reply = p_reply, last_activity_at = now() where id = p_post;
  if p_reply is not null then
    if public.forum_vote_counts(uid, r.author) or (
      -- Best Answer is not capped by the daily Helpful limit, only by voter eligibility.
      uid <> r.author and not public.forum_banned(uid) and exists (
        select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null
          and u.created_at <= now() - make_interval(days => (select voter_account_days from public.forum_reward_rules where id))))
    then
      insert into public.forum_karma (user_id, delta, source, target_id, voter)
      values (r.author, 20, 'best_answer', r.id, uid);
    end if;
    perform public.forum_notify(r.author, 'best_answer', p_post, r.id, '', p.title,
                                'best:' || r.id || ':' || extract(epoch from now())::bigint);
  end if;
end;
$$;
revoke all on function public.forum_best_answer(uuid, uuid) from public, anon;
grant execute on function public.forum_best_answer(uuid, uuid) to authenticated;

-- Save, follow and hide work even when banned (they only change what you see).
create or replace function public.forum_set(p_post uuid, p_what text, p_on boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not exists (select 1 from public.forum_posts p where p.id = p_post and public.forum_post_visible(p, uid))
     and p_on then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  if p_what = 'save' then
    if p_on then insert into public.forum_saves (user_id, post_id) values (uid, p_post) on conflict do nothing;
    else delete from public.forum_saves where user_id = uid and post_id = p_post; end if;
  elsif p_what = 'follow' then
    if p_on then insert into public.forum_follows (user_id, post_id) values (uid, p_post) on conflict do nothing;
    else delete from public.forum_follows where user_id = uid and post_id = p_post; end if;
  elsif p_what = 'hide' then
    if p_on then insert into public.forum_hidden (user_id, post_id) values (uid, p_post) on conflict do nothing;
    else delete from public.forum_hidden where user_id = uid and post_id = p_post; end if;
  else
    raise exception 'Community: what' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.forum_set(uuid, text, boolean) from public, anon;
grant execute on function public.forum_set(uuid, text, boolean) to authenticated;

-- Block from a post, a reply or a username. The server finds the account; nothing about it is
-- returned. From anonymous content the block covers that person's anonymous content only.
create or replace function public.forum_block(p_kind text, p_id uuid, p_username text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  who uuid;
  anon boolean := false;
  post uuid;
  v_title text;
  v_label text;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_kind = 'post' then
    select p.author, p.anonymous, p.id, p.title into who, anon, post, v_title
    from public.forum_posts p where p.id = p_id and p.status in ('visible', 'held', 'hidden');
  elsif p_kind = 'reply' then
    select r.author, r.anonymous, p.id, p.title into who, anon, post, v_title
    from public.forum_replies r join public.forum_posts p on p.id = r.post_id where r.id = p_id;
  elsif p_kind = 'member' then
    select u.user_id into who from public.usernames u where u.username = lower(btrim(coalesce(p_username, '')));
  end if;
  if who is null then raise exception 'Community: not found' using errcode = 'P0002'; end if;
  if who = uid then raise exception 'Community: own' using errcode = 'P0001'; end if;
  v_label := case when anon then public.forum_anon_label(post, who) || ' in "' || left(v_title, 60) || '"'
                else '@' || coalesce(public.forum_username(who), 'member') end;
  insert into public.forum_blocks (blocker, blocked, anonymous_only, label)
  values (uid, who, anon, v_label)
  on conflict (blocker, blocked, anonymous_only) do nothing;
  -- Blocking someone also stops following their threads' notifications from them (done by
  -- forum_can_see at notify time).
end;
$$;
revoke all on function public.forum_block(text, uuid, text) from public, anon;
grant execute on function public.forum_block(text, uuid, text) to authenticated;

create or replace function public.forum_blocks_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'label', b.label, 'created_at', b.created_at)
                            order by b.created_at desc), '[]'::jsonb)
  from public.forum_blocks b where b.blocker = auth.uid();
$$;
revoke all on function public.forum_blocks_list() from public, anon;
grant execute on function public.forum_blocks_list() to authenticated;

create or replace function public.forum_unblock(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.forum_blocks where id = p_id and blocker = auth.uid();
$$;
revoke all on function public.forum_unblock(uuid) from public, anon;
grant execute on function public.forum_unblock(uuid) to authenticated;

-- Reports. Urgent reasons go to the top of the owner's queue. An explicit-photo report from an
-- established member holds the photo at once; three people reporting the same item hold it.
-- Holding is never a ban: the owner restores or removes.
create or replace function public.forum_report(p_kind text, p_id uuid, p_username text, p_reason text, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target uuid := p_id;
  established boolean;
  reporters integer;
  v_report bigint;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if (select count(*) from public.forum_reports r
      where r.reporter = uid and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many reports today' using errcode = 'P0001';
  end if;
  if p_kind = 'member' then
    select u.user_id into target from public.usernames u where u.username = lower(btrim(coalesce(p_username, '')));
  end if;
  if target is null
     or (p_kind = 'post' and not exists (select 1 from public.forum_posts where id = target))
     or (p_kind = 'reply' and not exists (select 1 from public.forum_replies where id = target))
     or (p_kind = 'media' and not exists (select 1 from public.forum_media where id = target)) then
    raise exception 'Community: not found' using errcode = 'P0002';
  end if;
  insert into public.forum_reports (reporter, target_kind, target_id, reason, note, priority)
  values (uid, p_kind, target, p_reason, left(btrim(coalesce(p_note, '')), 500),
          case when p_reason in ('explicit', 'self_harm', 'privacy', 'harassment') then 'urgent' else 'normal' end)
  on conflict (reporter, target_kind, target_id) do nothing
  returning id into v_report;
  if v_report is null then return; end if;

  established := exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null
                         and u.created_at <= now() - interval '7 days') and not public.forum_banned(uid);
  select count(distinct r.reporter) into reporters from public.forum_reports r
  where r.target_kind = p_kind and r.target_id = target and r.status = 'open';

  if p_kind = 'media' and ((p_reason = 'explicit' and established) or reporters >= 3) then
    update public.forum_media set status = 'held' where id = target and status = 'visible';
    if found then
      insert into public.forum_mod_log (action, target_kind, target_id, reason, report_id, actor)
      values ('auto_hold', 'media', target, p_reason, v_report, 'automatic');
    end if;
  elsif p_kind = 'post' and (reporters >= 3 or (p_reason = 'explicit' and established)) then
    update public.forum_posts set status = 'held' where id = target and status = 'visible';
    if found then
      insert into public.forum_mod_log (action, target_kind, target_id, reason, report_id, actor)
      values ('auto_hold', 'post', target, p_reason, v_report, 'automatic');
    end if;
  elsif p_kind = 'reply' and reporters >= 3 then
    update public.forum_replies set status = 'held' where id = target and status = 'visible';
    if found then
      insert into public.forum_mod_log (action, target_kind, target_id, reason, report_id, actor)
      values ('auto_hold', 'reply', target, p_reason, v_report, 'automatic');
    end if;
  end if;
end;
$$;
revoke all on function public.forum_report(text, uuid, text, text, text) from public, anon;
grant execute on function public.forum_report(text, uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Karma and the 30-day Pro reward
-- ---------------------------------------------------------------------------------------------

create or replace function public.forum_progress(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rules public.forum_reward_rules;
  since timestamptz;
  lifetime integer;
  qualifying integer;
  best integer;
  voters integer;
  replies integer;
  threads integer;
  days integer;
  age_days integer;
  confirmed boolean;
  last_claim public.forum_reward_claims;
  clean boolean;
  m public.forum_members;
begin
  select * into rules from public.forum_reward_rules where id;
  select * into m from public.forum_members where user_id = p_user;
  since := now() - make_interval(days => rules.window_days);
  select coalesce(sum(k.delta), 0) into lifetime from public.forum_karma k where k.user_id = p_user;
  -- Qualifying: awards in the window that still stand.
  select coalesce(sum(k.delta), 0) into qualifying from public.forum_karma k
  where k.user_id = p_user and k.created_at > since and k.source <> 'reversal'
    and not exists (select 1 from public.forum_karma z where z.reverses = k.id);
  select count(distinct k.voter) into best from public.forum_karma k
  where k.user_id = p_user and k.source = 'best_answer' and k.created_at > since
    and not exists (select 1 from public.forum_karma z where z.reverses = k.id);
  select count(distinct k.voter) into voters from public.forum_karma k
  where k.user_id = p_user and k.source in ('helpful_reply', 'helpful_post') and k.created_at > since
    and not exists (select 1 from public.forum_karma z where z.reverses = k.id);
  select count(*), count(distinct r.post_id), count(distinct (r.created_at at time zone 'Asia/Kolkata')::date)
  into replies, threads, days
  from public.forum_replies r join public.forum_posts p on p.id = r.post_id
  where r.author = p_user and r.status = 'visible' and r.created_at > since
    and char_length(r.body) >= 60 and p.author <> p_user;
  select (extract(epoch from now() - u.created_at) / 86400)::integer, u.email_confirmed_at is not null
  into age_days, confirmed from auth.users u where u.id = p_user;
  select * into last_claim from public.forum_reward_claims c
  where c.user_id = p_user and c.status <> 'revoked' order by c.claimed_at desc limit 1;
  clean := m.banned_at is null and (m.muted_until is null or m.muted_until < now())
    and not exists (select 1 from public.forum_mod_log l where l.user_id = p_user
                    and l.action in ('ban', 'mute', 'karma_fraud') and l.at > now() - interval '90 days');
  return jsonb_build_object(
    'lifetime', lifetime,
    'qualifying', qualifying,
    'rules', to_jsonb(rules) - 'id' - 'updated_at',
    'best_answers', best,
    'helpful_voters', voters,
    'replies', replies,
    'reply_threads', threads,
    'active_days', days,
    'account_days', coalesce(age_days, 0),
    'confirmed', coalesce(confirmed, false),
    'rules_accepted', m.rules_accepted_at is not null,
    'in_good_standing', clean,
    'last_claim', case when last_claim.id is null then null else jsonb_build_object(
      'status', last_claim.status, 'claimed_at', last_claim.claimed_at,
      'pro_until', last_claim.pro_until, 'days', last_claim.days) end,
    'next_claim_at', case when last_claim.id is null then null else last_claim.claimed_at + interval '365 days' end,
    'eligible', public.forum_flag('community_rewards')
      and qualifying >= rules.karma and best >= rules.best_answers and voters >= rules.helpful_voters
      and replies >= rules.replies and threads >= rules.reply_threads and days >= rules.active_days
      and coalesce(age_days, 0) >= rules.account_days and coalesce(confirmed, false)
      and m.rules_accepted_at is not null and clean
      and (last_claim.id is null or last_claim.claimed_at < now() - interval '365 days'),
    'rewards_on', public.forum_flag('community_rewards')
  );
end;
$$;
revoke all on function public.forum_progress(uuid) from public, anon, authenticated;

-- Whether the account has autopay that would renew (Pro from the reward then waits for it).
create or replace function public.forum_has_autopay(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user and s.billing_kind = 'subscription'
      and s.razorpay_status in ('authenticated', 'active', 'pending', 'halted')
      and not s.cancel_at_period_end);
$$;
revoke all on function public.forum_has_autopay(uuid) from public, anon, authenticated;

-- Adds the reward's days after any Pro or trial time already running. Never touches billing.
create or replace function public.forum_apply_reward(p_claim uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.forum_reward_claims;
  until timestamptz;
begin
  select * into c from public.forum_reward_claims where id = p_claim for update;
  if c.status <> 'held' and c.applied_at is not null then return c.pro_until; end if;
  update public.subscriptions s
  set status = 'active',
      pro_started_at = case when s.pro_expires_at > now() then s.pro_started_at else now() end,
      pro_expires_at = greatest(coalesce(s.pro_expires_at, now()), coalesce(s.trial_expires_at, now()), now())
                       + make_interval(days => c.days),
      admin_note = concat_ws(e'\n', s.admin_note,
        to_char(now(), 'YYYY-MM-DD') || ': ' || c.days || ' days of Pro from the Community reward ' || c.id)
  where s.user_id = c.user_id
  returning s.pro_expires_at into until;
  if until is null then
    raise exception 'Community: no subscription row' using errcode = 'P0002';
  end if;
  update public.forum_reward_claims set status = 'applied', applied_at = now(), pro_until = until
  where id = c.id;
  return until;
end;
$$;
revoke all on function public.forum_apply_reward(uuid) from public, anon, authenticated;

-- Your karma and how close you are to the reward. Applies a held reward once autopay has ended.
create or replace function public.forum_my_karma()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  held uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select c.id into held from public.forum_reward_claims c where c.user_id = uid and c.status = 'held'
  order by c.claimed_at limit 1;
  if held is not null and not public.forum_has_autopay(uid) then
    perform public.forum_apply_reward(held);
  end if;
  return public.forum_progress(uid) || jsonb_build_object(
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('delta', k.delta, 'source', k.source, 'created_at', k.created_at)
                       order by k.id desc)
      from (select * from public.forum_karma x where x.user_id = uid order by x.id desc limit 30) k), '[]'::jsonb));
end;
$$;
revoke all on function public.forum_my_karma() from public, anon;
grant execute on function public.forum_my_karma() to authenticated;

-- Claim the reward. One per account per 365 days, checked under a per-account lock, so two
-- phones tapping at once still give 30 days once.
create or replace function public.forum_claim_reward(p_client uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.forum_reward_claims;
  progress jsonb;
  claim uuid;
  until timestamptz;
  autopay boolean;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('forum_reward:' || uid::text));
  select * into existing from public.forum_reward_claims where user_id = uid and client_id = p_client;
  if existing.id is not null then
    return jsonb_build_object('status', existing.status, 'pro_until', existing.pro_until, 'days', existing.days);
  end if;
  progress := public.forum_progress(uid);
  if not (progress ->> 'eligible')::boolean then
    raise exception 'Community: not eligible' using errcode = 'P0001';
  end if;
  autopay := public.forum_has_autopay(uid);
  insert into public.forum_reward_claims (user_id, client_id, status, days, snapshot)
  values (uid, p_client, 'held', (progress -> 'rules' ->> 'reward_days')::integer, progress)
  returning id into claim;
  if not autopay then until := public.forum_apply_reward(claim); end if;
  insert into public.forum_mod_log (action, target_kind, user_id, reason, actor)
  values ('reward_claimed', 'member', uid, case when autopay then 'held until autopay ends' else 'applied' end, 'member');
  perform public.forum_notify(uid, 'reward', null, null, '', case when autopay then 'held' else 'applied' end,
                              'reward:' || claim);
  return jsonb_build_object('status', case when autopay then 'held' else 'applied' end,
                            'pro_until', until, 'days', (progress -> 'rules' ->> 'reward_days')::integer);
end;
$$;
revoke all on function public.forum_claim_reward(uuid) from public, anon;
grant execute on function public.forum_claim_reward(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. The owner's SQL tools. SQL editor only: no member, visitor or service role may run them.
-- ---------------------------------------------------------------------------------------------

create or replace view public.community_owner_pending_reports
with (security_invoker = true) as
  select
    r.id as report_id,
    r.priority,
    r.reason,
    r.target_kind,
    r.target_id,
    r.note,
    r.created_at,
    (select count(*) from public.forum_reports x
     where x.target_kind = r.target_kind and x.target_id = r.target_id and x.status = 'open') as reports_on_item,
    case r.target_kind
      when 'post' then (select p.status from public.forum_posts p where p.id = r.target_id)
      when 'reply' then (select x.status from public.forum_replies x where x.id = r.target_id)
      when 'media' then (select m.status from public.forum_media m where m.id = r.target_id)
      else null end as item_status,
    case r.target_kind
      when 'post' then (select left(p.title || ' | ' || p.body, 300) from public.forum_posts p where p.id = r.target_id)
      when 'reply' then (select left(x.body, 300) from public.forum_replies x where x.id = r.target_id)
      when 'media' then 'Photo in post ' || (select m.post_id::text from public.forum_media m where m.id = r.target_id)
      else '@' || coalesce((select u.username from public.usernames u where u.user_id = r.target_id), '?') end as content
  from public.forum_reports r
  where r.status = 'open'
  order by (r.priority = 'urgent') desc, r.created_at;
revoke all on public.community_owner_pending_reports from public, anon, authenticated, service_role;

create or replace function public.community_owner_author_of(p_kind text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'post' then (select p.author from public.forum_posts p where p.id = p_id)
    when 'reply' then (select r.author from public.forum_replies r where r.id = p_id)
    when 'media' then (select m.owner from public.forum_media m where m.id = p_id)
    when 'member' then p_id
  end;
$$;

-- Who wrote this post, reply or photo, anonymous or not.
create or replace function public.community_owner_find_author(p_kind text, p_id uuid)
returns table (user_id uuid, email text, username text, anonymous boolean, banned boolean, verified boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare who uuid := public.community_owner_author_of(p_kind, p_id);
begin
  if who is null then raise exception 'Nothing found for % %', p_kind, p_id; end if;
  insert into public.forum_mod_log (action, target_kind, target_id, user_id, reason)
  values ('identity_lookup', p_kind, p_id, who, '');
  return query
    select u.id, u.email::text, public.forum_username(u.id),
      case p_kind
        when 'post' then (select p.anonymous from public.forum_posts p where p.id = p_id)
        when 'reply' then (select r.anonymous from public.forum_replies r where r.id = p_id)
        else null end,
      public.forum_banned(u.id), public.forum_is_verified(u.id)
    from auth.users u where u.id = who;
end;
$$;

create or replace function public.community_owner_ban_by_user(p_user uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'No account %', p_user;
  end if;
  insert into public.forum_members (user_id, banned_at, ban_reason) values (p_user, now(), p_reason)
  on conflict (user_id) do update set banned_at = coalesce(public.forum_members.banned_at, now()),
    ban_reason = p_reason, updated_at = now();
  -- Karma from now on stops (forum_vote_counts); the reward can no longer be claimed.
  insert into public.forum_mod_log (action, target_kind, user_id, reason) values ('ban', 'member', p_user, p_reason);
  return 'Banned from Community: ' || coalesce(public.forum_username(p_user), p_user::text);
end;
$$;

create or replace function public.community_owner_ban_by_content(p_kind text, p_id uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare who uuid := public.community_owner_author_of(p_kind, p_id);
begin
  if who is null then raise exception 'Nothing found for % %', p_kind, p_id; end if;
  perform public.community_owner_hide_content(p_kind, p_id, p_reason);
  return public.community_owner_ban_by_user(who, p_reason);
end;
$$;

create or replace function public.community_owner_mute_by_content(p_kind text, p_id uuid, p_until timestamptz, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare who uuid := public.community_owner_author_of(p_kind, p_id);
begin
  if who is null then raise exception 'Nothing found for % %', p_kind, p_id; end if;
  insert into public.forum_members (user_id, muted_until, mute_reason) values (who, p_until, p_reason)
  on conflict (user_id) do update set muted_until = p_until, mute_reason = p_reason, updated_at = now();
  insert into public.forum_mod_log (action, target_kind, target_id, user_id, reason)
  values ('mute', p_kind, p_id, who, p_reason || ' (until ' || p_until || ')');
  return 'Muted until ' || p_until;
end;
$$;

create or replace function public.community_owner_unban(p_user uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.forum_members set banned_at = null, ban_reason = null, muted_until = null, mute_reason = null,
    updated_at = now()
  where user_id = p_user;
  insert into public.forum_mod_log (action, target_kind, user_id, reason) values ('unban', 'member', p_user, p_reason);
  return 'Can take part again: ' || coalesce(public.forum_username(p_user), p_user::text);
end;
$$;

create or replace function public.community_owner_hide_content(p_kind text, p_id uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare who uuid := public.community_owner_author_of(p_kind, p_id);
begin
  if who is null then raise exception 'Nothing found for % %', p_kind, p_id; end if;
  if p_kind = 'post' then
    update public.forum_posts set status = 'hidden' where id = p_id and status <> 'deleted';
    update public.forum_media set status = 'hidden' where post_id = p_id and status <> 'deleted';
  elsif p_kind = 'reply' then
    update public.forum_replies set status = 'hidden' where id = p_id and status <> 'deleted';
    update public.forum_posts p set reply_count = greatest(p.reply_count - 1, 0),
      best_reply = case when p.best_reply = p_id then null else p.best_reply end
    where p.id = (select r.post_id from public.forum_replies r where r.id = p_id);
  elsif p_kind = 'media' then
    update public.forum_media set status = 'hidden' where id = p_id;
  end if;
  if p_kind in ('post', 'reply') then perform public.forum_reverse_target(p_id, 'removed: ' || p_reason); end if;
  insert into public.forum_mod_log (action, target_kind, target_id, user_id, reason)
  values ('hide', p_kind, p_id, who, p_reason);
  perform public.forum_notify(who, 'moderation', case when p_kind = 'post' then p_id end, null, '',
    'Something you posted was removed for breaking the Community rules: ' || p_reason,
    'mod:' || p_kind || ':' || p_id);
  update public.forum_reports set status = 'actioned', resolved_at = now(), resolution = 'hidden: ' || p_reason
  where target_kind = p_kind and target_id = p_id and status = 'open';
  return 'Hidden';
end;
$$;

create or replace function public.community_owner_restore_content(p_kind text, p_id uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare who uuid := public.community_owner_author_of(p_kind, p_id);
begin
  if who is null then raise exception 'Nothing found for % %', p_kind, p_id; end if;
  if p_kind = 'post' then
    update public.forum_posts set status = 'visible' where id = p_id and status in ('held', 'hidden');
    update public.forum_media set status = 'visible' where post_id = p_id and status in ('held', 'hidden');
  elsif p_kind = 'reply' then
    update public.forum_replies set status = 'visible' where id = p_id and status in ('held', 'hidden');
    update public.forum_posts p set reply_count = (
      select count(*) from public.forum_replies r where r.post_id = p.id and r.status = 'visible')
    where p.id = (select r.post_id from public.forum_replies r where r.id = p_id);
  elsif p_kind = 'media' then
    update public.forum_media set status = 'visible' where id = p_id and status in ('held', 'hidden');
  end if;
  insert into public.forum_mod_log (action, target_kind, target_id, user_id, reason)
  values ('restore', p_kind, p_id, who, p_reason);
  update public.forum_reports set status = 'dismissed', resolved_at = now(), resolution = 'restored: ' || p_reason
  where target_kind = p_kind and target_id = p_id and status = 'open';
  return 'Restored';
end;
$$;

create or replace function public.community_owner_resolve_report(p_report bigint, p_disposition text, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare r public.forum_reports;
begin
  if p_disposition not in ('actioned', 'dismissed') then
    raise exception 'Disposition is actioned or dismissed';
  end if;
  update public.forum_reports set status = p_disposition, resolved_at = now(), resolution = p_reason
  where id = p_report returning * into r;
  if r.id is null then raise exception 'No report %', p_report; end if;
  insert into public.forum_mod_log (action, target_kind, target_id, reason, report_id)
  values ('report_' || p_disposition, r.target_kind, r.target_id, p_reason, r.id);
  return 'Report ' || p_report || ' ' || p_disposition;
end;
$$;

create or replace function public.community_owner_adjust_karma(p_user uuid, p_delta integer, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  insert into public.forum_karma (user_id, delta, source, reason) values (p_user, p_delta, 'owner', p_reason);
  insert into public.forum_mod_log (action, target_kind, user_id, reason)
  values (case when p_delta < 0 then 'karma_fraud' else 'karma_adjust' end, 'member', p_user,
          p_delta || ': ' || p_reason);
  return 'Karma now ' || (select coalesce(sum(delta), 0) from public.forum_karma where user_id = p_user);
end;
$$;

create or replace function public.community_owner_member_status(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email', (select email from auth.users where id = p_user),
    'username', public.forum_username(p_user),
    'member', (select to_jsonb(m) from public.forum_members m where m.user_id = p_user),
    'progress', public.forum_progress(p_user),
    'claims', (select coalesce(jsonb_agg(to_jsonb(c) - 'snapshot' order by c.claimed_at desc), '[]'::jsonb)
               from public.forum_reward_claims c where c.user_id = p_user),
    'recent_actions', (select coalesce(jsonb_agg(to_jsonb(l) order by l.at desc), '[]'::jsonb)
                       from (select * from public.forum_mod_log x where x.user_id = p_user order by x.at desc limit 20) l),
    'open_reports_about', (select count(*) from public.forum_reports r where r.status = 'open'
      and public.community_owner_author_of(r.target_kind, r.target_id) = p_user)
  );
$$;

-- Macrotrophy Verified, by the email the person signed up with.
create or replace function public.community_owner_verify(p_email text, p_note text default 'Macrotrophy Verified creator')
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  who uuid;
  n integer;
begin
  select count(*), min(u.id::text)::uuid into n, who from auth.users u
  where lower(u.email) = lower(btrim(coalesce(p_email, '')));
  if n = 0 then raise exception 'No account uses the email %', p_email; end if;
  if n > 1 then raise exception 'More than one account uses the email %', p_email; end if;
  insert into public.forum_members (user_id, verified_at, verified_note) values (who, now(), p_note)
  on conflict (user_id) do update set verified_at = coalesce(public.forum_members.verified_at, now()),
    verified_note = p_note, updated_at = now();
  insert into public.forum_mod_log (action, target_kind, user_id, reason) values ('verify', 'member', who, p_note);
  return 'Verified: ' || coalesce('@' || public.forum_username(who), p_email || ' (no username yet: the badge shows once they choose one)');
end;
$$;

create or replace function public.community_owner_unverify(p_email text, p_reason text default 'Verification removed')
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  who uuid;
  n integer;
begin
  select count(*), min(u.id::text)::uuid into n, who from auth.users u
  where lower(u.email) = lower(btrim(coalesce(p_email, '')));
  if n = 0 then raise exception 'No account uses the email %', p_email; end if;
  if n > 1 then raise exception 'More than one account uses the email %', p_email; end if;
  update public.forum_members set verified_at = null, verified_note = null, updated_at = now() where user_id = who;
  insert into public.forum_mod_log (action, target_kind, user_id, reason) values ('unverify', 'member', who, p_reason);
  return 'No longer verified: ' || coalesce('@' || public.forum_username(who), p_email);
end;
$$;

create or replace view public.community_owner_verified
with (security_invoker = true) as
  select u.email, public.forum_username(m.user_id) as username, m.verified_at, m.verified_note, m.user_id
  from public.forum_members m join auth.users u on u.id = m.user_id
  where m.verified_at is not null
  order by m.verified_at desc;
revoke all on public.community_owner_verified from public, anon, authenticated, service_role;

-- Pause posting, photos, rewards or all of Community in one line.
create or replace function public.community_owner_switch(p_name text, p_on boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_name not in ('community', 'community_posting', 'community_photos', 'community_rewards') then
    raise exception 'Unknown switch %', p_name;
  end if;
  update public.app_settings set flags = coalesce(flags, '{}'::jsonb) || jsonb_build_object(p_name, p_on) where id;
  insert into public.forum_mod_log (action, reason) values ('switch', p_name || ' = ' || p_on);
  return (select flags from public.app_settings where id);
end;
$$;

do $$
declare f text;
begin
  for f in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'community_owner_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end;
$$;
