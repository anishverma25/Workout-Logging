# The Macrotrophy Brain (November 2026)

Plan: Project doc `claude/macrotrophy-brain-plan.md` and the Claude Doc it links to. This file is
how it was built and how to look after it.

## What it is

One brain on the phone, in three steps:

1. **Learn** (`src/domain/brain/response.ts`): the personal response model. Maintenance from the
   person's own intake and weight trend, blended with the body formula by how many complete weeks
   they have logged; and, per muscle, which weekly sets, rep range and rest their lifts answer to.
   A finding is named only when their logs separate the options clearly (`CLEAR_GAP`).
2. **Decide** (`engine.ts`): once a week, the changes for next week: calories, protein, sets per
   muscle, a lighter week, an exercise rotated after a stall. Inputs: what is coming up and what
   hurts (`life.ts`).
3. **Explain**: every change carries its reason and a science topic (`adaptive-plan`). Macrotrophy
   AI gets the plan as lines of its brief (`features/coach/planBrief.ts`) and explains it; it
   never calculates.

The limits are in `limits.ts`. `simulate.test.ts` generates people with a known true body and
checks the brain finds the truth and that no decision for 4,000 random people, plans and weeks
steps outside a limit. Change a limit and the science topic in the same commit.

## Where each part lives

| What the person sees | Code |
| --- | --- |
| Next week, Apply or Keep, in the weekly review | `features/brain/NextWeek.tsx`, `useBrain.ts` |
| Try a different plan | `domain/brain/whatIf.ts`, `features/brain/WhatIfSheet.tsx` |
| Coming up (review and Routines) | `ComingUpSheet.tsx`, `ComingUpRow.tsx` |
| Something hurts (logger exercise menu) | `HurtsSheet.tsx` |
| Programme rewrite | `domain/brain/rewrite.ts`, `data/repositories/plan.ts` (`applyDecision`) |
| Now card | `domain/brain/now.ts`, `features/home/NowCard.tsx` |
| Eat next, Plan my week, Read a menu | `domain/nutrition/solver.ts`, `features/food/EatNextCard.tsx`, `MealPlanPage.tsx`, `MenuSheet.tsx` |
| Voice sets | `domain/workout/voice.ts`, `features/workout/VoiceSets.tsx`, `features/food/speech.ts` (`listenPatiently`) |
| What Macrotrophy AI knows | `features/coach/memory.ts`, `features/settings/MemoryPage.tsx` |
| Wrapped | `domain/share/wrapped.ts`, `features/wrapped` |
| Duels | migration `20261112000023_duels.sql`, `features/groups/DuelsCard.tsx` |

## Data

- One new table, `planItems` (Dexie v6, server `plan_items`, migration
  `20261112000022_plan_items.sql`): events, pain reports, decisions, temporary changes with how
  to put them back, AI memory and meal plans. It syncs like every other log.
- `plan_items` is a **late table** (`TableSpec.late`): if the server does not have it yet, its
  rows wait on the phone and every other table keeps syncing (`lateTables.test.ts`). Run the
  migration before merging anyway.
- A temporary change (exam week, a sore shoulder, a lighter week) saves the exact edits that undo
  it. It goes back only where the person has not since changed that exercise or target themselves.
- Free or Pro: Now card, Eat next, voice sets, Wrapped, duels and logging pain are free. The
  adaptive plan (`adaptive_plan`), meal plans (`meal_plan`), menu photos (`ai_food`) and AI
  memory in answers (`ai_coach`) are Pro.

## Rules that must stay true

- Nothing changes without a yes: `applyDecision` is only called from an Apply button.
- Calories never under 1,200 kcal or resting energy; at most 150 kcal and 2 sets per muscle a
  week; no deficit and nothing added through a fast, an illness or exams.
- Pain with a red flag (sharp, lasting, swelling, numbness) or marked severe is never trained
  around: a warning to see a professional, and no changes.
- The menu photo's AI returns dish names only (`checkMenu` strips every number); numbers come
  from the library match on the phone.
- There are no prices in the food library, so budget is a class per food, never a rupee figure.

## Deploying

1. Run migrations `20261112000022_plan_items.sql` and `20261112000023_duels.sql` in the Supabase
   SQL editor.
2. Deploy the `coach` Edge Function (new `food_menu` mode, steadier answers, the plan and memory
   rules in the prompt): `supabase functions deploy coach`. Until then the app says "Reading
   menus is being set up" and everything else works.
3. Merge. People see the release walkthrough (`RELEASE_ID` `2026-11-brain`) after reloading.
