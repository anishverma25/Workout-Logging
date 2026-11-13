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
3. **Subscriptions > Plans**: create Monthly (₹149, every 1 month), 3 months (₹399, every 3
   months) and Yearly (₹1,499, every 1 year). Note the three `plan_...` ids.

## 2. Apply the database migration

In Supabase, **SQL editor**: paste and run
`supabase/migrations/20261011000008_razorpay_billing.sql` (once).

Then connect the plans (test plan ids shown; use the live ones when going live):

```sql
update public.billing_plans set razorpay_plan_id = 'plan_TmJNFACDbra03X' where id = 'monthly';
update public.billing_plans set razorpay_plan_id = 'plan_TmJNvuUeyHZrDY' where id = 'quarterly';
update public.billing_plans set razorpay_plan_id = 'plan_TmJOUMCcxJUXT7' where id = 'yearly';
```

1:1 coaching (₹999 a month, migration 0018) is one more plan, `coach_monthly`; its setup is in
`docs/admin-coaching.md`.

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

## New prices and coupons (November 2026, migration 0024)

Prices are ₹149 a month, ₹399 for 3 months and ₹1,499 a year, shown as they are.

1. Run `supabase/migrations/20261113000024_pricing_coupons.sql` in the SQL editor. It sets the
   prices and disconnects the old Razorpay plans (a Razorpay plan has a fixed amount). From that
   moment pay once works at the new prices and autopay says "opens soon".
2. Deploy the function: `supabase functions deploy billing --no-verify-jwt`.
3. In the Razorpay dashboard (live mode), **Subscriptions > Plans**, create three plans with
   exactly these amounts: ₹149 every 1 month, ₹399 every 3 months, ₹1,499 every 1 year.
4. Connect them:

   ```sql
   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'monthly';
   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'quarterly';
   update public.billing_plans set razorpay_plan_id = 'plan_...' where id = 'yearly';
   ```

   The function asks Razorpay for the plan's amount before every new autopay and refuses if it is
   not the server's price, so a wrong plan id can never charge a wrong amount.

People already on autopay keep their Razorpay subscription and the price they joined at.

How paying works now:

- Autopay and pay once are both offered every time.
- Someone with paid time left (paid once, or renewal turned off) who starts autopay is first
  charged when that time runs out (`start_at`), so nothing is paid twice.
- A member whose plan renews must turn renewal off before changing plan or paying once.
- A renewal stuck on a failed payment (pending or halted) is cancelled at Razorpay when the
  person next tries to pay, so they are never locked out.
- If a payment fails and the person closes the window, the page shows Razorpay's reason and
  offers one payment instead.

Coupons (10% off the first payment of a Pro plan, one coupon per account, ever):

```sql
-- make a code (letters and digits, 3 to 20, upper case)
insert into public.coupons (code, note) values ('ANKIT10', 'Ankit Instagram');
-- optional: another percent (1 to 50), an end date, a limit on uses
insert into public.coupons (code, percent, expires_at, max_uses)
values ('DIWALI15', 15, '2026-12-01', 100);
-- turn one off
update public.coupons set active = false where code = 'ANKIT10';
-- who used what
select u.code, u.discount_inr, u.used_at, a.email
from public.coupon_uses u join auth.users a on a.id = u.user_id order by u.used_at desc;
```

With pay once the order is simply made for the lower amount. With autopay the first period is
charged up front at the lower amount (a Razorpay add-on) and the plan's own charges start one
period later at the normal price. A code counts as used only when its payment is confirmed.

Before telling people about codes, make one real autopay payment with a code on your own account
and check in the Razorpay dashboard that the first charge is the lower amount.

## Security notes

- The app never sees the Key Secret or the webhook secret.
- Pro is granted only by `billing_activate`, which only the service role can run, and only after
  a valid Razorpay signature. Users cannot read or write `billing_plans`, `billing_events` or
  their `subscriptions` row directly.
- A checkout signature is checked against the subscription stored for that account, so a
  signature from someone else's payment does not work.
- Webhooks never shorten Pro, and repeated deliveries are ignored.
- The site's Content Security Policy allows Razorpay's checkout script, window and API only.
