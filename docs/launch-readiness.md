# Launch readiness: first 10 to 15 users

Prepared 6 October 2026, after the QA audit (`docs/qa-report.md`) and the final polish pass.

## Launch checklist

Setup (only you can do these):

- [ ] Supabase project created (Mumbai region), migrations in `supabase/migrations` applied in order
- [ ] Email: free SMTP connected, or "Confirm email" turned off for the first group
- [ ] Auth URLs: Site URL and the `/account` and `/reset-password` redirect URLs set
- [ ] Cloudflare Pages connected to GitHub, `pnpm build`, output `dist`, `NODE_VERSION=22`
- [ ] Production variables set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only)
- [ ] Optional: the four payment variables, when you are ready to take payments
- [ ] Your own pass through "Critical things to test on your phone" below
- [ ] A first backup taken (`supabase db dump`)

Already true in the code:

- [x] Logging works offline and survives refresh, closing the app and losing signal
- [x] Sync is idempotent (no duplicates), retries, and never claims a backup it does not have
- [x] Each account is isolated at the database (row level security, tested with two users)
- [x] Trial is exactly 168 hours from account creation, set by the server
- [x] Pro cannot be granted from the browser; history is never locked
- [x] Demo data can never enter an account
- [x] Installable app, works offline, updates only when the person taps Reload
- [x] WCAG 2.1 AA on every screen in both themes; 44 px touch targets
- [x] 328 unit tests and 104 browser tests pass; CI runs both

## What was reviewed for launch risks

| Risk                | Where it could happen                                                         | Status                                                        |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Data loss           | Closing the app mid-workout, losing signal, signing out with unsynced changes | Saved locally first; sign-out keeps unsynced data and says so |
| Data loss           | Signing in on a device with workouts logged as a guest                        | Offered as an import; never deleted, never merged silently    |
| Confusion           | "Last time" showing sets that never happened                                  | Fixed                                                         |
| Confusion           | Summary saying "saved on this device" while synced                            | Fixed: shows real sync state                                  |
| Confusion           | A new account offered "Load demo data"                                        | Fixed: offers "Pick a routine"; demo blocked in accounts      |
| Broken logging      | Tapping done before history loaded                                            | Fixed: the tap waits for that exercise's history              |
| Broken logging      | Finishing offline before the app was cached                                   | Fixed: summary ships with the logger                          |
| Slow logging        | Long histories                                                                | Fixed: about 0.1 s per tap with two years of data             |
| Incorrect analytics | Totals, records, averages                                                     | Cross-checked against raw records in tests                    |
| Incorrect analytics | Count axes with half steps (2.5 reps)                                         | Fixed: whole-number axes                                      |
| Subscription        | Trial reset, self-granted Pro                                                 | Impossible: server-side and tested                            |
| Authentication      | Expired reset link, wrong password, unconfirmed email                         | Clear messages, tested                                        |
| Updates             | Old tab after a deploy cannot load a screen                                   | Fixed: reloads once to the new version                        |
| Mobile              | Overflow, tiny targets, keyboard                                              | No overflow at 360 to 1440 px; numeric keypad with decimals   |

## 1. First-user testing checklist

Send this to each tester with the link.

- [ ] Install the app to your home screen and open it from there
- [ ] Create an account
- [ ] Set up your profile (name, goal, experience)
- [ ] Pick a routine template and change one exercise or target to suit you
- [ ] Log at least 3 real workouts this week, at the gym, on your phone
- [ ] Log one set with no signal (or in flight mode) and check it syncs later
- [ ] Check "last time" on your second workout matches what you did
- [ ] Look at History, Records and Progress after 3 workouts
- [ ] Add your body weight on 3 different days
- [ ] Tell us anything that was slow, confusing or wrong, with a screenshot if you can

## 2. Ten-minute onboarding and testing flow

For a tester sitting with you (or on a call), in this order:

| Minute  | Step                                                              | What to watch for                                                   |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0 to 1  | Open the link, install to the home screen                         | Do they find install? Does the icon look right?                     |
| 1 to 2  | Create an account                                                 | Any hesitation on the form; email arrives (if confirmation is on)   |
| 2 to 3  | Profile: name and goal                                            | Do they find it under More > Profile?                               |
| 3 to 5  | Routines: pick a template, edit one target                        | Do templates make sense? Is editing a target obvious?               |
| 5 to 8  | Start today's workout, log 3 sets, let the rest timer run, finish | Speed per set; do they understand "last time" and the check button? |
| 8 to 9  | Look at the summary, then History                                 | Do the numbers match what they just did?                            |
| 9 to 10 | Open Pro                                                          | Is it clear what the trial includes and that history stays free?    |

Ask at the end: what would make you use this instead of your current notes app?

## 3. Critical things to test on your own phone

1. Install from Safari (iPhone) and Chrome (Android) if you can get both.
2. Log a full real workout at the gym, on mobile data, with the screen locking between sets.
3. Flight mode on, log 2 sets and finish; flight mode off, watch it switch to "Synced to your
   account".
4. Sign in on a laptop and check the workout is there with the same numbers.
5. Request a password reset and complete it from the email.
6. Grant yourself Pro in Supabase with `docs/admin-pro-payments.md`, then check the Pro page.
7. Leave the app installed for a day, then open it offline: it should open and work.
8. Switch to lb and back: no logged number changes.
9. If you set payment details: open the UPI link on your phone and check the payee and amount
   before sharing it with anyone.

## 4. Things the first users should test

- Real gym use over a week: speed of logging, one-handed use, the rest timer between sets
- Whether "last time" and progression suggestions are right for their own lifts
- Custom exercises for anything missing from the library
- Using two devices (phone and laptop)
- Patchy signal at the gym
- Whether Progress tells them something they did not already know
- Dark and light themes outdoors and indoors
- What they would expect Pro to include, and whether the free plan feels complete

## 5. Bugs that would block launch

None known in the code. The full audit found 12 bugs and the polish pass found 7 more; all are
fixed and covered by tests.

These setup items would block launch until done:

1. A real Supabase project with the migrations applied (the app has only run against the local
   stand-in so far).
2. Email: the built-in sender allows 2 emails an hour, so sign-ups or resets could stall.
3. A real-phone pass through section 3, especially Safari on iPhone, which was not available in
   this environment.

## 6. Non-blocking improvements for later

- A short guided first run (pick a goal, pick a routine) if testers hesitate on an empty Home
- In-workout record badge the moment a set beats your best (records show on the summary today)
- Data export (CSV) and account deletion in the app (for now, done in the Supabase dashboard)
- Load the Supabase library only for signed-in people, to cut about 45 KB from the first visit
- Per-field conflict merging (today the newer edit of a whole record wins)
- Plate calculator and warm-up set suggestions
- Reminders on planned training days (needs push notifications)

## Final product review

**What feels strongest.** The workout logger: last time sits next to every set, an empty set
completes with last time's numbers in one tap, decimals type naturally, and it keeps working
offline. Close behind is the honesty of the numbers: every figure traces back to logged sets,
estimates are labelled, comparisons only appear when the history supports them, and the
methodology page explains each one.

**What the final pass improved.** Records now get a short celebration on the summary, pages fade
in, the per-exercise chart shows full names, count axes use whole numbers, the profile is
editable, the status bar follows your theme, old tabs recover by themselves after a deploy, and a
signed-in person is never offered demo data. All animations respect reduced motion.

**Remaining weaknesses.** No guided first run, no in-app data export, and it has not yet run on a
real iPhone or against your real Supabase project. Payments stay closed until you add the details.

**What real users should test first.** A week of real gym sessions on their own phones, with
patchy signal, judged on one question: is logging a set faster than writing it in Notes?

## Verdict

Ready for the first 10 to 15 users once the three setup items in section 5 are done. Run section
3 yourself first, then invite people in small batches (3 or 4, then the rest) so email limits and
any surprises stay manageable. Keep payments closed during the trial week if you like; opening
them later needs no code change.
