# Sign-in codes and Continue with Google (November 2026)

The app now confirms new accounts and signs people in with a code typed into the app, not a
link. The code screen also explains where to look if the email went to spam, and has a resend
button that waits 60 seconds between emails, as Supabase does. Continue with Google is built
but stays hidden until it is switched on.

Code: `src/app/account.ts` (`verifyEmailCode`, `sendSignInCode`, `resendSignupCode`,
`signInWithGoogle`), `src/features/account/EmailCode.tsx` (`CodeEntry`, `SpamHint`,
`GoogleSignIn`) and `src/features/account/AuthPages.tsx`. Tests:
`tests/e2e/signin-food-updates.spec.ts`.

## 1. Email templates (do this before merging)

Supabase, Authentication, Emails (Templates). The app works with links as before, but people
only see a code if the template contains one.

**Confirm signup**, subject `Your Macrotrophy code: {{ .Token }}`:

```
Your Macrotrophy code is {{ .Token }}

Type it in the app to confirm your account. It works for one hour.

If you did not create a Macrotrophy account, ignore this email.

Or confirm with this link: {{ .ConfirmationURL }}
```

**Magic Link** (used for "Use an email code instead"), subject
`Your Macrotrophy sign-in code: {{ .Token }}`:

```
Your Macrotrophy sign-in code is {{ .Token }}

Type it in the app to sign in. It works for one hour.

If you did not ask to sign in, ignore this email.

Or sign in with this link: {{ .ConfirmationURL }}
```

Keep the templates as plain text, with no images and no buttons. The link at the end is for
two weeks: an older copy of the app that has not reloaded yet still says "open the link". After
two weeks, delete the last line of both templates so the emails have no link at all.

Also check, in Authentication, Sign In / Providers, Email: **Email OTP Length** is 6, and
**Email OTP Expiration** is 3600 seconds (one hour).

## 2. Email rate limit

Authentication, Rate Limits, "Rate limit for sending emails". Every sign-up, resend and code
sign-in sends one email. With your own SMTP (Brevo) the limit is yours to set: raise it to at
least 100 an hour. Brevo's own daily limit on its plan still applies.

## 3. Continue with Google

1. Google Cloud console, APIs and Services, Credentials: create an OAuth client ID, type Web
   application. Authorised redirect URI: `https://mppxwhdvczzgfqevdwgi.supabase.co/auth/v1/callback`.
   OAuth consent screen: app name Macrotrophy, support email `team@macrotrophy.in`, scopes
   email, profile and openid only, then Publish app (so anyone can sign in, not only test users).
2. Supabase, Authentication, Sign In / Providers, Google: turn it on and paste the client ID and
   secret.
3. Supabase, Authentication, URL Configuration, Redirect URLs: make sure these are listed:
   `https://macrotrophy.in/**` and `https://overloadgym.in/**`.
4. Switch the button on (SQL editor):

   ```sql
   update public.app_settings set flags = flags || '{"google_sign_in": true}'::jsonb;
   ```

   To hide it again: the same with `false`.

5. Test it yourself in Chrome on a phone and on a computer before telling anyone.

Where it shows: sign in and create account, in a browser and in the Android home-screen app.
It is hidden in the iPhone home-screen app, because Google's page opens in a separate sheet
there and the sign-in would not come back to the app. iPhone users can use the email code or
their password in the installed app.

Someone who signs in with Google using the same Gmail address as an existing email account
reaches that same account (Supabase links them when the email is confirmed).

## Limits worth knowing

Supabase counts sign-ups and sign-ins per IP address: 30 every 5 minutes, and code checks 30
every 5 minutes. A whole hostel or gym on one Wi-Fi could reach that in a rush; raise them in
Authentication, Rate Limits if it ever happens. Google sign-ins count as monthly active users
like any other (50,000 included on the Free plan).
