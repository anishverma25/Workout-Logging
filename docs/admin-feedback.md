# Feedback: reading and replying

People send feedback from **More > Send feedback**, from the Pro page, from the error screen,
and once from the summary of their third workout. Each entry has a rating (1 to 5 stars,
optional), tags (Love it, Idea, Confusing, Something broke), a message, the screen it came from
and the app build.

The quickest way to read it: Supabase, **Table Editor > feedback**, sorted by `created_at`
(newest first). For more, open **SQL Editor > New query**, paste one of these and click **Run**.
Save them with **Save** so they are one click next time.

## Overview

Average rating, how many people answered, and how often each tag was picked.

```sql
select
  count(*) as entries,
  count(distinct user_id) as people,
  round(avg(rating), 2) as average_rating,
  count(*) filter (where 'love' = any(tags)) as love_it,
  count(*) filter (where 'idea' = any(tags)) as ideas,
  count(*) filter (where 'confusing' = any(tags)) as confusing,
  count(*) filter (where 'bug' = any(tags)) as something_broke,
  count(*) filter (where seen_at is null) as unread
from public.feedback;
```

## Latest feedback, with who sent it

```sql
select
  f.created_at,
  u.email,
  f.rating,
  f.tags,
  f.message,
  f.screen,
  f.app_version,
  f.seen_at is not null as read,
  f.reply,
  f.id
from public.feedback f
join auth.users u on u.id = f.user_id
order by f.created_at desc
limit 100;
```

## Mark everything as read

The person sees "Read by the team" on their feedback.

```sql
update public.feedback set seen_at = now() where seen_at is null;
```

## Reply to one piece of feedback

Copy the `id` from the query above. The reply appears under their message in the app, marked
"Reply from Overload".

```sql
update public.feedback
set reply = 'Thanks! Plate calculator is coming in the next update.',
    replied_at = now(),
    seen_at = coalesce(seen_at, now())
where id = 'paste-the-id-here';
```

Keep replies short and kind; the person reads them in the app. Nobody can send a reply but you:
users cannot change feedback, theirs or anyone else's.

## Reports of people and groups (migration 0030)

People report a person or a group from the leaderboard or a group's menu. Read new ones:

```sql
select r.id, r.created_at, r.kind, r.target, r.reason, r.note
from public.content_reports r
where r.seen_at is null
order by r.created_at desc;
```

`target` is `@username` for a person (or their shown name, place and week when they have no
username), and the group id for a group. Find who a username belongs to:

```sql
select user_id from public.usernames where username = 'their.username';
```

Take someone off the public leaderboard (they still see their own place):

```sql
insert into public.leaderboard_hidden (user_id, reason) values ('paste-user-id', 'report');
```

Mark reports as handled:

```sql
update public.content_reports set seen_at = now() where seen_at is null;
```

Words nobody may use in usernames or group names are in `public.community_blocked`. To add a word,
run `create or replace function public.community_blocked` with the longer list from migration 0030.
