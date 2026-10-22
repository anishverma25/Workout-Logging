# CLAUDE.md

Product source of truth: the Master Product Context in the claude.ai Project "workout logger".
Read README.md for setup, architecture and calculation rules.

## Conventions

- UI redesign in progress on `ui-premium`: read `docs/UI_REDESIGN_BRIEF.md` and
  `docs/UI_RULES.md` first. New UI uses the kit in `src/components/kit` only.
  Parts 1 to 9 are done (`docs/ui-redesign-report.md`); the owner merges into `phase-2-wip`. Pickers (`RestPicker`,
  `AnglePicker`, `RirPicker`) and haptics (`src/lib/haptics.ts`) replace the old wheels.
- Mobile-first. Test 390px wide and 1440px wide. Dark only (decision D3).
- Colors come from `src/styles/tokens.css` (`bg-surface`, `text-text-2`, `bg-lime`...). Never
  hardcode hex values in components. Legacy tokens (`text-muted`, `accent-text`...) stay only
  until each screen moves to the kit.
- Typography: self-hosted Inter (Latin subset, `public/fonts`), Inter Display for Display and
  Stat. Use the `type-*` utilities. Add `tabular` to any number that changes.
- Layout: Apple-style grouped lists (`components/ui/List.tsx`), large-title `PageHeader`, rings
  (`components/ui/Rings.tsx`). Tile and ring colours come from `--tile-*` and `--ring-*` tokens.
- Copy: sentence case, plain verbs, no ALL-CAPS labels, no em dashes, no emoji as icons.
- Components never touch Dexie directly. Read through `src/data/hooks.ts`, write through repositories.
- Analytics are pure functions in `src/domain/analytics` with unit tests. No AI for numbers.
- Never show invented numbers. Placeholders say what is coming (`PlannedFeature`).
- Schema changes: add a new Dexie version with a migration; never edit version 1.
- Every new record: client UUID, timestamps, `deletedAt`, `origin`.

## Writing data

- All domain writes go through `src/data/repositories/write.ts` (`putRecords`, `patchRecord`,
  `softDelete`). It stamps `updatedAt`, soft deletes, and queues the outbox for sync in the same
  transaction. Repositories that use it must include `db.outbox` in their transaction tables.
- The sync engine (`src/data/sync/engine.ts`) is the one exception: it writes records pulled
  from the server directly, because they must not be queued to go back.
- Only `origin: 'user'` records leave the device. Demo data exists only in development and e2e
  builds (Settings can load it there, `loadDemoData(..., { intoAccount })`); production accounts
  never get it.
- Server schema changes: add a new file in `supabase/migrations` (never edit an applied one),
  keep RLS on every user table, and extend `src/data/sync/rls.test.ts`.
- Never say data is backed up or synced unless the outbox is empty and the server confirmed
  (`describeSync` in `src/data/sync/describe.ts`).
- Pro gates go through `useFeature` / `hasFeature` only (`src/domain/entitlement`). Never read
  plan data anywhere else, never gate history, and never trust client state for access.
- Development-only code must sit behind `import.meta.env.DEV`; `pnpm build` verifies it is gone.
- Workouts snapshot exercise names and routine targets. Routine code never touches workout tables.
- Sheets: form state lives in a component mounted only while the sheet is open
  (`return open ? <Form/> : null`), so it starts fresh without reset effects.

## Testing

- `pnpm check` (typecheck, lint, unit tests, build) and `pnpm test:e2e` (mobile and desktop).
- RLS and sync tests run real Postgres (PGlite) with the migrations: `src/test/server.ts`.
- E2E runs against `tests/fake-supabase/server.ts` (vite `--mode e2e`, port 5175), which starts
  with early access ended (the launch state). Every test creates its own account through
  `tests/e2e/session.ts` (`signUpFresh`, `startWithDemo`, `expireTrial`). The `pwa`
  project tests the production build via `vite preview` on port 4175.
- The service worker must never cache cross-origin or API responses.
- Full e2e takes about 10 minutes; in a sandbox with a 10 minute command limit, run it in the
  background and poll the log.
- In a sandbox that cannot download Playwright's browser, point `PW_CHROMIUM_PATH` at a local
  Chromium, for example `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Status

- Phase 1: tooling, tokens, primitives, shell, Home, data layer, analytics core, demo data.
- Phase 2: exercise library (91, with instructions), search and filters, custom exercises,
  routine builder with 7 templates.
- Phase 3: workout logger (sets, previous performance, suggestions, rest timer, pause, finish,
  discard, persistence) and the workout summary.
- Phase 4: history timeline with filters, workout detail with set correction and delete,
  records page (actual vs estimated, reps at each load), body metrics with trend chart.
- Charts: own SVG kit in `src/components/charts` (no library). Colours `--chart-1`, `--chart-2`
  are validated for contrast and colour-vision separation; use them for marks.
- Phase 5: Progress page from one engine (`domain/analytics/progress.ts`): strength (e1RM,
  top load, reps, relative strength), volume, muscle sets, consistency, body weight, records,
  insights, progression suggestions (also shown in the logger).
- Rules worth remembering: e1RM only for compound lifts; period comparisons only when history
  covers the whole previous period; partial periods are labelled.
- Phase 6: Supabase schema with RLS, local-first sync (outbox, push, pull, conflicts, retry),
  auth (sign up, sign in, sign out, reset), per-account local databases, guest data import.
- Phase 7: 168-hour server trial, `subscriptions` table with RPCs, central entitlement, Pro
  gates on Progress and the logger, admin guide in `docs/admin-pro-payments.md`,
  development-only access states. Manual UPI was removed (October 2026).
- Billing (migration 0008): Razorpay subscriptions. Plans and prices in `billing_plans`; logic in
  `supabase/functions/_shared/billing.ts`, shared by the `billing` Edge Function and the fake
  Supabase; only `billing_*` functions (service role) grant Pro, after a signature check. App side
  `src/app/billing.ts` and `features/pro/Plans.tsx`. Setup and going live: `docs/razorpay-setup.md`.
- Phase 8: PWA (manifest, icons, service worker precaching the build, update prompt, install),
  offline notice, route code splitting, security headers and CSP, Cloudflare Pages and Supabase
  deployment guide (`docs/deployment.md`), CI with e2e.
- Phase 9: QA audit (`docs/qa-report.md`): journey, integrity and accessibility e2e suites,
  performance on two years of data, profile editing, fixes listed in the report.
- Phase 10: polish (record celebration, page fade, whole-number chart axes, readable bar labels,
  theme-coloured status bar, stale-tab auto reload, account-safe empty states) and
  `docs/launch-readiness.md` (checklist, first-user testing, verdict).
- Phases 11 to 18: setup (`/setup`) and profile (sex, height, days, session length, equipment,
  activity), body science (`domain/analytics/body.ts`), measurements and goals tables (Dexie v3,
  migration `20261007000004_personal_training.sql`), personalised programmes
  (`data/library/programs.ts`), strength levels, plateaus and balance (`standards.ts`), weekly
  rings and check-in, journey page (goals, milestones, phone-only photos, recaps), gym tools
  (plates, warm-ups, supersets, swaps, readiness, session effort, wake lock), CSV and calendar
  export, account deletion, the premium redesign, and the preview tour (`/welcome`, sample data
  in memory only, shown once on a new install and after sign-up).
- Schedules plan nothing before the routine's `createdAt`, so a new routine has no missed days.
- Early access (migration 0005): `app_settings.early_access_ended_at` null means every account
  has Pro (plan `founding`, shown simply as "Pro is active"). Ending it is one SQL update
  (`docs/admin-pro-payments.md`). No founding member or early access copy remains in the app; the
  Pro page sells with a 7-day trial, a Free and Pro table and the person's own counts.
- Feedback (migration 0006): `submit_feedback` / `get_my_feedback` RPCs only, 10 a day, ids
  made on the phone so offline feedback is sent once (`src/app/feedback.ts`). Page `/feedback`,
  one-time prompt on the 3rd workout summary, links from Pro and the error screen. Reading and
  replying is SQL in `docs/admin-feedback.md` (tested in `feedback.test.ts`); no admin pages.
- Routine days: swipe left or long press (`SwipeRow`) to delete, with undo in the toast.
  Session length uses `WheelPicker`. Search understands gym words (`SYNONYMS` in search.ts).
- Evidence batch (migration 0007, Dexie unchanged, nullish fields): every number follows the
  Evidence Corner (Project doc `claude/evidence-corner.md`): Epley e1RM capped at 10 reps, hard
  sets at RIR 4 or closer, 7-day mean weight trend, pace verdict only for fat loss, 5% insight
  threshold, size-adjusted strength. The science page `/science` (`features/science/topics.tsx`)
  typesets formulas with KaTeX (`components/ui/Tex.tsx`) and cites `citations.ts`; Progress
  sections link to it with `EvidenceLink`. Change a rule and its topic in the same commit.
- Muscle shares per exercise (`data/library/muscleShares.ts`, `shares.ts`) show in the
  exercise sheet, list rows and the logger; they must sum to 100 in steps of 5 and cite sources.
- Bench angle (`angleDeg`) on routine and workout exercises; rest to the second
  (`DurationPicker`); `exerciseChangeRestSeconds` rest between exercises; long press and drag
  reorder (`useDragReorder`) in routines and the workout (`ReorderSheet`). Weight on dumbbell
  moves is per dumbbell; volume counts both. Non-beginners build their own routine in setup.
- Accounts are required (October 2026): `RequireAccount` gates every screen except `/welcome`,
  the sign-in screens and the policies. A first visit opens the public home page at `/` (the
  tour anywhere else), which leads to the tour, which ends in create
  account or sign in; a new account goes to setup. Pay once (migration 0009) sits next to
  subscriptions. Paying members get a membership view (`features/pro/ProMember.tsx`); free
  members get at most four spaced Pro reminders on Home, each from their own numbers
  (`domain/entitlement/nudge.ts`).
- Import from Hevy and Strong (`/import`, offered after sign-up and in More, Settings and the
  empty Home): pure readers in `domain/import` (CSV, dates, formats, exercise matching that only
  matches the same movement on the same equipment), saved by `data/repositories/importer.ts`
  through `putRecords` with ids from `stableId(account, source, workout)`, so importing twice
  adds nothing. Strong files do not say kg or lb; the person chooses. The routine they followed
  is rebuilt from the last six weeks (`domain/import/routine.ts`: each workout title is a day,
  exercises and sets from its latest session, weekdays from when they trained it), created
  active unless they already have one, described "Imported from Hevy", with imported workouts
  linked to their days; setup then skips its own routine step.
- Charts on a time axis pick labels by pixel distance (`pickAxisLabels`), add the year when the
  data is not all from this year (`dateAxisLabels`), and draw gaps over 4 weeks as a faint
  dashed line, never a trend (`splitAtGaps`). Callers pass no `formatX` for dates.
- Stalled lifts (`domain/analytics/stalls.ts`, science topic `stalls`): progress is a set that
  beats every earlier set on weight or reps (sets within 80% of the top weight), and each stall
  gets one cause in order: break, frequency, effort, volume, same load, then rep range, lighter
  week, named variation (`VARIATIONS`). Copy in `features/progress/stallCopy.ts`.
- Rest (`domain/analytics/rest.ts`, topic `rest-analysis`): measured from `completedAt` gaps less
  3 s a rep (or the logged duration), only 10 s to 15 min. Shown before each set in the logger
  and history, `RestCard` on the summary and detail, and a Progress section comparing rest
  with the evidence and with the reps the person keeps after each band of rest.
- Nutrition targets (migration 0010, `profiles.calorie_target`, `protein_target_g`): set on Body
  (`TargetsCard`), checked by `domain/analytics/targets.ts` (7,700 kcal per kg, goal rate range,
  real maintenance from the weight trend, protein per kg, lifts in a deficit), topic `targets`.
- Setup recommends for every level by days (`RECOMMENDED_TEMPLATES`): 6 upper/lower three times
  each, 5 upper/lower plus push/pull/legs, 4 full body every other day, 3 or fewer full body;
  every muscle group at least twice a week (tested). Beginners get the recommendation only;
  others choose it or build their own.
- Import also reads .xlsx (`domain/import/spreadsheet.ts`, fflate), UTF-16 and tab files, and
  dates Excel rewrote (`dateOrder` picks day or month first); old .xls asks for .xlsx or CSV.
- Three-dot menus are `ActionMenu` (`components/kit/menu.tsx`): a dropdown anchored to its
  button (fade and scale, portal, no <dialog>, no scroll lock), placed above the tab bar
  (`data-bottom-bar`), hints only on disabled items. `BottomSheet` (and every sheet built on
  it) is a centred panel on all widths that fades and scales in, with no slide-up or drag:
  iOS placed bottom-anchored dialogs partly off screen. While any sheet is open the page behind
  is held still (body fixed in place, scroll restored on close); `tall` sheets keep one height.
- A past workout starts again from its History page (`startWorkoutFromPast`: same exercises,
  order, set types and targets, linked to its routine day if it still exists), through
  `useStartWorkout({ fromWorkoutId })`. Tapping the current tab scrolls to the top
  (`useTabTap` in AppShell); from a page inside a tab it opens the tab at the top.
- Story cards (`features/share`): 1080 × 1920 canvas drawings (`draw.ts`) of data from
  `domain/share/cards.ts`: New PR, workout receipt, total lifted (vs `COMPARISONS`), streak.
  Content stays inside Instagram's safe area (y 250 to 1650). Fonts Inter Tight and JetBrains
  Mono from @fontsource, loaded only when sharing. `ShareSheet` on the summary and workout
  detail: Web Share with the PNG file only (no text, Instagram drops those), else Save image.
- Medals (October 2026, Hevy rules): PR types per tracking type in `prs.ts` (load, e1rm,
  set_volume, session_volume for weight and reps; reps, session_reps for bodyweight and
  assisted; added load for weighted; duration, distance). Live alerts during a workout
  (`domain/analytics/medals.ts`, `MedalAlert`, device setting `liveRecords`), gold `MedalIcon`
  on sets in history and the summary, set records (heaviest weight per rep count, no medal) on
  the exercise records sheet. Gold and tier colours are tokens (`--gold`, `--tier-*`).
- Badges (`domain/achievements/badges.ts`, page `/badges`, `BadgeMedallion`): workouts,
  streaks, medals, tonnage, plate club, body-weight lifts and habits, each with progress when
  locked; unlocked ones show on the workout summary. Story cards add Medals (all records of a
  workout) and Badge. The release announcement (`app/layout/WhatsNew.tsx`, `RELEASE_ID` in
  `whatsNewStore.ts`) shows once per device; e2e marks it seen through `storageState`. Change
  `RELEASE_ID` and the copy for the next announcement.
- Contact: `features/legal/contact.ts` (team email and Instagram, no personal details).
- Deployed on Cloudflare Pages from `phase-2-wip`. Each new Supabase migration must be applied
  in the SQL editor before the code that needs it is pushed.
- Custom domain `overloadgym.in` (October 2026): steps in `docs/deployment.md`. Share previews
  (Open Graph tags, `public/og-image.png`) and `robots.txt`. The old `overload-gym.pages.dev`
  moves to the new domain only when `VITE_CANONICAL_ORIGIN` is set for the build
  (`src/app/domain.ts`, `MoveToNewHome`), and only once the account's changes are synced.
  Turn it on after Razorpay approves the new domain.
- Search (October 2026): a public home page at `/` for visitors who are not signed in and have
  not finished the tour (static HTML in `index.html` between `landing` markers, shown by an
  inline head script allowed by CSP hash; rule in `src/app/landing.ts`, `<Landing />` in
  `RequireAccount`). Every count and feature on it is tested against the app. Public pages,
  titles, descriptions and canonicals live in `src/app/publicPages.ts`; the build
  (`build/seo.ts`) writes a page per entry, `sitemap.xml` and `_routes.json`. The old address
  also gets a server 301 (`functions/_middleware.ts`) when `VITE_CANONICAL_ORIGIN` is set,
  never for `/sw.js` or files.
- AI coach (Pro, October 2026, `docs/ai-coach.md`): Explain buttons on Progress sections, the
  check-in and targets, and the chat at `/coach`. The phone builds a brief of numbers the app
  already calculated (`features/coach/brief.ts`, no name or email); the `coach` Edge Function
  (`_shared/coach.ts`, shared with the fake Supabase) checks Pro on the server, asks Gemini
  then Groq, and drops answers quoting loads or calories not in the brief. Nothing stored on
  the server; chat kept on the phone 7 days (`app/coach.ts`); consent once per phone. The AI
  explains, it never calculates. Pro feature `ai_coach`. Users never see the provider names
  ("a third-party AI service"). A round button (`CoachLauncher`) opens the coach on every
  screen except `/coach` and the logger. Answers quoting none of the person's numbers are
  treated as generic and the next provider is tried (`isSpecific`).
- Food logging (October 2026, `docs/food-logging.md`): Food tab (`/food`) between Workout and
  Progress, Dexie v4 (`foodLogs`, `customFoods`), migration `20261021000011_food_logging.sql`,
  profile `dietType` and `katoriMl`. Ingredients are USDA SR28 (`data/library/ingredients.ts`,
  generated); dishes are our own recipes (`data/library/foods.ts`), every one tested in
  `domain/nutrition/library.test.ts`. Logs snapshot their numbers. Pro feature `food_insights`.
  The AI coach is shown to users as OverloadGPT (route `/coach`, feature `ai_coach` and the
  `coach` function keep their names).
- Food library (October 2026): pack labels for gym brands (`LABELS`), gym staples first in
  starters and protein help, and a lazy long tail (`moreFoods.ts`: USDA SR28 and Indian
  Nutrient Databank, curated foods rank first). AI food logging (Pro `ai_food`): the `coach`
  function's food mode with web search and checked numbers (`checkFoodItem`); AI foods are
  labelled "From the web" or "Estimated" and saved as the person's own foods when logged. This
  is the only place AI gives numbers. Details in `docs/food-logging.md`.
- Photo food logging (Pro `ai_food`, October 2026): `PhotoFoodLog` resizes on the phone, the
  `coach` function's `food_photo` mode checks Pro and a daily allowance of 15 photos
  (`claim_ai_use`, migration `20261022000012_ai_photo_quota.sql`), Gemini sees the image inline
  and Groq uses `qwen/qwen3.8-27b`; library names win over AI numbers (`aiMatch.ts`). Release
  `2026-10-food-ai` announces the new food logging. More protein powders (33) and cafe,
  dessert and global foods were added and cross-checked (`docs/food-verification.md`).
- Food profile and day analysis (October 2026): tapping a food while logging opens
  `FoodProfile` (nutrients for the portion, macro split, per 100 g, share of the day, then the
  amount); the + adds at the usual portion. A meal's + opens Add food for that meal only.
  Pro `DayAnalysisCard` from `domain/nutrition/dayAnalysis.ts` (energy against target and real
  maintenance, IOM macro ranges, protein per kg and 0.4 g/kg per meal, fibre 14 g per 1,000
  kcal, training-day carbs 4 to 7 g/kg), topic `day-analysis`. OverloadGPT answers use
  `type-answer` / `type-answer-lead`, `ai-surface` and `AiByline`; numbers with units are bold.
- Indian chains, street food and supplements (October 2026): `chain: true` labels (source `chain`,
  "From the chain's published nutrition") for McDonald's, KFC, Domino's, Burger King and Subway
  servings; Indian health drinks, biscuits, chocolates, soft drinks; four pea proteins, casein,
  mass gainers, creatine, BCAA; about 50 street food (incl. nine more chaats), regional, sweet and drink recipes; kiwi,
  lychee, sapota, custard apple, nuts and seeds from USDA (`scripts/usda-ingredients.mjs`).
  Tests in `data/library/indiaFoods.test.ts`; sources and what was left out in
  `docs/food-verification.md`.
- Sheets on newer iPhones (October 2026): the visual viewport is shorter than the window by the
  browser's toolbars, which `BottomSheet` once read as a keyboard and shrank to its header. The
  keyboard only counts while a field has focus and only beyond what was missing when the sheet
  opened (`viewportBaseline`, `isEditing` in `kit/keyboard.ts`); the content area uses an auto
  flex basis, never 0. `tests/e2e/sheets-iphone.spec.ts` fakes a short viewport.
