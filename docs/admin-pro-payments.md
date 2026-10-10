# Pro payments: administrator guide

Until automatic billing (Razorpay) is built, Pro is only granted by hand. There is no admin screen, admin flag,
unlock code or shared password in the app. All of this happens in the Supabase dashboard
(SQL editor), which runs with the database owner's rights. Never paste these queries into the
app or share the service role key.

## Ending early access

The app no longer shows any founding member or early access wording. While the server setting
below is still open, every signed-in account simply sees "Pro is active" with no clock. That is
a single server setting, so nothing on a phone can turn it on.

Payments: the app takes none at the moment. The manual UPI flow was removed from the app;
automatic billing (Razorpay subscriptions, monthly, 3 months and yearly) comes after the UI
redesign. Until then, the grant query below gives Pro by hand.

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
