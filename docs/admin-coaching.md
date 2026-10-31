# 1:1 coaching: admin guide

1:1 coaching (November 2026) is a ₹999 a month plan that includes Pro for the month and a
personal coach on calls and WhatsApp. It is sold on `/coaching`, linked from More, the Pro page
and the release announcement. Everything below is run in the Supabase SQL editor.

## 1. Apply the migrations (before deploying the app)

Run, in order, if they are not applied yet:

1. `supabase/migrations/20261031000017_profile_photo.sql`
2. `supabase/migrations/20261031000018_coaching.sql`

Both are safe to run more than once.

Then redeploy the billing function, which now accepts the coaching plan (until it is redeployed,
joining coaching answers "Choose a plan."; Pro is unaffected):

```bash
npx supabase functions deploy billing --no-verify-jwt
```

The current app ignores the new plan and the new columns, so steps 1 and the deploy can be done
before the app is merged.

## 2. Create the Razorpay plan

In the Razorpay dashboard (test mode first, then live): Subscriptions, Plans, Create plan.
Name "Overload 1:1 coaching", amount ₹999, billing every 1 month. Copy the `plan_...` id, then:

```sql
update public.billing_plans set razorpay_plan_id = 'plan_XXXXXXXX' where id = 'coach_monthly';
```

Until this is set the page shows "Opening soon" on the renewing button; paying once for one
month (a Razorpay order) already works because orders need no plan. To hide coaching entirely:

```sql
update public.billing_plans set active = false where id = 'coach_monthly';
```

To change the price later, create a new Razorpay plan and update both columns:

```sql
update public.billing_plans
set price_inr = 1299, once_price_inr = 1299, razorpay_plan_id = 'plan_NEW', updated_at = now()
where id = 'coach_monthly';
```

## 3. Set the coach

The name and WhatsApp number (country code, digits only) are shown only to members whose
coaching is active. The number is never in the app's code.

```sql
update public.app_settings set coach_name = 'Coach name', coach_whatsapp = '919876543210';
```

## 4. Who joined, and what they told the coach

```sql
select u.email, s.coaching_expires_at, s.billing_plan, s.billing_kind, s.razorpay_status,
       i.phone, i.goal, i.schedule, i.notes, i.updated_at
from public.subscriptions s
join auth.users u on u.id = s.user_id
left join public.coaching_intake i on i.user_id = s.user_id
where s.coaching_expires_at > now()
order by s.coaching_expires_at;
```

Members who paid but have not sent the form yet show a null `goal`. Message them first.

## 5. Giving or ending coaching by hand (refunds, friends, a free month)

```sql
-- One month of coaching and Pro from now.
update public.subscriptions
set coaching_expires_at = greatest(coalesce(coaching_expires_at, now()), now()) + interval '1 month',
    pro_expires_at = greatest(coalesce(pro_expires_at, now()), now()) + interval '1 month',
    status = 'active'
where user_id = (select id from auth.users where email = 'person@example.com');

-- End it now (Pro they paid for separately is left alone).
update public.subscriptions set coaching_expires_at = now()
where user_id = (select id from auth.users where email = 'person@example.com');
```

## How it works

- Coaching has its own end date (`subscriptions.coaching_expires_at`), so a year of Pro plus one
  month of coaching gives one month of coaching.
- Every coaching payment also extends Pro by the same period (`billing_activate`,
  `billing_order_paid`), so Pro is always on while coaching is.
- Someone with a renewing Pro plan is asked to cancel its renewal first, so they are never
  charged for two subscriptions.
- The intake form is `submit_coaching_intake`, allowed only while coaching is active; members
  read their own row through `get_my_coaching`. The table has RLS and no direct access.

## Your side of the promise

The page promises an experienced, science-based coach who builds the member's training and diet,
messages them on WhatsApp to set up a first call, and stays with them on WhatsApp. It makes no
promise of reply times. If you add one (for example "a plan within 48 hours"), add it to
`src/features/coaching/CoachingPage.tsx` only once you can keep it.
