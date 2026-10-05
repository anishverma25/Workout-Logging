# Pro payments: administrator guide

Pro is granted by hand after checking a UPI payment. There is no admin screen, admin flag,
unlock code or shared password in the app. All of this happens in the Supabase dashboard
(SQL editor), which runs with the database owner's rights. Never paste these queries into the
app or share the service role key.

## Settings the app needs

Set these in the hosting provider's environment (and `.env.local` for local builds). If any is
missing or invalid, the Pro page says payments are not open yet.

| Variable               | Meaning                           |
| ---------------------- | --------------------------------- |
| `VITE_UPI_ID`          | The UPI ID that receives payments |
| `VITE_UPI_PAYEE_NAME`  | Payee name shown to the person    |
| `VITE_PRO_PRICE_INR`   | Price in rupees                   |
| `VITE_PRO_PERIOD_DAYS` | Days of Pro one payment buys      |

## How a payment arrives

1. The person pays the price to the UPI ID. The payment note should contain their account
   reference: the first 8 characters of their user id, without dashes, in capitals.
2. They paste the UPI transaction reference (UTR) into the Pro page. Their row moves to
   `payment_pending`. This grants nothing by itself.
3. You match the reference against your UPI app or bank statement, then grant Pro below.

## Payments waiting to be checked

```sql
select u.email,
       upper(left(replace(s.user_id::text, '-', ''), 8)) as account_ref,
       s.payment_reference,
       s.payment_submitted_at,
       s.pro_expires_at
from public.subscriptions s
join auth.users u on u.id = s.user_id
where s.status = 'payment_pending'
order by s.payment_submitted_at;
```

## Grant Pro after checking the payment

Adds the paid period from now, or from the end of the current Pro period if it is still
running. Replace the email and the number of days.

```sql
update public.subscriptions
set status = 'active',
    pro_started_at = case when pro_expires_at > now() then pro_started_at else now() end,
    pro_expires_at = greatest(coalesce(pro_expires_at, now()), now()) + interval '30 days',
    admin_note = concat_ws(e'\n', admin_note,
      to_char(now(), 'YYYY-MM-DD') || ': verified UPI ' || coalesce(payment_reference, 'n/a'))
where user_id = (select id from auth.users where email = 'person@example.com');
```

The app picks the change up within ten minutes, or immediately when the person reopens it.

## The reference does not match a payment

```sql
update public.subscriptions
set status = case when trial_expires_at > now() then 'trialing' else 'expired' end,
    admin_note = concat_ws(e'\n', admin_note,
      to_char(now(), 'YYYY-MM-DD') || ': reference not found ' || coalesce(payment_reference, ''))
where user_id = (select id from auth.users where email = 'person@example.com');
```

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
