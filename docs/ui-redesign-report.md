# UI redesign report (Parts 1 to 9)

Branch `ui-premium`, October 2026. Brief: `docs/UI_REDESIGN_BRIEF.md`; standing rules:
`docs/UI_RULES.md`. Nothing here reaches users until `ui-premium` is merged into `phase-2-wip`.

## What changed, by part

| Part         | Summary                                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1            | Inter (Latin subset, self-hosted, 400 and 600 preloaded), dark-only tokens, type scale utilities, the component kit in `src/components/kit`, `docs/UI_RULES.md`.                                                                                    |
| 2            | Global fixes: theme removed (D3, B4), legacy primitives redrawn in the kit style, shell (49px tab bar, 240px sidebar), formatters (`src/lib/format`), D8 copy constants with a test.                                                                |
| 3            | Home (training days strip by week start, D9 and D10), Routines and editor, Workout tab with Completed, View and Repeat (B1).                                                                                                                        |
| 4            | Progress: jump bar, methodology row (D6), sets per muscle on one scale (D4), balance ratios only (D5), adherence insight removed (D7).                                                                                                              |
| 5            | History, More, Journey, Exercises, Settings.                                                                                                                                                                                                        |
| Pro and tour | Pro page rebuilt around the person's own numbers, a Free and Pro table and plain promises; tour with a Pro slide; founding member removed.                                                                                                          |
| 6            | Active workout: header, exercise cards, set rows on the 28/72/flex/48 grid, keyboard toolbar, rest pill, check-in card, finish sheet (B3), fold-up and quiet auto-scroll (B2), steppers with presets and keypad for rest, RIR and bench angle (B5). |
| 7            | Auth and account, summary with records celebration, workout detail, records, body metrics, methodology page, setup, system UI, new version card.                                                                                                    |
| 8            | Charts (lime area, four gridlines, ringed last point, surface-2 tooltip, 6px bars 16px apart), once-per-session draw and count-up (D11), page fade, list stagger, haptics (light, medium, success), skeletons.                                      |
| Billing      | Razorpay subscriptions (monthly, 3 months, yearly) with server-side verification: `docs/razorpay-setup.md`.                                                                                                                                         |
| 9            | Sheet audit, desktop and width pass, token and copy audits, bundle and speed checks, this report.                                                                                                                                                   |

## Part 9 results

1. **Tests.** Typecheck, lint (0 warnings), 455 unit tests (including billing on real Postgres),
   production build with the secret and override check, and the full Playwright run on mobile,
   desktop and the PWA build. New browser tests cover B1, B2, B3, B5, the keyboard toolbar, the
   rest bar (plus, minus, Skip), the Last column ("New", never a dot) and Razorpay checkout.
2. **Widths.** Every route at 360, 390, 430, 820, 1024 and 1440 px: no horizontal overflow
   after fixing the Workout tab list at 360 px. Record names now wrap instead of being cut.
   Remaining ellipses are intentional: exercise lists in workout rows, measurement lists and
   muscle splits, each with the full text available on tap.
3. **Tokens.** No hex colours or px font sizes outside `tokens.css`. Shadows removed from the
   floating New exercise button, the workout dock and the wheel picker. Remaining gradients are
   the chart area fills (specified in Part 8) and the wheel picker's edge mask. No blue, no
   light-theme leftovers.
4. **Copy.** No em dashes, exclamation marks or emoji in the app's strings; sentence case.
5. **Bundle.** First load before (production `phase-2-wip`): 275 KB of JS and CSS, gzipped.
   After: 286 KB, plus 36 KB of preloaded fonts (Inter 400 and 600). Fonts add well under the
   60 KB budget.
6. **Speed.** Ticking a set with a 4x CPU slowdown on the development build: about 0.13 s after
   the first tap (the first tap of a session about 0.7 s, while code warms up). The set
   completion data path is unchanged from the QA fix; the two-year dataset was not regenerated
   for this run.
7. **Sheet audit.** Every sheet, menu and confirm uses the kit: the original `Sheet` and
   `ConfirmSheet` now draw the kit's `BottomSheet` and `ConfirmSheet`, so exercise picker, custom
   exercise, exercise detail, logged set edit, history filters, profile edit, progress pickers,
   settings rest lengths, routine sheets, slot sheet, plate calculator, reorder, start workout,
   set options, finish, rename, notes, rest timer, records, body, measurements, goals, photos,
   account and Pro sheets.
8. **Desktop.** Sidebar 240 px, sheets as centred dialogs from 1024 px, two-column grids on Home
   and Progress, the active workout a single centred column of at most 640 px.

## Not applied, and why

- **Tour coach marks.** The tour stays a swipeable set of slides with sample data, redesigned
  for selling Pro. Coach marks over live screens would need the real screens populated, which
  conflicts with keeping sample data out of the person's own data.
- **Check-in Save with one answer.** The stored check-in needs all three answers; changing that
  is a schema change outside the approved behaviour changes. Save stays disabled until all three
  are answered, with "N more to answer".
- **Guest-data import as a ConfirmSheet.** It stays a card on the Account page, which the
  account tests rely on.
- **Kit SyncStatus everywhere.** The account and summary sync lines copy its look; the kit
  component has no accessible name prop, which the tests and screen readers use.
- **Science page name.** The page title is "How every number is calculated"; the sidebar item
  stays "The science" for length.

## Open questions for the owner

- Merge `ui-premium` into `phase-2-wip` when you are happy with the screenshots. Apply migration
  `20261011000008_razorpay_billing.sql` in the SQL editor before the merged code is deployed.
- Razorpay: follow `docs/razorpay-setup.md` (function deploy, secrets, webhook, plan ids), then
  test a payment in test mode before going live.
- Policy pages (terms, privacy, cancellation and refunds, contact) are needed for Razorpay's live
  activation. They are not in the app yet.
