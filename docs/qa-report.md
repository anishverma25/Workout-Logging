# Pre-launch QA audit

Date: 6 October 2026. Branch `phase-2-wip`.

How it was tested: the real app running in Chromium at 360, 390, 430, 820 and 1440 px wide, in
dark and light themes, against a local stand-in for Supabase that runs the real migrations and
row level security on Postgres (PGlite). Numbers on screen were cross-checked against the raw
IndexedDB records with independent code. Performance was measured on a production build with
two years of training data (538 workouts, 11,000 sets), with and without a 4x CPU slowdown as a
stand-in for a mid-range phone.

## 1. Bugs found

| #   | Severity | Bug                                                                                                                             |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | High     | The "last time" column showed values for sets that did not exist last time (a 4th set today showed set 2's numbers as history). |
| 2   | High     | Logging a set re-read every past set of each exercise. With two years of history a tap took 1 to 2.5 s on a slowed CPU.         |
| 3   | High     | Finishing a workout offline before the service worker had cached the app could fail to open the summary.                        |
| 4   | Medium   | While offline, the sync status said "Syncing" and kept retrying the network instead of saying "Offline".                        |
| 5   | Medium   | The workout summary always said "Saved on this device", even for a signed-in, fully synced account.                             |
| 6   | Medium   | History rendered every workout at once: 4.9 s to open with two years of data on a slowed CPU.                                   |
| 7   | Medium   | The Profile page said editing "arrives with accounts" and there was no way to set a name or goal.                               |
| 8   | Medium   | Light theme: secondary text at 4.49:1 and the demo pill at 3.98:1, below the 4.5:1 minimum.                                     |
| 9   | Low      | No "skip to content" link, so keyboard users tabbed through the whole sidebar on every page.                                    |
| 10  | Low      | Several inline links and the demo pill had touch areas of 17 to 28 px, below 44 px.                                             |
| 11  | Low      | A same-day comparison on the summary read "vs today" instead of "vs earlier today".                                             |
| 12  | Low      | Tests that depended on the calendar day (a Pull day has no load field) or raced a save before reloading.                        |

## 2. Bugs fixed

All 12 are fixed, each reproduced first and retested after the fix:

1. "Last time" now shows only sets that existed. Suggestions for extra sets still use the last
   comparable set, and are labelled as suggestions, not history. Unit tests added.
2. History for "last time" is read once per workout, through indexes, for each exercise's 8 most
   recent sessions. Unchanged exercise cards keep the same objects, so only the edited card
   re-renders. A tap now takes about 0.1 s (0.4 s with the 4x slowdown).
3. The summary screen ships with the workout logger, so the whole log, finish and summary flow
   works offline from the first visit.
4. Sync does not try while the browser is offline and resumes on the `online` event. The status
   reads "Offline. 1 change saved on this device."
5. The summary shows the real sync state with a link to details.
6. History shows 12 weeks at a time with "Show older workouts". 1.2 s on the slowed CPU.
7. Profile editing: name, optional birth date, goal and experience, saved and synced like any
   other record. The demo profile stays read only.
8. Light theme tokens darkened to pass WCAG AA everywhere.
9. Skip link added, focus lands in the main content.
10. A `tap-target` utility enlarges hit areas to 44 px without changing layout.
11. Copy fixed.
12. Tests made date independent and wait for saves to commit.

While splitting the history query (fix 2), a new race appeared: tapping "done" on an empty set in
the first moment after opening a workout, before history loaded, failed with "Enter the weight
first". It was caught by the existing test, and the tap now fetches that exercise's history
before completing the set.

## 3. Security issues

No vulnerabilities were found in this audit. What was tested, with two users:

| Check                                                                                  | Result                                       |
| -------------------------------------------------------------------------------------- | -------------------------------------------- |
| User A reads User B's workouts, sets, routines, body weight, preferences (every table) | 0 rows, at the database                      |
| User A updates or deletes User B's rows                                                | 0 rows affected                              |
| User A upserts a row with User B's id                                                  | Rejected by row level security               |
| User A attaches a child to User B's parent, or uses B's custom exercise                | Rejected by foreign keys and a check trigger |
| User A hands their own row to User B                                                   | Ownership is pinned by trigger               |
| Signed-out visitor reads anything                                                      | Permission denied                            |
| Grant Pro by local storage, session storage, URL parameters                            | No effect (checked in the browser)           |
| Grant Pro through the API with a real session token                                    | Permission denied, plan unchanged            |
| Change the trial length, even as the database owner                                    | Pinned by trigger to exactly 168 hours       |
| Secret keys or development overrides in the production bundle                          | None; the build fails if one appears         |
| Open redirect through `?next=` after sign-in                                           | Only same-app paths are accepted             |
| Private data in the offline cache                                                      | None: only the app's own files are cached    |

Known limitations, not vulnerabilities:

- Pro screens are computed on the device. Someone who edits the app's code in their own browser
  can change what their own screen shows. They cannot change their subscription or see anyone
  else's data.
- Sign-in sessions are kept in local storage (the Supabase default). The strict Content Security
  Policy (scripts only from the app) is the main protection against script injection.
- Conflicts are resolved per record by the newer edit, using device clocks.

## 4. Security issues fixed

None needed fixing in this audit. Earlier phases built in: the CSP-friendly theme script
(no inline scripts allowed), the `?next=` redirect guard, the service role key guard, and the
build check for secrets and development code.

## 5. Tests passed

| Suite                                                                                                         | Result                                 |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| TypeScript (strict)                                                                                           | Pass                                   |
| ESLint                                                                                                        | Pass, 0 warnings                       |
| Unit and integration tests (Vitest), including RLS, sync, subscriptions on real Postgres                      | 325 passed                             |
| Browser tests (Playwright): mobile, desktop and the production build                                          | 104 passed                             |
| Accessibility (axe, WCAG 2.1 A and AA): 15 screens in both themes, the active workout and its sheets          | 0 violations                           |
| Data integrity: Home week totals, every history card, heaviest loads, body-weight average against raw records | Match                                  |
| Full 32-step journey on a new account, mobile and desktop                                                     | Pass                                   |
| Production build                                                                                              | Pass, secret and override check passed |

The 32-step journey: open app, create account, clean Home, explore exercises, create and edit a
routine from a template, start a workout, add an exercise, enter weight and reps, complete sets,
rest timer, pause and resume, finish, summary, second workout showing last time and a record,
history, workout detail, records, body weight, progress with range and exercise filters and
insights, Pro page in trial, expired and Pro states, sign out and in with data restored from the
server, a whole workout logged offline, then synced. Step 3 (onboarding) is not built: a new
account lands on Home with an empty state that explains the first step.

## 6. Remaining issues

| Issue                                                                                        | Impact                                                                                     | Plan                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Not yet run against a real Supabase project                                                  | Sign-up emails, password reset links and the real API are only proven against the stand-in | Follow `docs/deployment.md`, then run the phone checklist below       |
| Supabase's built-in email sends 2 emails an hour                                             | More than 2 sign-ups or resets an hour would stall                                         | Connect free SMTP, or turn off email confirmation for the first group |
| Payment details are not configured                                                           | The Pro page says payments are not open yet                                                | Set the four `VITE_UPI_*` / `VITE_PRO_*` values when ready            |
| Tested in Chromium only                                                                      | Safari on iPhone may differ (storage eviction, install, date input)                        | Personal phone test below                                             |
| First download about 215 KB gzipped, about 260 KB with accounts on                           | Fine on 4G; slower first open on poor networks                                             | Cached after the first visit                                          |
| No guided onboarding                                                                         | New users see a clear empty Home but no walkthrough                                        | Watch the first users; add only if they get stuck                     |
| No data export or account deletion in the app                                                | Users must ask you                                                                         | Can be done in the Supabase dashboard for now                         |
| One desktop journey run timed out once under parallel load and did not reproduce in 3 reruns | Test flake, not seen in use                                                                | Watch CI                                                              |

## 7. Manual tests to do on your phone

1. Open the deployed address in Chrome (Android) or Safari (iPhone). Install it to the home
   screen and open it from there.
2. Create an account with a real email. Confirm the email if confirmation is on.
3. Pick a routine template, start a workout, log 3 sets with decimals (for example 82.5 kg).
   Check the number keyboard, that nothing jumps while typing, and that the rest timer starts.
4. Lock the phone for a minute mid-workout, unlock: the workout and timer are still there.
5. Turn on flight mode, log 2 more sets and finish. The summary should say saved on this device,
   not synced. Turn flight mode off: it should switch to "Synced to your account".
6. Sign in on a second device (a laptop): the workout should be there.
7. Request a password reset and follow the link from the email.
8. In Supabase, grant yourself Pro with the query in `docs/admin-pro-payments.md`; reopen the
   app and check the Pro page.
9. Switch Settings to lb and back. Logged numbers must not change.

## 8. Ready for the first 10 to 15 users?

Yes, once four setup steps are done: a real Supabase project with the migrations applied, email
handled (SMTP or confirmation off), the Cloudflare Pages deployment, and your own pass through the
phone checklist above. The core promise holds in testing: logging is fast and works offline,
nothing is lost or duplicated, numbers match the records, accounts are isolated at the database,
and the app never claims a backup it does not have. Payments can stay closed during the trial
week and be opened later without a code change.
