# Razorpay setup for Overload Pro

Pro is sold as Razorpay subscriptions: monthly, 3 months and yearly. Prices live in the
`billing_plans` table (migration `20261011000008_razorpay_billing.sql`), so the app never
hard-codes a price. Payments are confirmed only on the server by the `billing` Edge Function,
which checks Razorpay's signatures with secrets the app never sees.

How it works:

1. The person picks a plan on the Pro page and taps Subscribe.
2. The app asks the `billing` function to create a Razorpay subscription for that plan.
3. Razorpay Checkout opens (UPI autopay, cards and more). The first payment is taken now, even
   during the free trial, and the plan starts that day.
4. Checkout returns a signed result. The function checks the signature against the
   subscription stored for that account, asks Razorpay for the paid period, and turns Pro on.
5. Razorpay sends webhooks for every renewal (`subscription.charged`), which extend Pro, and for
   cancellations, failures and completion. Each webhook is checked and applied once.
6. Cancelling on the Pro page stops renewal. Pro stays on until the end of the period paid for.

## 1. Razorpay dashboard (test mode first)

1. Test mode on.
2. **Account & Settings > API Keys**: generate a test key. Keep the Key Secret private.
3. **Subscriptions > Plans**: create Monthly (₹29, every 1 month), 3 months (₹69, every 3
   months) and Yearly (₹249, every 1 year). Note the three `plan_...` ids.

## 2. Apply the database migration

In Supabase, **SQL editor**: paste and run
`supabase/migrations/20261011000008_razorpay_billing.sql` (once).

Then connect the plans (test plan ids shown; use the live ones when going live):

```sql
update public.billing_plans set razorpay_plan_id = 'plan_TmJNFACDbra03X' where id = 'monthly';
update public.billing_plans set razorpay_plan_id = 'plan_TmJNvuUeyHZrDY' where id = 'quarterly';
update public.billing_plans set razorpay_plan_id = 'plan_TmJOUMCcxJUXT7' where id = 'yearly';
```

A plan with no `razorpay_plan_id` shows its price with "Plans open soon" and cannot be bought.

To change a price: create a new plan in Razorpay with the new price, then update both columns:

```sql
update public.billing_plans
set price_inr = 39, razorpay_plan_id = 'plan_NEW_ID', updated_at = now()
where id = 'monthly';
```

Existing subscribers keep the plan they bought; new subscribers get the new one.

## 3. Deploy the billing function

On a computer with Node installed, in the project folder:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy billing --no-verify-jwt
```

`--no-verify-jwt` is needed because Razorpay's webhook has no Supabase token; the function
checks the signed-in user itself for every other route. The project ref is the part of your
Supabase URL before `.supabase.co`.

## 4. Secrets (never in the app, the repository or chat)

```bash
npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_TmJLEu7kpvpwJm
npx supabase secrets set RAZORPAY_KEY_SECRET=<your key secret>
npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=<the secret you choose in step 5>
npx supabase secrets set APP_ORIGIN=https://<your-site>
```

Or in the dashboard: **Edge Functions > Secrets**. `APP_ORIGIN` is the app's address, so only
the app can call the function from a browser.

## 5. Webhook

Razorpay dashboard, **Account & Settings > Webhooks > Add New Webhook**:

- URL: `https://<your-project-ref>.supabase.co/functions/v1/billing/webhook`
- Secret: a long random string; the same value as `RAZORPAY_WEBHOOK_SECRET`.
- Events: `subscription.activated`, `subscription.charged`, `subscription.pending`,
  `subscription.halted`, `subscription.cancelled`, `subscription.completed`.

## 6. Test a payment

1. End early access if it is still on, so the trial and plans apply:
   `update public.app_settings set early_access_ended_at = now();`
2. Sign up with a new account, open Pro, choose a plan and pay with a Razorpay test card or
   test UPI id (see Razorpay's "Test Subscriptions" page).
3. Pro should switch on at once, and "Your plan" should show the renewal date.
4. Cancel the plan: it should say "Ends on ... It will not renew", and Pro stays on.

Useful queries:

```sql
-- Who is on which plan.
select u.email, s.billing_plan, s.razorpay_status, s.pro_expires_at, s.cancel_at_period_end
from public.subscriptions s join auth.users u on u.id = s.user_id
where s.billing_plan is not null
order by s.updated_at desc;

-- Webhooks received.
select * from public.billing_events order by received_at desc limit 50;
```

## 7. Going live

1. Finish Razorpay account activation (KYC). Razorpay reviews the website; it usually needs
   contact details, terms, privacy policy, and cancellation and refund policy pages.
2. In live mode: generate live keys, create the same three plans, add the same webhook with a
   new secret.
3. Update the three `razorpay_plan_id` values with the live plan ids, and set the three secrets
   to the live values. No app release is needed.

## Security notes

- The app never sees the Key Secret or the webhook secret.
- Pro is granted only by `billing_activate`, which only the service role can run, and only after
  a valid Razorpay signature. Users cannot read or write `billing_plans`, `billing_events` or
  their `subscriptions` row directly.
- A checkout signature is checked against the subscription stored for that account, so a
  signature from someone else's payment does not work.
- Webhooks never shorten Pro, and repeated deliveries are ignored.
- The site's Content Security Policy allows Razorpay's checkout script, window and API only.
