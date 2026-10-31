# UI v3 report

Branch `ui-v3`, off `phase-2-wip`. The brief is `docs/UI_V3_BRIEF.md` (the whole-app prompt
plus section 13, the owner's additions A1 to A4). No Supabase migration and no Dexie version.

## What changed

- **Foundation.** iOS grouped surfaces with no card borders, the iOS separator, new tokens
  (`--group`, `--elevated`, `--fill`, `--seg-selected`, `--material-bar`, `--up`, `--down`,
  `--tabbar-h`), SF Pro on Apple devices and Inter elsewhere, and the v3 type scale
  (`type-title-1`, `type-subhead`, `type-hero`, `type-metric`, `type-section`). Kit primitives
  `Metric`, `Delta`, `Section`, `Group`, `StatGrid`, `EmptyLine`, `TextButton`, `CapsuleButton`.
- **Chrome.** Five tabs (Home, Workout, Food, Progress, History); Routines lives inside
  Workout and in the desktop sidebar. The tab bar steps aside in the logger and on the summary
  (`hidesTabBar`). Large-title headers with the lime back link.
- **OverloadGPT everywhere (A1).** The floating button is gone. A sparkle button sits in the
  header of every tab, Explain icons stay on cards, and More keeps its row.
- **Home.** Today, This week (rings and the week strip), Today's numbers (food, weight, water,
  activity as rows), highlights, strength trends. Setup prompt as a slim row.
- **Workout, logger, summary.** Featured next day with one lime Start, other days as rows;
  slimmer logger header, check-in as a row; summary hero for volume with the change.
- **Food.** Calories left as the hero, four macros, meals as grouped rows with Usual,
  Yesterday or Last time capsules, Water as one row with quick amounts.
- **Progress.** Five sections (overview, strength, volume, body, food) with a date range
  control; the section stays in the URL.
- **History.** Search by workout or exercise, a Filter sheet, active filter chips. Workout
  detail with Share in the menu, a rest column and records only when there are some.
- **Records, Exercises, Body, Activity, Journey.** Two-line record rows; an A to Z index;
  weight first on Body with the weigh-in under the chart; protein as "107 to 147 g" on one line;
  an empty Activity day says so in a line instead of three zeros; milestones as rows.
- **Pro (A2 to A4).**
  - A Pro row right under the person on More and Profile, with the real "from" price, the
    trial days left during a trial, and Keep Pro / Get Pro.
  - The Pro page leads with the price ("From ₹X a month · cancel any time"), then the plans
    (yearly selected, the monthly-equivalent price crossed out as the anchor, a lime ring on
    the choice), then the account's status, their own numbers, what Pro includes, the Free and
    Pro table, the evidence note and the questions.
  - Home reminders for free members are more frequent: 2 quiet days after the trial, then at
    days 0, 3, 7, 12 and 19, then every 10 days while they stay free. "Not now" buys a week.
    They rotate through real facts only (history length, workouts since the trial, records,
    the monthly price, the yearly saving worked out from real prices, OverloadGPT). No fake
    deadlines, counters or reviews.
- **Release note.** `RELEASE_ID` `2026-10-fresh-look`. `CACHE_EPOCH` `ui-12`.

## Kept on purpose

The exercise note field and muscle share line on logger cards, and the Show as table
disclosures on charts, were earlier explicit owner requests.

## Checks

See the merge confirmation in the session: typecheck, lint, 830+ unit tests, the full e2e on
mobile and desktop, the pwa project on the production build, `pnpm test:update`, and the
device test at iPhone 16 (393 px) and Galaxy (360 px) widths, which now also fails on any two
overlapping buttons or links.
