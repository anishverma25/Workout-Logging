# CLAUDE.md

Product source of truth: the Master Product Context in the claude.ai Project "workout logger".
Read README.md for setup, architecture and calculation rules.

## Conventions

- Mobile-first. Test 390px wide and 1440px wide, dark and light themes.
- Colors come from tokens in `src/styles/index.css` (`bg-surface`, `text-muted`, `text-accent-text`...).
  Never hardcode hex values in components. `accent` is a fill; use `accent-text` for accent-colored text.
- Typography: Barlow for text, Barlow Condensed (`font-display`) for headings and numbers.
  Add `tabular` to any number that changes.
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
  insights, progression suggestions (also shown in the logger), methodology page.
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
- Next: Phase 9 (full QA audit and report).
