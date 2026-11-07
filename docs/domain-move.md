# Moving from overloadgym.in to macrotrophy.in

Both domains point at the same Cloudflare Pages project, so every deploy reaches both. The move
has two switches: the rename release (safe on both domains) and the cutover
(`VITE_CANONICAL_ORIGIN`), which sends browser visits on the old domain to the new one.

## Before merging the rename

1. Cloudflare: `macrotrophy.in` active, attached to the Pages project, `www` redirected.
2. Email Routing: `team@macrotrophy.in` forwards to the team Gmail (the app's contact email).
3. Edge Functions: deploy both, then allow both origins. Order matters: the old code reads
   `APP_ORIGIN` as one address, so set the list only after the deploy.

   ```
   npx supabase functions deploy coach
   npx supabase functions deploy billing
   npx supabase secrets set APP_ORIGIN=https://macrotrophy.in,https://overloadgym.in
   ```

   Without this, Macrotrophy AI and payments fail on macrotrophy.in (the browser blocks them).

4. Supabase Authentication, URL Configuration: add `https://macrotrophy.in/**` to Redirect URLs.

## After the rename is live

1. Razorpay, Account & Settings: add `https://macrotrophy.in` as a website (keep the old one),
   update the display name and logo. Wait for approval.
2. Search Console and Bing: `macrotrophy.in` verified, sitemap `https://macrotrophy.in/sitemap.xml`.

## Cutover (after Razorpay approves)

1. Cloudflare Pages, Settings, Variables: `VITE_CANONICAL_ORIGIN=https://macrotrophy.in`
   (Production), then retry the latest deployment (the variable is read at build time).
2. Supabase Site URL: `https://macrotrophy.in`.
3. Search Console, old property, Settings, Change of address: pick `macrotrophy.in`.

What people see after the cutover:

- A browser visit to overloadgym.in: a 301 to the same page on macrotrophy.in.
- A browser tab that has the app open: waits for its changes to sync, offers to save progress
  photos (they live only in that browser), then moves.
- The app installed from overloadgym.in: never moves and keeps updating; every few days it shows
  how to install the new one. It must keep working: keep overloadgym.in renewed and attached.

Rolling back the cutover: delete the variable and retry the deployment.
