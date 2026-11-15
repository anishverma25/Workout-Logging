# Error reports and the onboarding funnel

The app sends a short technical report when something breaks, and a count when someone reaches an
onboarding step (migration `20261114000032_client_errors.sql`, `src/app/errorReport.ts`). Nothing
personal is in them: no food names, notes, AI text, emails, tokens, query strings or hashes.
Each person sends at most 20 distinct reports a day, and a repeat only adds to `count`. Rows older
than 30 days are deleted automatically.

Run these in the Supabase SQL editor. Nobody can read this table from the app.

## Today's top errors, by version

```sql
select app_version, kind, route, message,
       count(distinct user_id) as people, sum(count) as times
  from public.client_errors
 where kind <> 'step' and day >= (now() at time zone 'utc')::date - 1
 group by app_version, kind, route, message
 order by people desc, times desc
 limit 30;
```

`kind` is one of:

- `crash`: the whole app crashed (the "Macrotrophy ran into a problem" screen).
- `route`: one screen crashed ("This screen ran into a problem").
- `chunk`: a code file of an older version was missing (usually fixed by the automatic reload).
- `error`, `unhandled`: an error nobody caught; the app kept running.
- `sync_rejected`: the server refused a change. The message is the table and a constraint name
  or error code, never the row.

## One error in detail

```sql
select day, app_version, route, message, stack, user_agent, count
  from public.client_errors
 where fingerprint = 'paste the fingerprint here'
 order by last_at desc
 limit 20;
```

The stack points into the built files. To read it, open the matching `.map` file from the
`sourcemaps/` folder that `pnpm build` leaves on the machine that built that version (it is never
deployed).

## The onboarding funnel (last 14 days)

```sql
with steps as (
  select fingerprint as step, count(distinct user_id) as people
    from public.client_errors
   where kind = 'step' and day >= (now() at time zone 'utc')::date - 14
   group by fingerprint
)
select step, people from steps
 order by array_position(
   array['tour_done', 'signed_up', 'setup_done', 'first_workout', 'first_food'], step
 );
```

`tour_done` is sent once the person has an account (it waits on the phone until then), so it
counts people who took the tour and then signed up.

## Clearing everything

```sql
delete from public.client_errors;
```
