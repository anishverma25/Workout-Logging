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

## Status

- Phase 1 done: tooling, tokens, UI primitives, shell (bottom nav and sidebar), Home dashboard,
  data layer, analytics core, demo data engine, Settings (theme, units, storage, demo data),
  read-only Routines and History.
- Phase 1 verification was done in a session without npm access, using a temporary esbuild preview.
  First run in a normal environment: install dependencies (README), then `pnpm check` and
  `pnpm test:e2e`, and visually confirm Barlow fonts load.
- Next: Phase 2 (exercise library, custom exercises, routine builder).
