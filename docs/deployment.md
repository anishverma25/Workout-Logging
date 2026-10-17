# Deployment

Free-tier only: GitHub for code, Supabase for accounts and data, Cloudflare Pages for hosting.
No paid infrastructure is needed: the app runs on a `*.pages.dev` address, and the production site is
served from the custom domain `overloadgym.in` (see Custom domain below).

## Environments

| Environment | App                                | Supabase                           | Env vars set in                    |
| ----------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| Local       | `pnpm dev` (http://localhost:5173) | none (device only), or your own    | `.env.local` (git ignored)         |
| Tests       | `pnpm test:e2e`                    | local fake (`tests/fake-supabase`) | `.env.e2e` (committed, not secret) |
| Preview     | Cloudflare preview deployments     | a separate staging project         | Cloudflare: Preview environment    |
| Production  | Cloudflare production branch       | the production project             | Cloudflare: Production environment |

Keep staging and production in separate Supabase projects so testing never touches real users'
data. The free plan allows two active projects.

Variables (all public by design, they are shipped to the browser):

| Variable                 | Needed for        | Notes                                                  |
| ------------------------ | ----------------- | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | accounts and sync | Project URL                                            |
| `VITE_SUPABASE_ANON_KEY` | accounts and sync | The anon / publishable key. Never the secret key.      |
| `VITE_DEMO_AUTOLOAD`     | optional          | `true` loads the demo athlete for guests. Default off. |

Secrets that must never appear in the repository or in Cloudflare variables starting with
`VITE_`: the Supabase service role / secret key, the database password, SMTP passwords. The
app never needs them. `pnpm build` fails if a service role key ends up in the bundle.

## 1. Supabase (production)

1. Create a project at supabase.com. For users in India, choose the Mumbai region.
2. Apply the migrations in `supabase/migrations`, in file-name order: either
   `supabase link --project-ref <ref>` then `supabase db push`, or paste each file into the SQL
   editor and run it.
3. Authentication > Providers > Email: keep it enabled. Set the minimum password length to 8.
4. **Email sending.** The built-in email service sends at most 2 emails per hour per project,
   which is not enough even for a small test group (sign-up confirmations and password resets
   share it). Choose one:
   - Recommended: Authentication > SMTP settings, and connect a free transactional email
     provider. Then raise the email rate limit under Authentication > Rate limits.
   - For a first closed test only: turn off "Confirm email". The app signs people in straight
     away. Password reset emails still use the 2 per hour limit.
5. Authentication > URL configuration: Site URL = your production address (for example
   `https://overloadgym.in`). Add redirect URLs `https://overloadgym.in/account` and
   `https://overloadgym.in/reset-password`. Keep the old `pages.dev` ones while that address is
   still in use.
6. Project settings > API: copy the URL and the anon / publishable key for step 2 below.

**Free plan pausing.** Free projects are paused after about a week of low activity (a warning
email comes first). Normal daily use by testers keeps it active. A paused project is resumed
from the dashboard with all data intact. While paused, the app keeps working on each device and
syncs again once the project is resumed.

**Backups.** Take a manual backup before each migration and weekly during testing:
`supabase db dump --data-only -f backup-YYYY-MM-DD.sql` (store it outside the repository).

## 2. Cloudflare Pages

1. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git, and pick the GitHub
   repository.
2. Build settings: framework preset None, build command `pnpm build`, output directory `dist`.
3. Environment variables (Production, and separately Preview with the staging project):
   `NODE_VERSION=22`, plus the `VITE_` variables above.
4. Choose the production branch (for example `main`). Other branches get preview addresses.
5. Deploy. Pages serves `index.html` for every in-app address automatically because the build has
   no `404.html`, and applies `dist/_headers` (security headers, caching).

The build writes `_headers` with a Content Security Policy that allows API calls only to the
configured Supabase URL. If you change `VITE_SUPABASE_URL`, redeploy.

Free plan limits that matter here: 500 builds a month, one build at a time, 20,000 files per
site. The app uses well under 100 files.

## Custom domain (overloadgym.in)

1. Cloudflare: add the domain as a site (Free plan). At the registrar (GoDaddy) set the two
   Cloudflare nameservers. A `.in` domain stays on Registrar Hold until the owner email is
   verified (WHOIS verification), and nameservers cannot be changed until then.
2. Workers & Pages > the project > Custom domains: add `overloadgym.in` (and `www`). DNS
   records and the certificate are created by Cloudflare.
3. Rules > Redirect Rules: "Redirect from WWW to root" (301, preserve query string). The `www`
   record stays proxied.
4. Email: Brevo domain authentication (DKIM, verification and DMARC records in Cloudflare DNS,
   CNAMEs set to DNS only), sender `no-reply@overloadgym.in`, an SMTP key. In Supabase,
   Authentication > Emails > SMTP: host `smtp-relay.brevo.com`, port `587`, the SMTP login and
   key. The key expires with its date and after 90 days of no use: renew it before then.
5. Supabase: Site URL and redirect URLs on the new domain (above), and the `APP_ORIGIN` secret
   of the `billing` function set to `https://overloadgym.in` (the function only accepts calls
   from that origin).
6. Razorpay: add `https://overloadgym.in` under Account & Settings > Business website details
   (verification takes 24 to 48 hours; the review logs in with a free test account). Keep the old
   entry until the move is done. Payments on an unapproved address can be refused.
7. Move the old address (only after Razorpay approves the new one and a test payment works):
   set `VITE_CANONICAL_ORIGIN=https://overloadgym.in` in Cloudflare Pages > Settings >
   Variables (Production) and redeploy. Anyone opening `overload-gym.pages.dev` is then sent to
   the same page on the new domain, once their changes are saved to their account
   (`src/app/domain.ts`). Previews and localhost never move. Unset it to turn the move off.

Data in a browser belongs to one address, so people sign in again on the new domain; what was
synced comes back. Share previews use the tags and `public/og-image.png` in `index.html`.

## 3. After the first deploy

- Open the production address on a phone. Sign up, log a set, reload, check Account says
  "Synced to your account".
- Turn on flight mode, reload: the app opens and logging works. Turn it off: it syncs.
- Install it (Settings > Install the app) and open it from the home screen.
- In Supabase, Table editor > subscriptions: the new account has a row with a 168-hour trial.

## Releasing an update

1. `pnpm check` and `pnpm test:e2e` pass locally (CI runs both on every push).
2. If there is a migration: back up, then apply it to staging, test the preview deployment,
   then apply it to production before merging. Migrations are written to work with the
   previous app version too, because installed apps update on their own schedule.
3. Merge to the production branch. Installed apps show "A new version of the app is ready" and
   switch when the person taps Reload, so an update never interrupts a workout.

**Rollback:** Cloudflare Pages > Deployments > the previous deployment > Rollback. Database
migrations are forward only: fix forward with a new migration rather than editing an old one.
