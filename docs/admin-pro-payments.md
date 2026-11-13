# Pro payments: administrator guide

Pro is bought through Razorpay (`docs/razorpay-setup.md`) and can also be granted by hand. There is no admin screen, admin flag,
unlock code or shared password in the app. All of this happens in the Supabase dashboard
(SQL editor), which runs with the database owner's rights. Never paste these queries into the
app or share the service role key.

## Ending early access

The app no longer shows any founding member or early access wording. While the server setting
below is still open, every signed-in account simply sees "Pro is active" with no clock. That is
a single server setting, so nothing on a phone can turn it on.

Payments are Razorpay subscriptions (monthly, 3 months, yearly); see
`docs/razorpay-setup.md`. The grant query below still gives Pro by hand when needed.

End early access in the SQL editor when you are ready for the trial rules to apply:

```sql
update public.app_settings set early_access_ended_at = now();
```

After that the normal rules apply to everyone: the 168-hour trial from when the account was
created (so accounts older than 7 days go straight to the free plan), then Pro by plan.
To give existing accounts time first, either end it later
(`set early_access_ended_at = now() + interval '7 days'`) or grant them Pro for a period with
the grant query below.

To reopen early access: `update public.app_settings set early_access_ended_at = null;`

Accounts created during early access (the server still marks them), for a thank-you or a
discount later:

```sql
select u.email, s.created_at
from public.subscriptions s join auth.users u on u.id = s.user_id
where s.created_at < coalesce((select early_access_ended_at from public.app_settings), now())
order by s.created_at;
```

## Grant Pro by hand

Adds the paid period from now, or from the end of the current Pro period if it is still
running. Replace the email and the number of days.

```sql
update public.subscriptions
set status = 'active',
    pro_started_at = case when pro_expires_at > now() then pro_started_at else now() end,
    pro_expires_at = greatest(coalesce(pro_expires_at, now()), now()) + interval '30 days',
    admin_note = concat_ws(e'\n', admin_note,
      to_char(now(), 'YYYY-MM-DD') || ': granted by hand')
where user_id = (select id from auth.users where email = 'person@example.com');
```

The app picks the change up within ten minutes, or immediately when the person reopens it.

## Revoke Pro (refund, chargeback)

```sql
update public.subscriptions
set status = 'revoked',
    admin_note = concat_ws(e'\n', admin_note, to_char(now(), 'YYYY-MM-DD') || ': revoked, reason here')
where user_id = (select id from auth.users where email = 'person@example.com');
```

A revoked account keeps every free feature and all of its data.

## What cannot be changed

- The trial is exactly 168 hours from account creation. A database trigger keeps
  `trial_started_at` and `trial_expires_at` fixed, even for the owner.
- Users cannot read the table directly, cannot write to it at all, and never see `admin_note`.
  They can only call `get_my_subscription()` and `submit_payment_reference()`.

## Free and Pro (November 2026, release 2)

Macrotrophy AI is Pro only: the AI services are on free tiers and cannot carry free members.

Free is a complete logger: workouts, routines, every template, full history and records, Indian
food logging and Eat next, body metrics and targets, groups and leaderboards, 30 days of
Progress, backup and sync. History is never locked.

What makes people want Pro, without taking anything away:

- **What Pro found** (Progress, free members): real facts from their own logs ("2 lifts are ready
  for more weight", "1 lift has stalled", "a part of your training is out of balance"), with the
  which, why and what to do behind Pro.
- **Weekly check-in**: the good news is free (sessions, lifts up, records); what stalled and the
  focus for this week are Pro.
- **Leaderboards**: anyone can see the routine of a person on the board; copying it is Pro.
  Paying members (a paid plan or coaching, not the trial) wear a gold crown on every board.
- **Duels**: one a week on the free plan, three with Pro.
- **Story cards**: three designs free; LED scoreboard, die-cut sticker, caption note and rings
  widget are Pro. Free members can try them on their own card; saving needs Pro.
- Everything Pro already had stays Pro: the plan that adapts, the meal plan, the weekly report,
  Macrotrophy AI, food insights, plateaus, progression, strength levels, balance, 90-day and
  all-time trends, goal dates, recaps, the extra group boards and 10 groups instead of 3.
