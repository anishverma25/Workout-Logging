# Community: the owner's SQL

Everything here runs in the Supabase SQL editor (Dashboard, SQL Editor, New query). These
functions refuse every app user, visitor and the service role: only the SQL editor can run them.
Every action is written to `forum_mod_log`, which nothing ever edits or deletes.

Replace only the text in quotes.

## Macrotrophy Verified

Grant the badge to the account that signed up with this email:

```sql
select public.community_owner_verify('creator@example.com');
```

Remove it:

```sql
select public.community_owner_unverify('creator@example.com');
```

The answer says who it was, for example `Verified: @rish.kadam`. Capital letters and spaces
around the email do not matter. If nobody uses that email it says so and changes nothing.

- The badge shows next to their username on posts, replies and their profile, and a lime ring
  on their photo. It never shows on anything they post anonymously.
- It changes nothing else: karma, Pro, payments and their data stay exactly as they were.
- It means "officially recognised by Macrotrophy". Tapping it tells members it is not a
  certificate of expertise.
- If they have no username yet, the badge appears as soon as they choose one.
- Optional: a private note for yourself, `select public.community_owner_verify('x@example.com', 'Creator, code RISHI10');`

Everyone verified:

```sql
select * from public.community_owner_verified;
```

## The report queue

```sql
select * from public.community_owner_pending_reports;
```

Urgent reports (harassment, explicit photos, someone at risk, private information) come first.
`content` shows the text, `item_status` shows whether it is already held. Copy `target_kind` and
`target_id` for the actions below.

Held automatically (never a ban): a photo reported as explicit by a member whose account is a week
old, and any post, reply or photo reported by 3 different members. Held items are hidden from
everyone except their author until you restore or remove them.

## Who wrote it (also anonymous content)

```sql
select * from public.community_owner_find_author('reply', 'PASTE-THE-ID');
```

Use `'post'`, `'reply'` or `'media'`. It shows the email, username, whether it was anonymous,
banned and verified. Each lookup is logged.

## Remove, restore

```sql
select public.community_owner_hide_content('reply', 'PASTE-THE-ID', 'Harassment');
select public.community_owner_restore_content('reply', 'PASTE-THE-ID', 'Report was wrong');
```

Removing takes back any karma it earned, tells the author it was removed and closes its reports.

## Ban, mute, unban

Ban the account behind a post or reply, anonymous or not (also removes that item):

```sql
select public.community_owner_ban_by_content('reply', 'PASTE-THE-ID', 'Harassment of other members');
```

When you already know the account id (from `find_author`):

```sql
select public.community_owner_ban_by_user('PASTE-THE-USER-ID', 'Spam');
```

Mute until a date instead:

```sql
select public.community_owner_mute_by_content('reply', 'PASTE-THE-ID', now() + interval '7 days', 'Repeated rudeness');
```

Undo after an appeal:

```sql
select public.community_owner_unban('PASTE-THE-USER-ID', 'Appeal accepted');
```

A banned account can still read, delete its own posts and use the rest of Macrotrophy (workouts,
food, Pro). It cannot post, reply, react, earn karma or claim the reward, with or without
anonymity, from any phone.

## Close a report without action

```sql
select public.community_owner_resolve_report(123, 'dismissed', 'Not against the rules');
```

## Karma and rewards

One account's standing, karma progress, rewards and recent actions:

```sql
select public.community_owner_member_status('PASTE-THE-USER-ID');
```

Take back karma from proven vote trading (a reason is required):

```sql
select public.community_owner_adjust_karma('PASTE-THE-USER-ID', -50, 'Vote trading with a second account');
```

Reward rules (one row, change any number; tell members before you make them harder):

```sql
select * from public.forum_reward_rules;
update public.forum_reward_rules set karma = 300, best_answers = 3, updated_at = now();
```

Rewards claimed:

```sql
select c.claimed_at, u.email, c.status, c.pro_until
from public.forum_reward_claims c join auth.users u on u.id = c.user_id
order by c.claimed_at desc;
```

## Switches

```sql
select public.community_owner_switch('community_posting', false);  -- reading still works
select public.community_owner_switch('community_photos', false);   -- no new photos
select public.community_owner_switch('community_rewards', false);  -- no new rewards
select public.community_owner_switch('community', false);          -- Community paused
```

Use `true` to turn one back on.

## Everything you did

```sql
select * from public.forum_mod_log order by at desc limit 100;
```
