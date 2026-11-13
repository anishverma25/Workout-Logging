# Groups and leaderboards: admin guide

Groups (November 2026) let people pick a unique username, create a group (which gets a 6-character
join code) or join one by typing its code, and compete on weekly and monthly leaderboards. Everything
is in `supabase/migrations/20261102000019_groups.sql`; the app side is `src/app/community.ts` and
`src/features/groups`.

## 1. Before deploying

Run `supabase/migrations/20261102000019_groups.sql` in the Supabase SQL editor. It is safe to run
more than once and changes no existing table (it only adds tables, indexes and functions).

If the app is deployed before the SQL is run, nothing breaks: the Groups page says "Groups are
not available yet" and the Home card stays hidden.

Check it worked:

```sql
select public.community_board(gen_random_uuid(), now() - interval '7 days', now());
-- returns []
```

## 2. How scores work

Worked out on the server from synced workouts and food logs, never sent by the phone.

| Part | Points | Cap per week |
| --- | --- | --- |
| Workout: completed, 10+ minutes, 3+ working sets, logged live (created within 2 days of starting) | 10 | 2 a day, 6 a week |
| Hard set: working, back-off or drop set not logged as easy (RIR 5+ or RPE under 6) | 1 | 25 |
| Record: best estimated 1RM (Epley, 1 to 10 reps) on an exercise done in 2+ earlier workouts, at most 40% above the old best | 5 | 5 |
| Protein day: logged protein reaches 90% of the person's target (logs made by the end of the next day) | 3 | 7 |

Monthly caps grow with the length of the month. Ties go to more hard sets, then more workouts,
then whoever got there first. Weeks run Monday to Sunday, India time. A finished week or month is
frozen in `group_results` the first time anyone views it.

Limits: 30 people per group; 1 group per person on the free plan, 10 with Pro (migration 0027; groups joined before stay). Free users see the
Overload Score board; Pro adds Consistency, Effort, Progress and Volume.

## 3. Privacy

The tables have row level security and no direct access. The functions return only usernames,
points and the totals behind them, and only to members of the same group. Workouts, weights, food
and body weight never leave their owner. Deleting an account removes its username and memberships.

## 4. Useful SQL

```sql
-- Groups, their size and admin.
select g.name, g.code, g.created_at, count(m.*) as members,
       (select u.username from public.group_members a join public.usernames u on u.user_id = a.user_id
        where a.group_id = g.id and a.role = 'admin' limit 1) as admin
from public.groups g left join public.group_members m on m.group_id = g.id
group by g.id order by g.created_at desc;

-- Someone's username, by email.
select u.username from public.usernames u join auth.users a on a.id = u.user_id
where a.email = 'person@example.com';

-- Free an offensive or impersonating username (the person is asked to pick a new one).
delete from public.usernames where username = 'bad.name';

-- Rename or delete a group that breaks the rules.
update public.groups set name = 'Gym group' where code = 'ABC234';
delete from public.groups where code = 'ABC234';

-- This week's board for a group, as the server sees it.
select jsonb_pretty(public.community_board(g.id, b.from_ts, b.to_ts))
from public.groups g, public.community_bounds('week', 0) b where g.code = 'ABC234';
```

Removing a username also hides that person from boards until they pick a new one; their
memberships stay.

## 5. Global leaderboard

Everyone with points in the week or month appears on the global leaderboard (`/groups/global`),
by the same Overload Score. Others see the person's profile name and points. The username shows
only if the person turns on "Show my username" on that page. Everything is in
`supabase/migrations/20261102000020_global_leaderboard.sql` (run it after 0019, safe to run more
than once). If the app is deployed before it is run, the page says the leaderboard is not
available yet and the Home row stays hidden.

The board is worked out for everyone at once, so it is stored in `global_results` and refreshed
at most once a minute. A finished week or month is frozen the first time it is shown.

```sql
-- Check it worked (returns a number, 0 if nobody has points yet).
select jsonb_array_length(rows) from public.community_global_rows('week', 0);

-- Keep an account off the global board (for example a cheater or an offensive name).
insert into public.leaderboard_hidden (user_id, reason)
select id, 'cheating' from auth.users where email = 'person@example.com';

-- Put them back.
delete from public.leaderboard_hidden
where user_id = (select id from auth.users where email = 'person@example.com');

-- Refresh less often when there are many users (seconds, 0 to 3600).
update public.app_settings set leaderboard_refresh_seconds = 300;

-- Recompute this week now (the next view refreshes it).
delete from public.global_results where not final;
```

Hiding takes effect at the next refresh. A frozen past period keeps the hidden person until it is
recomputed: `delete from public.global_results where period = 'week' and starts_on = '2026-11-02';`.

