# CLAUDE.md

Product source of truth: the Master Product Context in the claude.ai Project "workout logger".
Read README.md for setup, architecture and calculation rules.

## Conventions

- UI redesign in progress on `ui-premium`: read `docs/UI_REDESIGN_BRIEF.md` and
  `docs/UI_RULES.md` first. New UI uses the kit in `src/components/kit` only.
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
- Only `origin: 'user'` records leave the device. Demo data lives only in the guest database.
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
- E2E runs against `tests/fake-supabase/server.ts` (vite `--mode e2e`, port 5175). The `pwa`
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
  gates on Progress and the logger, Pro page with configurable manual UPI, admin guide in
  `docs/admin-pro-payments.md`, development-only access states.
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
  has Pro (plan `founding`) and is a founding member. Ending it is one SQL update
  (`docs/admin-pro-payments.md`); guest-facing early access copy in `ProPage`, `ProLock` and
  sign-up must change in the same release.
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
- Deployed on Cloudflare Pages from `phase-2-wip`. Each new Supabase migration must be applied
  in the SQL editor before the code that needs it is pushed.
