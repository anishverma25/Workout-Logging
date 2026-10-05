# Overload

A fast, mobile-first workout logger with transparent, deterministic training analytics.
The product brief lives in the Master Product Context (claude.ai Project "workout logger").
`Overload` is a working name, set in one place: `src/app/navigation.ts`.

## First-time setup

Dependencies are added with `pnpm add` (no versions pinned by hand, so you get current releases):

```bash
pnpm add react react-dom react-router dexie zod lucide-react clsx \
  @fontsource/barlow @fontsource/barlow-condensed
pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node \
  tailwindcss @tailwindcss/vite \
  vitest fake-indexeddb @playwright/test \
  eslint @eslint/js typescript-eslint globals eslint-plugin-react-hooks eslint-plugin-react-refresh \
  prettier
pnpm exec playwright install chromium
```

After that, `pnpm install` is enough (the lockfile pins everything). TypeScript is pinned to
`~6.0` because typescript-eslint does not support 7.x yet.

If Playwright cannot download its browser (some sandboxes block it), point it at a local Chromium:
`PW_CHROMIUM_PATH=/path/to/chrome pnpm test:e2e`.

## Scripts

| Command          | What it does                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `pnpm dev`       | Dev server on http://localhost:5173. Demo data loads on first run. |
| `pnpm typecheck` | TypeScript, strict                                                 |
| `pnpm lint`      | ESLint                                                             |
| `pnpm test`      | Unit tests (Vitest)                                                |
| `pnpm test:e2e`  | Browser tests on mobile and desktop, with a local fake Supabase    |
| `pnpm build`     | Production build into `dist/`, then checks it for secrets          |
| `pnpm check`     | typecheck, lint, test and build in one go                          |

## Architecture

```
UI (features/*, components/ui)
  -> hooks (data/hooks.ts: live queries that re-run when data changes)
    -> domain (pure TypeScript: models, analytics) <- unit tested, no React
    -> repositories (data/repositories)
      -> write path (data/repositories/write.ts: stamps updatedAt, soft deletes, queues outbox)
        -> Dexie / IndexedDB (data/db.ts)  <- source of truth on the device
          -> sync engine (data/sync) -> Supabase (Postgres + row level security)
```

- **Local-first.** Everything is saved to IndexedDB first. Every record has a client-generated UUID,
  `createdAt` / `updatedAt` / `deletedAt` (soft delete) and an `origin` (`system`, `demo`, `user`),
  and sync never needs to reshape data.
- **History is immutable.** Workouts snapshot the exercise name and routine targets when logged.
  Editing a routine or renaming an exercise never rewrites past workouts.
- **Analytics are derived, never stored.** Volume, e1RM, PRs, adherence and insights are pure
  functions over the logged sets (`src/domain/analytics`). Editing a past set recomputes them.
- **Weights are stored in kg** at full precision. lb is display-only.

### Calculation rules (summary)

| Metric               | Rule                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Volume load          | Sum of load x reps over completed, non-warm-up sets of load-tracked exercises. Per-hand dumbbell moves count both hands. Bodyweight moves are excluded. |
| Estimated 1RM        | Epley, `weight x (1 + reps / 30)`, compound lifts only, sets of 12 reps or fewer. 1 rep = the load. Always labelled an estimate.                        |
| Personal records     | Heaviest load, best e1RM, most reps (bodyweight), longest time or distance. The first session is a baseline, not a record.                              |
| Adherence            | Completed planned sessions / planned sessions, over days that have passed. Hidden when nothing was planned.                                             |
| Body weight          | 7-day average needs 3 or more entries in the window.                                                                                                    |
| "Below best" insight | Compound lifts only, at least 4% under the best e1RM, and never when the load just went up.                                                             |

## Accounts and sync

The app works fully without an account. Accounts (Supabase) add backup and multi-device sync.
Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` the build runs on-device only and the
account pages say so.

**Data spaces.** Each account gets its own local database (`overload-user-<id>`). The guest
database (`overload`) holds device-only use and demo data. Demo data is never loaded into an
account and never synced. After sign-in, data logged as a guest is offered for import; it is
copied only if the person chooses, and the device copy is left untouched.

**Sync** (`src/data/sync`):

```
user action -> local database -> outbox (same transaction) -> push -> server confirms -> outbox entry removed
```

- Push upserts by client UUID, parents first, so retries never duplicate rows.
- An outbox entry is removed only after the server confirmed it, and only if the record was not
  edited again meanwhile.
- Pull reads each table's changes since a `(server_updated_at, id)` cursor, with a small overlap.
- Conflicts: newer `updatedAt` wins, enforced on both sides (a `keep_newer` trigger on the
  server ignores stale updates). Deletes are soft, so they sync like edits. Timestamps come from
  device clocks, so a device with a badly wrong clock can win or lose a conflict it should not.
- Network errors retry with backoff (5 s doubling to 5 min) and on `online` / tab focus. A
  change the server rejects (constraint or permission) is set aside after 5 tries, reported in
  Account, and kept on the device until "Try failed changes again".
- The UI says "Synced to your account" only when the outbox is empty and the server confirmed.
  Until then it says "Saved on this device".
- Signing out deletes the account's local copy only when nothing is waiting to sync.

**Security.** Every user table has row level security (`user_id = auth.uid()`) for select,
insert, update and delete; children reference parents through `(user_id, parent_id)` foreign
keys, and exercise references must be a built-in exercise or the user's own. The browser only
ever has the public anon key; the app refuses to enable accounts if given a service role key.
`src/data/sync/rls.test.ts` proves User A cannot read, modify or delete User B rows, in every
table, against real Postgres (PGlite) running the migrations.

### Trial and Pro

- Every account gets exactly 168 hours of Pro, starting when the database creates the account.
  The `subscriptions` row is created by a trigger; users can never write to it.
- Access is decided in one place, `resolveEntitlement` in `src/domain/entitlement`, from the
  server's record and the server's clock (`get_my_subscription`). Local storage, URL
  parameters and the device clock change nothing. Gates call `useFeature(...)`.
- Pro adds 90-day and all-time trends, sets per muscle group and progression suggestions.
  Logging, routines, history, records, body weight, 7 and 30 day progress, insights and sync
  stay free forever. History is never locked.
- Payment is manual UPI. The UPI ID, payee name, price and period come from `VITE_UPI_ID`,
  `VITE_UPI_PAYEE_NAME`, `VITE_PRO_PRICE_INR` and `VITE_PRO_PERIOD_DAYS`; without them the app
  says payments are not open yet. The app only ever asks for the transaction reference.
- Pro is granted by an administrator in the Supabase SQL editor: see
  `docs/admin-pro-payments.md`.
- Development builds have a Settings > Developer menu to preview trial and Pro states. It is
  removed from production builds, and `scripts/verify-build.mjs` fails the build if it is not.
- Limits, stated plainly: Pro views are computed on the device, so someone who edits the app's
  code in their own browser can change what their own screen shows. They cannot change their
  subscription, see anyone else's data, or affect any other user.

### Setting up Supabase (free tier)

1. Create a project at supabase.com.
2. Apply the migrations in `supabase/migrations` in file-name order, either with the Supabase CLI
   (`supabase link` then `supabase db push`) or by pasting each file into the SQL editor.
3. Authentication > Providers: keep Email enabled. Choose whether to require email confirmation;
   the app handles both.
4. Authentication > URL configuration: set the Site URL to your app's address and add
   `<site>/account` and `<site>/reset-password` to the redirect URLs.
5. Optional, for Pro payments: set the four `VITE_UPI_*` / `VITE_PRO_*` variables above.
6. Project settings > API: copy the project URL and the **anon / publishable** key into
   `.env.local` (never the service role or secret key):

   ```bash
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

The exercise library migration is generated from `src/data/library/exercises.ts`. If the library
changes, run `UPDATE_SEED=1 pnpm vitest run seed` and add a new migration with the changes.

### Testing accounts locally

`pnpm test:e2e` starts `tests/fake-supabase/server.ts`: a local stand-in for Supabase Auth and
PostgREST, backed by PGlite running the real migrations. The dev server runs in `--mode e2e`
(`.env.e2e`, a fake local URL and key, not secrets). Emails containing `+confirm` behave like a
project that requires email confirmation.

## Offline, install and deployment

- Installable PWA: `public/manifest.webmanifest`, icons in `public/icons` (regenerate with
  `node scripts/generate-icons.mjs`).
- The service worker (`build/sw-template.js`, generated by `build/pwa.ts` at build time)
  precaches exactly the built files, so every screen opens offline. It handles only the app's
  own static files: requests to Supabase are never cached, and private data lives only in the
  per-account IndexedDB database.
- Updates never take over by themselves. The app shows "A new version of the app is ready" and
  reloads when the person chooses.
- The build writes `dist/_headers` for Cloudflare Pages: a strict Content Security Policy
  (scripts only from the app, API calls only to the configured Supabase), `nosniff`, no
  framing, HSTS, and long caching only for hashed assets. `vite preview` sends the same
  headers, and the `pwa` Playwright project checks the production build under them.
- Step-by-step hosting, environments, email limits and releases: `docs/deployment.md`.

## Demo data

`src/data/demo` generates one coherent fictional dataset (Arjun Mehta, 20, 67 kg, Push Pull Legs)
that every screen reads through the same tables:

- 5 weeks of history ending yesterday. The last 7 days are the featured week.
- Double progression with stalls, good and bad days, warm-up, working, back-off and drop sets,
  RIR on every working set, one missed session, a bench press e1RM record, a below-best squat day,
  and morning body-weight entries.
- Deterministic: the same calendar day always produces the same data.
- `loadDemoData`, `resetDemoData` and `clearDemoData` in `src/data/demo/service.ts`; buttons in
  Settings. Demo records are tagged `origin: 'demo'`; clearing never touches real data.
- Auto-loads on first run in development (and when `VITE_DEMO_AUTOLOAD=true`). Clearing is remembered.
- Lives only in the guest database. Accounts always start without it.

## Status

Phases 1 to 10 are in place: foundation, exercise library, routine builder, workout logger,
history, records, body metrics, progress analytics, accounts and sync, trial and Pro, offline
PWA and deployment setup, QA audit and launch preparation. See `docs/qa-report.md` and
`docs/launch-readiness.md`. See `CLAUDE.md`.
