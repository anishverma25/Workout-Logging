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

After that, `pnpm install` is enough (the lockfile pins everything).

## Scripts

| Command          | What it does                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `pnpm dev`       | Dev server on http://localhost:5173. Demo data loads on first run. |
| `pnpm typecheck` | TypeScript, strict                                                 |
| `pnpm lint`      | ESLint                                                             |
| `pnpm test`      | Unit tests (Vitest)                                                |
| `pnpm test:e2e`  | Browser tests on mobile and desktop viewports (Playwright)         |
| `pnpm build`     | Production build into `dist/`                                      |
| `pnpm check`     | typecheck, lint, test and build in one go                          |

## Architecture

```
UI (features/*, components/ui)
  -> hooks (data/hooks.ts: live queries that re-run when data changes)
    -> domain (pure TypeScript: models, analytics) <- unit tested, no React
    -> repositories (data/repositories)
      -> Dexie / IndexedDB (data/db.ts)  <- source of truth on the device
        -> cloud sync (Phase 6, not built)
```

- **Local-first.** Everything is saved to IndexedDB first. Every record has a client-generated UUID,
  `createdAt` / `updatedAt` / `deletedAt` (soft delete) and an `origin` (`system`, `demo`, `user`),
  so cloud sync can be added later without reshaping data.
- **History is immutable.** Workouts snapshot the exercise name and routine targets when logged.
  Editing a routine or renaming an exercise never rewrites past workouts.
- **Analytics are derived, never stored.** Volume, e1RM, PRs, adherence and insights are pure
  functions over the logged sets (`src/domain/analytics`). Editing a past set recomputes them.
- **Weights are stored in kg** at full precision. lb is display-only.

### Calculation rules (summary)

| Metric               | Rule                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Volume load          | Sum of load x reps over completed, non-warm-up sets of load-tracked exercises. Per-hand dumbbell moves count both hands. Bodyweight moves are excluded. |
| Estimated 1RM        | Epley, `weight x (1 + reps / 30)`, only for sets of 12 reps or fewer. 1 rep = the load. Always labelled an estimate.                                    |
| Personal records     | Heaviest load, best e1RM, most reps (bodyweight). The first session is a baseline, not a record.                                                        |
| Adherence            | Completed planned sessions / planned sessions, over days that have passed. Hidden when nothing was planned.                                             |
| Body weight          | 7-day average needs 3 or more entries in the window.                                                                                                    |
| "Below best" insight | Compound lifts only, at least 4% under the best e1RM, and never when the load just went up.                                                             |

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

## Status

Phase 1 (foundation, design system, shell, Home, demo data) is in place. See `CLAUDE.md`.
