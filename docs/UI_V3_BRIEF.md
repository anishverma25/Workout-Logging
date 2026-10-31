# Overload UI v3: whole-app refinement prompt

Owner's copy. Strike out (or delete) any numbered item you do not want, then send this file back. Only the items left in will be built. Item ids (G1, B3, H2...) stay fixed so the report can refer to them.

Repository `anishverma25/Workout-Logging`, deployed from `phase-2-wip` to overloadgym.in. This file supersedes the 24 October brief (`claude/ui-v3-brief.md` in the Project), which was never built. Everything below was checked against screenshots of the live code on 29 October 2026 (demo athlete, iPhone 390 × 844).

---

## 0. The job

You are the senior product designer and front-end engineer for Overload, a mobile-first PWA for workout logging, Indian food logging, progress analytics and an AI assistant (OverloadGPT).

Goal: make every screen look like it belongs to one premium, calm, Apple-grade app, and make the two things people do every day (logging a set, logging a meal) faster. Fewer containers, one clear hero per screen, one lime action per screen, explanations behind a tap, nothing floating over content, the same header, list, number and button everywhere.

Owner's priorities, in order: nothing breaks for existing users; accurate numbers; fast logging; premium and minimal; uniform; less scrolling; merge sections instead of adding them; no extra tabs.

---

## 1. Safety rules (non-negotiable, above every item in this file)

1. **Visual and interaction layer only.** No changes to Dexie schema, Supabase tables, migrations, sync, outbox, analytics formulas, records logic, entitlement, billing, the AI functions or the service worker logic. No new migration in this update.
2. **Every route keeps working.** `/routines`, `/routines/:id`, `/history/:id`, `/r#code`, `/coach`, `/activity`, `/records`, `/body` and every other path stay valid, including deep links and links already shared. Moving a screen means moving its entry point, never its URL.
3. **Every number keeps its meaning and source.** "Estimated" and "e1RM" labels stay. No invented data, no zeros pretending to be data.
4. **Never weaken:** offline logging, honest sync status (`describeSync`), previous performance in the logger, one-tap set completion from last time, Copy last time, rest timer, history never locked behind Pro, demo data out of real accounts.
5. **Updates must not need a reinstall.** Follow the CLAUDE.md Testing section: `pnpm check`, full `pnpm test:e2e` (mobile and desktop, `--workers=1` on a 2-core machine), `pnpm test:update` (live version to this one, then to a later one), `devices.spec.ts` (iPhone 16 and Galaxy widths), `sheets-iphone.spec.ts`, `startup.spec.ts`. Bump `CACHE_EPOCH` in `build/pwa.ts` once for the release. Do not touch `build/sw-template.js`, `src/app/pwa.ts`, `index.html` start-up script or `src/main.tsx` unless an item needs it, and if so run `pnpm test:update`.
6. **A real-user smoke test before saying "safe to merge":** an account with a 16-week import and a food log on the live version, update, Reload, open every main page, log a set, finish a workout, log a food, 3 reloads, cold reopen, offline reopen, at Android and iPhone sizes. Report the result.
7. **Tokens and kit only.** No hex colours, px font sizes, radii or shadows outside `src/styles/tokens.css` and the kit.
8. **Copy:** sentence case, plain verbs, numbers over adjectives, no em dashes, no exclamation marks, no emoji, no ALL-CAPS labels. Cut words, never add marketing.
9. **Tests follow the UI, never the other way.** Before changing a screen, read its code and its tests. Update selectors to roles and labels. Never delete a test to make it pass; if a test protects behaviour this file removes on purpose, say so in the report.
10. **If an item conflicts with existing behaviour, existing behaviour wins.** Report the conflict instead of guessing.

---

## 2. Session protocol

1. First session: branch `ui-v3` from `phase-2-wip`. Commit this file as `docs/UI_V3_BRIEF.md` (with the owner's deletions applied) and update `docs/UI_RULES.md` with section 4.
2. Every session: read `docs/UI_V3_BRIEF.md`, `docs/UI_RULES.md`, then `git log ui-v3` to see which parts are done. Never redo a committed part.
3. One part at a time in the order of section 9. Commit `ui-v3: part N`. If a part does not finish, commit `ui-v3: part N (wip)` with what is left in the body.
4. End every part with the Definition of done (section 11), screenshots of the screens it touched at 390 × 844, and a short report. Then stop.
5. One pull request into `phase-2-wip` at the end, after Part 10, with the full report and before and after screenshots. Update the "What's new" announcement (`RELEASE_ID` and copy) for the release.

---

## 3. Design principles (apply to every decision)

1. **One hero per screen.** One number or one action is clearly the most important. Everything else steps down.
2. **Lists, not cards.** Related rows live in one grouped container with hairline separators. A separate card only for a thing that is truly separate.
3. **Two levels of depth, never three.** Page, then group. No card inside a card inside a pill.
4. **Explanations behind a tap.** On the surface: a title, a value, at most one caption line. Method, limits and disclaimers live behind (i) or on the science page.
5. **Colour means something.** Lime: the one primary action, the selected state, progress toward a goal. Green and red: change. Amber: warnings. Everything else: white and greys.
6. **Chrome recedes.** Bars are translucent, titles collapse cleanly, nothing floats over content except one primary action where a screen needs it.
7. **Hide the zeros.** An empty metric becomes one calm line with an action, never a grid of zeros.
8. **Same thing, same look.** A page header, a section, a row, a stat, a primary button and a sheet look and behave identically on every screen.

---

## 4. Design system (replaces conflicting rules in `docs/UI_RULES.md`)

### G1. Colour and surface tokens

Keep the lime (`--lime` #c6f432) and the true black page. Add or remap in `tokens.css`:

| Token                                | Value                                                             | Use                                          |
| ------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------- |
| `--bg`                               | #000000                                                           | Page                                         |
| `--group`                            | #1C1C1E (today's `--surface`)                                     | Grouped containers                           |
| `--elevated`                         | #2C2C2E (today's `--surface-2`)                                   | Sheets, nested tiles, inputs                 |
| `--fill`                             | rgba(118,118,128,0.24)                                            | Capsules, segmented track, secondary buttons |
| `--separator`                        | rgba(84,84,88,0.6) at 0.5 px                                      | Row dividers, inset to the text start        |
| `--text-1` / `--text-2` / `--text-3` | #FFF / rgba(235,235,245,0.6) / rgba(235,235,245,0.3)              | Text levels (three only)                     |
| `--accent-dim`                       | lime at 16%                                                       | Capsule backgrounds for lime states          |
| `--up` / `--down`                    | #30D158 / #FF453A                                                 | Positive / negative change                   |
| `--material-bar`                     | rgba(22,22,24,0.8) + `backdrop-filter: saturate(180%) blur(20px)` | Tab bar, collapsed header                    |

- No 1 px borders on groups or tiles anywhere. Separation by fill only.
- No shadows except one soft shadow on a floating primary button and on sheets.
- Lime only for: (1) the one primary button of the screen, (2) selected or active state (active tab, switch on, selected option outline, today marker, done set check), (3) progress toward a goal (rings, goal bars, a bar that meets its target). Not for every chart bar, icon, link or chip.

### G2. Typography

```css
--font-text: -apple-system, BlinkMacSystemFont, 'Inter', 'Inter Fallback', system-ui, sans-serif;
--font-heading:
  -apple-system, BlinkMacSystemFont, 'Inter Display', 'Inter', 'Inter Fallback', system-ui,
  sans-serif;
--font-metric:
  ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, 'Inter Display', 'Inter',
  system-ui, sans-serif;
```

iPhone and Mac get SF Pro and SF Pro Rounded; Android and Windows keep self-hosted Inter exactly as today (never put `system-ui` before Inter, or Android gets Roboto). Keep the Inter preload. Story cards keep their own fonts.

| Style       | Size / line | Weight | Use                                           |
| ----------- | ----------- | ------ | --------------------------------------------- |
| large-title | 34 / 41     | 700    | Page title                                    |
| title-1     | 28 / 34     | 700    | Summary title ("Push done")                   |
| title-2     | 22 / 28     | 700    | Section header outside a group                |
| headline    | 17 / 22     | 600    | Row title, button label                       |
| body        | 17 / 22     | 400    | Default text                                  |
| subheadline | 15 / 20     | 400    | Row subtitle                                  |
| footnote    | 13 / 18     | 400    | Captions, group footers, labels above numbers |
| caption     | 12 / 16     | 500    | Chart axes, tab labels                        |

Weights 400, 600, 700 only. Inter tracking: -0.022em at 28 px and above, -0.01em at 17 to 22 px, 0 below (only when Inter renders). `text-wrap: balance` on titles.

### G3. The number system (`Metric` kit component)

One component for every displayed figure. Props: `value`, `unit`, `label`, `tier`, `delta`, `estimate`.

| Tier      | Size     | Weight     | Use                                                           |
| --------- | -------- | ---------- | ------------------------------------------------------------- |
| hero      | 56 to 60 | 700 metric | One per screen: calories left, workout volume, current weight |
| primary   | 34       | 600 metric | Stat tiles                                                    |
| secondary | 20       | 600 metric | Trailing values in rows                                       |
| inline    | 17       | 600 text   | Numbers inside sentences                                      |

- Tabular numbers everywhere. Unit at 45% of the number size (min 13 px), weight 500, `--text-2`, baseline aligned, never on its own line (`nowrap` on value plus unit).
- Change as a capsule: arrow plus signed value, 12 / 16 600, `--up` or `--down` text on that colour at 16%. Flat: `--text-2` on `--fill`.
- Estimates: no "~" prefix; the word "Estimate" as a caption.
- Durations through the formatter: "8 min", "55 min", "1 h 13 min". Never "<1 min" (show "Under a minute" as text) and never a lone "1" with a tiny "h".
- One number format: full digits with separators below 100,000 ("41,208 kg"), compact only from 100,000 ("173.9k kg"). Add to `src/lib/format` with tests.
- Ranges as "107 to 147 g", rounded per the formatter, never wrapping.
- Zero or unavailable values do not render as a tile (G10).
- Count-up only on the hero, once per screen visit, 400 ms; reduced motion shows the final value.

### G4. Shape and spacing

- 8 pt grid: 4, 8, 12, 16, 20, 24, 32, 40.
- Page margin 16 (20 from 428 px wide). Group inner padding 16. Row vertical padding 12, row min height 44 (one line) and 60 (two lines).
- 32 between sections, 8 between a section header and its group, 0 between rows (separators only).
- Radii: group 22, nested tile 14, button 14, input 12, capsule and chip 999, sheet 22.
- Bottom padding of every page: tab bar height plus safe area plus 24, plus the dock or floating button when one is on screen. Nothing is ever hidden under a bar.
- Press state on every tappable surface: scale 0.97 plus a 6% white overlay, 120 ms.

### G5. Kit primitives (add to `src/components/kit`, then use everywhere)

- **PageHeader v3** (one pattern on every page, as in iOS): a 44 px top row with the back button "< Parent" (pushed pages) or the date (Home) on the left and at most three 36 px circular buttons on the right (tab roots: one action icon, OverloadGPT where listed, the avatar; pushed pages: one action or a "..." menu). The large title sits on its own line under that row, so long titles ("Good evening, Arjun", "Personal records") never wrap beside the buttons. Optional one-line subtitle in footnote only when it adds information (never a slogan).
- **Section**: title-2 sentence-case header, optional trailing text button ("See all", "Edit") in lime 17 regular, optional (i) and Explain icons, then the content, then an optional footnote footer. Replaces every uppercase label ("UNITS", "REST", "TRAINING", "FOOD SETTINGS", "LAST 7 DAYS").
- **Group**: `--group`, radius 22, rows inside with inset separators.
- **Row**: optional leading icon tile (30 × 30, radius 8, `--fill`, glyph `--text-1`), title, one-line subtitle, trailing value (Metric secondary or `--text-2` body), trailing accessory (chevron, switch, capsule button, segmented control). Text longer than one line moves to the Section footer.
- **StatGrid**: 2 columns, gap 12, tiles `--group` radius 22 padding 16, label above, Metric primary. Max 4 tiles. Zero tiles never render.
- **EmptyLine**: one centred footnote sentence inside the group plus one text button.
- **TextButton**, **CapsuleButton** (32 high, `--fill`, used for row actions like "Start", "Log", "+250 ml").
- **ExplainButton**: 32 px circle, sparkle glyph in `--text-2`, no label.

### G6. Navigation chrome

- **Tab bar**: `--material-bar` with blur and a 0.5 px top hairline, five items (B1). Icons 24 px, active filled lime with a lime label, inactive `--text-2`. Hidden in the logger and on the summary (B3).
- **Large title collapse**: the small centred title stays at opacity 0 until the large title has scrolled under the bar, then fades in over 150 ms as the bar turns to material. No ghost titles.
- **Floating elements**: at most one per screen, and never covering content (B2).
- **Demo state**: one slim banner on Home only ("Demo data · Clear"), plus the existing Settings section (B7).

### G7. Controls

- **Primary button**: lime, 50 high, radius 14, headline label. Exactly one per screen.
- **Secondary button**: `--fill`, 50 high (44 compact). **Destructive**: `--down` text, own group.
- **Segmented control**: `--fill` track radius 9, selected segment `#636366` with white text, 32 high, equal widths. Used for ranges (7D, 30D, 90D, All), Progress sections, meals in Add food, kg / lb, week start, Auto-renew / Pay once, Front / Back.
- **Chips**: only for filters in scrolling rows, 32 high, selected white with black text, 24 px fade at the trailing edge so a cut chip reads as "scroll".
- **Option and plan cards**: `--elevated`, unselected no outline, selected 2 px lime outline plus a lime check circle. Never inverted to a white card.
- **Show as table**: moves into the chart's "..." menu (still reachable for screen readers).

### G8. Charts (Apple Health pattern)

- Header above the plot: footnote label ("Average", "Latest"), Metric primary value, footnote range ("30 Sep to 29 Oct").
- At most 3 horizontal gridlines, y labels on the right in caption, x labels thinned so labels never touch (min 8 px gap). Fixes F2.
- Lines 2 px. Lime for the user's own progress line (e1RM, weight); white for others; previous period `--text-3`.
- Bars white at 85%; lime only for the current period, the selected bar or bars at or above target.
- Horizontal bar lists (By exercise, Sets per muscle, Rest): 6 px bars, white 85% on `--fill`, value trailing.
- Fewer points than the chart needs: EmptyLine with the existing threshold copy, never an empty axis.

### G9. Icons and imagery

- One lucide set at one stroke (1.75 at 24 px, 1.5 at 17 to 20 px). Row icon tiles all `--fill` with a white glyph; the coloured `--tile-*` tones go away except Pro (lime-dim).
- Exercise library: no two-letter tiles ("AB", "HA", "QU"). Rows without a leading tile, alphabetical sticky headers and a side index (S13).
- Badges: earned in full colour, locked in monochrome at 30%, no progress arcs on locked badges, only the number inside the shape.

### G10. Empty and zero states

Any group whose values are all zero or missing collapses to one EmptyLine with one action ("No activity today · Add steps"). Tiles with 0 ("Records 0", "Weights 0 · Cardio 0 · Steps 0") do not render. Progress toward a target is not a zero tile: "0 of 127 g" protein on an empty food day stays, with an empty bar.

### G11. Sheets

All sheets on `BottomSheet` keep today's centred, fade and scale behaviour (it fixed iOS). Uniform header: title left, close (x) right, optional one-line subtitle. One primary button at the bottom, full width. Form state mounts only while open (as today).

### G12. Motion and haptics

Keep today's durations and haptics. Add the press state everywhere (G4), large title collapse tied to scroll, and a 380 ms spring for sheets. `prefers-reduced-motion` makes all of it instant.

---

## 5. Behaviour changes (each needs a test)

- **B1. Five tabs: Home, Workout, Food, Progress, History.** Routines leaves the bar and lives inside Workout: the Workout header gets a "Routines" text button that opens the existing `/routines` list, and the active routine's week strip shows at the top of Workout. `/routines` and all routine links keep working. Desktop sidebar: the same five plus More, Activity and the existing extra links.
- **B2. The floating OverloadGPT button goes.** It covers Start Push, Log, Send feedback, Set targets and other controls today. Entry points instead: a sparkle icon in the headers of Home, Food and Progress, the per-section Explain icons, the More row and the existing in-card Explain buttons. `/coach` unchanged.
- **B3. Tab bar hidden in the active logger and on the workout summary.** The logger keeps Finish; the summary keeps Done. The workout dock still shows on other screens when a workout is open.
- **B4. Check-in leaves the logger body.** The three 1 to 5 questions become a slim row at the top of the logger ("How do you feel today? · Answer"), dismissible, which opens them in a sheet. Answers, storage and rules unchanged. The logger opens at the first exercise, scrolled to the top.
- **B5. Progress becomes a segmented switcher**: Overview, Strength, Volume, Body, Food. Only the chosen segment's modules render. Choice and range remembered for the session. Every module that exists today stays reachable in exactly one segment (mapping table in the report).
- **B6. Home trims to five modules** (S3). Last week moves to History (week header) and Progress Overview; Latest record and Body weight move to Progress Overview and Body. Nothing is deleted from the app.
- **B7. Demo indicator only on Home.** The "Demo data" chip leaves every other page header (it is on almost every screen today).
- **B8. Workout summary: one primary button (Done).** Share becomes a header icon. Calories, rest and refuel collapse into rows.
- **B9. Avatar on every tab root header** (Home, Workout, Food, Progress, History) opens More, so More is one tap from anywhere now that the bar has five items.

---

## 6. Bugs on today's screens (fix the root cause, one test each)

- **F1.** Home, weight tile: the label shows "Log..." because the sparkline squeezes it. Text has priority; the sparkline shrinks or hides below 360 px.
- **F2.** Progress, Reps at the top load: x labels overlap ("17 Oc21 Oct"). Shared axis label thinning (G8).
- **F3.** Body, Protein a day: "107.1 to 147.2 g" wraps over three lines with "g" alone. Round and keep on one line (G3).
- **F4.** Body: "Measurements" title cut to "Measuremen" by the Add measurements button. Title wins; the action becomes a "+" icon.
- **F5.** Body, Your targets header: title wraps to two lines, Explain and pencil crowd it, "Set targets" is cut. One title, one trailing "Edit" text button, Explain as an icon.
- **F6.** Records: the "New" badge sits inline on some rows and on its own line on others; values like "+157.5 kg (+11.1%) over 1,417.5 kg" wrap over three lines (S11).
- **F7.** Exercises: the first "Recently used" row has a grey background that looks stuck pressed.
- **F8.** Floating OverloadGPT button overlaps controls on Home, Food, Progress, History, Records, Exercises, Body, Settings, Profile, Feedback, Account and Pro (B2).
- **F9.** Summary: "<1 min" duration and "~0 kcal"; two lime buttons (Share and Done) (B8, G3).
- **F10.** Logger header: "2 of 17 sets" wraps onto two lines next to "~0 kcal". One line: "0:05 · 2 of 17 sets"; calories leave the header (shown on the summary).
- **F11.** Workout detail: "Records 0" tile and "1 h" with a tiny "h" (G3, G10).
- **F12.** Activity: a 0 / 0 / 0 / 0 grid and two disclaimers on the surface (G10).
- **F13.** Horizontal chip rows cut mid-word with no fade: Progress "Consistenc", Body measurements "Thig" (G7).
- **F14.** "Session effort 7/10, training load 420 (effort × minutes)." floats as loose text under the tiles on workout detail; it becomes a row.

---

## 7. Screen by screen

### S1. Landing page (`/`, signed-out visitors)

1. Keep the headline. Replace the two small cropped phones with one large real screenshot of Home at near full width.
2. Three feature blocks (Logging, Indian food, Progress), each a title-1 headline, one sentence and a large screenshot; then a two-column icon grid for the rest (Routines, Import from Hevy and Strong, 120 exercises, Works offline, Every number explained, OverloadGPT).
3. Free and Pro as one compact two-column comparison of 6 rows; FAQ as an accordion; final call to action without a border. One lime button per viewport.
4. Keep every count tested against the app (`landing.spec.ts`).

### S2. Tour, sign in, sign up, reset, setup, import

1. Tour: body copy at most two lines per slide.
2. Auth: the logo mark above the title, placeholders and `autocomplete` on every field, the "Pro is free for 7 days" card becomes one footnote line under the button. Error messages inline under the field.
3. Setup: one question per screen with option cards per G7 (outline and check, never white), the segmented progress bar kept, one lime Continue at the bottom.
4. Import: source cards per G7, steps as a short numbered list, the result as one group of rows ("48 workouts · 576 sets · 1 routine").

### S3. Home

Top to bottom, fits on one 390 × 844 screen down to the end of "This week":

1. **Header**: footnote date, large-title greeting, sparkle (OverloadGPT) and avatar on the right. Demo banner under it only in demo state.
2. **Setup prompt** (only until setup is done): one slim row, "Make it yours · 7 questions", trailing "Start" capsule and a dismiss. Not a hero card.
3. **Today** (the hero): session name in title-2, one meta line ("6 exercises · 17 sets · about 55 min"), and the lime "Start Push" right there. The exercise list is collapsed to one line ("Bench press, Incline dumbbell press and 4 more") and expands on tap. Rest day: "Rest day", "Next: Pull on Friday", text button "Train anyway". Done today: today's existing completed state.
4. **This week**: rings (keep geometry), the three numbers as Metric primary with ratios ("3/6 sessions · 55/104 sets · 163/360 min"), the week strip. The targets sentence, legend, "LAST 7 DAYS" grid and the footer sentence go behind (i).
5. **Week strip**: seven 32 px circles with the day above. Trained: lime with a black check. Planned: 1.5 px `--text-3` ring. Rest: small dot. Missed: `--down` ring at 60%. Today: a white ring around it. No filled tiles.
6. **Food and body** (one group, three rows): "Food · 1,240 kcal left · protein 62 of 127 g" with a small ring and a "Log" capsule; "Weight · 67.0 kg" with the sparkline and "+0.1 kg" capsule (tap to weigh in); "Water · 3 of 9 glasses" with a "+" capsule. Activity joins as a fourth row only when there is any activity today.
7. **Highlight**: one insight row (one bold sentence, one subtitle) with "See all" to Progress.
8. **Strength**: keep the sparkline rows (max 3) with the change capsule in green or red under the sparkline, "See all".
9. Pro reminders (`nudge.ts`) keep their rules; they render as one row in the Highlight style, not a card.

### S4. Workout tab

1. Header: "Workout", "Routines" text button, avatar. Workout dock unchanged.
2. **Week strip** of the active routine (today ringed, not lime-filled; trained days with a check).
3. **Next** group: day name, "6 exercises · last done Monday", up to 4 exercise rows ("3 × 5 to 8" trailing), "2 more" text button, lime "Start Push".
4. **Other days** as rows: name, meta, trailing "Start" capsule; tapping the row expands its exercise list (no separate chevron).
5. "Empty workout" as the last row with a "Start" capsule. "Start again from history" stays on workout detail.

### S5. Routines list and routine editor

1. Routines list: each routine one group: name, "3 days · 18 exercises · 6 per week", week strip (today ringed), an "Active" capsule, one "..." menu (Edit, Share, Make active, Delete). Remove the separate "Edit routine" row (it duplicates the menu). "New routine" as a header "+" icon.
2. Routine editor: exercises as rows with number, name and one meta line ("3 × 5 to 8 · RIR 2 · 3:00 rest") instead of three pills each (54 pills on Push Pull Legs today). Weekday picker as a segmented row. Keep one overflow menu and drop the pencil beside the title (rename lives in the menu). Swipe, long press and drag reorder unchanged.
3. Shared routine page (`/r`): same row style; one lime "Add to my routines".

### S6. Active logger (the most used screen)

1. **Header** (one line, never wraps): session name, "12:04 · 3 of 18 sets", pause and rest-timer icons, lime "Finish" capsule. A 2 px lime progress line under it. No calories in the header.
2. **Check-in** as a slim dismissible row (B4).
3. **Exercise card** (one group per exercise): name in headline with a "..." menu; one meta line "Target 3 × 5 to 8 · RIR 2". Muscle shares move to the exercise info sheet (tap the name). "Last: Mon, 26 Oct" and "Copy last time" on one line. Notes: a note icon in the card header (shows the note when there is one; last session's note and "Use" kept).
4. **Set rows**: keep today's grid (set, last, kg, reps, RIR, check), 44 px targets, per-side reps from round 4. Done row: lime check and a faint `--accent-dim` wash (not a strong lime block). Warm-up and drop set markers as small letters in the set circle (as today).
5. "+ Add set" and "− Remove set" as two text buttons under the rows, not grey slabs.
6. **Rest timer**: docked bar above the home indicator, same controls (−15, +15, Skip); the page gets bottom padding so it never covers the last set.
7. "Add exercise" as a full-width secondary button at the end; empty workout shows "Add your first exercise" with the primary button.
8. Medal alerts, plate sheet, set sheet, reorder sheet, superset and side switch unchanged apart from G11 headers.
9. **Finish sheet**: "2 of 17 sets done. 15 empty sets will be removed." stays; effort 1 to 10 as a segmented row; lime "Finish and save", text button "Keep going".

### S7. Workout summary

1. Tab bar hidden (B3). Title-1 "Push done", footnote "Thursday 29 October · 55 min".
2. **Hero**: volume load as Metric hero with a change capsule vs the last same session ("−85% vs last Push").
3. StatGrid: Duration, Working sets, Exercises, Records (zero tiles hidden; a short session shows "Under a minute").
4. Records group with the medal rows when there are any (celebration kept).
5. Exercises as rows: name, "2 sets · 1,013 kg", change capsule trailing. The paragraph "Changes compare your best set..." goes behind (i).
6. Muscle map card kept as one group (map, top three muscles as a row of capsules).
7. One "Details" group: Calories (estimate, (i)), Rest, Refuel ("Log a meal" capsule), View workout details.
8. Share as a header icon; lime "Done" pinned at the bottom.

### S8. History

1. Search field plus one "Filter" capsule that opens a sheet with range, workout, exercise and muscle. Active filters as removable chips under the search. Replaces today's two rows of seven controls.
2. Week sections: "This week" with "3 workouts · 55 sets · 23,074 kg" as the footnote.
3. Rows: date tile kept, name with a trophy capsule when there are records, one subtitle "1 h · 19 sets · 11,505 kg". The truncated exercise list line goes.

### S9. Workout detail

1. Header: back, title, "..." menu (Save as a routine, Share, Edit, Delete). Meta: "Wed 28 Oct · 7:23 pm · Push Pull Legs".
2. "Start this workout" as the single lime button; Share moves to the menu.
3. StatGrid without zero tiles. Session effort and the note as rows (F14).
4. Muscle map group (as on the summary).
5. Set tables: rest shown as a small trailing caption in the set row ("2:36") instead of a "Rested" line between every set, which halves the table height. "1:13 since the last exercise" moves into the exercise subtitle. "Best estimated 1RM 105 kg" as the exercise footer.
6. Calories and Rest as rows with (i); disclaimers behind (i).

### S10. Food

1. Header: "Food", sparkle, avatar, and a "+" icon (Add food) instead of the lime "Add food" pill. Subtitle "Indian meals, katori portions, your numbers" removed. Demo chip removed.
2. Day switcher "< Today >" kept as a centred row.
3. **Hero**: calories left as Metric hero ("2,700 kcal left" on an empty day, "1,240 kcal left" later), "of 2,700 kcal" footnote, a ring that fills as food is logged (track visible, never a dead grey disc). Macros (protein first, carbs, fat, fibre) as a 4-column row of Metric secondary values with thin lines; protein's line lime when met.
4. **Meals**: one group, four rows (Breakfast, Lunch, Snacks, Dinner): title, kcal trailing or "Add", trailing "+". Logged foods show as indented sub-rows under their meal. "Your usual: Poha, Chai with sugar" becomes one capsule under an empty meal row ("Usual · Poha, Chai · Log"), one tap logs it as today.
5. **Water**: one row, "3 of 9 glasses · 750 of 2,250 ml", a "+ 250 ml" capsule. 500 ml, 1 L, Other and Undo move into a sheet opened by tapping the row.
6. **Day analysis** (Pro): one group of rows (energy, macros, protein per meal, fibre), each with a status capsule; text behind (i).
7. Footer: "Targets worked out for you · Change" and "Food settings" as text buttons. The Food settings group leaves the page (still reachable here and in Settings).

### S11. Add food sheet and food profile

1. Meals as a segmented control (today's style is close; apply G7).
2. Search on top, then the slim Ask GPT / Snap / Label row (round 4) kept.
3. Rows: name, "Last time: 2 rotis · 204 kcal · 8 g protein", trailing "+" (unchanged behaviour: + puts last time's amount on the plate).
4. The plate as a pinned bottom bar: "3 items · 512 kcal" and a lime "Log lunch". It is the one primary button of the sheet.
5. Food profile: the number block as Metric (kcal hero for the portion), macro split bar, per 100 g as rows, the amount stepper, lime "Add". AI results keep their labels ("From the web", "Estimated", "Your numbers") as small capsules.

### S12. Progress

1. Header: "Progress", sparkle, avatar. Under it a sticky segmented control (Overview, Strength, Volume, Body, Food) and the range control (7D, 30D, 90D, All) on the bar material.
2. The two promo cards ("How every number is calculated", "Ask OverloadGPT") go: methodology is a footer text button on every segment; OverloadGPT is the header icon.
3. **Overview**: StatGrid (Workouts, Working sets, Volume load, Records) with change capsules where a previous period exists; two insights with "See all"; Adherence and Frequency as one group of rows; Last week summary; Latest records (3 rows, "See all"); Body weight row.
4. **Strength**: exercise picker as a row at the top of the chart group, Estimated 1RM chart with the G8 header, Top set load and Reps at the top load as a two-option segmented control inside the same group, Relative strength row, Rate of progress rows, Strength levels rows (segmented bar kept, "Advanced at 150.6 kg" as subtitle), Stalled lifts rows with an amber capsule ("4 weeks"), expanding on tap to "What your sets show" and "Try this".
5. **Volume**: Volume load per week, By exercise (top 6, "See all"), Sets per muscle, Balance (three rows with the two-part bar), Last trained directly, Workouts per week, Rest between sets.
6. **Body**: Body weight chart with the 7-day average, weekly change, link to Body metrics.
7. **Food**: calories and protein tiles, the two charts, Where your protein comes from, Real maintenance.
8. Every "Explain" chip becomes the ExplainButton icon; every methodology paragraph over one line moves into the (i) sheet.
9. Pro locks (`ProLock`) render as one row inside the segment ("Strength levels · Pro") not a large card.
10. Acceptance: no segment longer than about 4 phone screens at 390 × 844 (today the page is 12.7 screens).

### S13. Exercises

1. Header: back, title, "+" icon (New). Demo chip removed. Count "120 exercises" as the search placeholder.
2. Search, muscle chips with an edge fade, "More filters" as a capsule.
3. "Recently used" group (max 5, no stuck highlight, F7), then "All exercises" with sticky letter headers and a right-side A to Z index.
4. Rows: name and "Abs · Bodyweight". No two-letter tile. The muscle share line moves to the exercise sheet.
5. Exercise sheet: muscles and shares, instructions, records, "Add to workout".

### S14. Records

1. Two-line rows: exercise name with the value trailing (Metric secondary), subtitle "Estimated 1RM · Tuesday" with a green change capsule ("+3.3 kg"). "Estimated from 60 kg × 8" moves to the record sheet.
2. A 6 px lime dot before the name for records from the last 7 days replaces the "New" badge (F6).
3. Group by period (Last 30 days, Earlier) as sections.

### S15. Body metrics

1. Order: **Weight hero** (Metric hero "67.0 kg", change capsule vs a week earlier, "7-day average 66.9 kg" footnote), trend chart with a range control, "Weigh-in" as the one primary button under the chart (the lime header pill goes).
2. Derived numbers: StatGrid of 4 (Daily calories, Protein a day "107 to 147 g", BMI, Body fat) and rows for the rest (Lean mass index, Weekly change). Tiles without chevrons; tapping opens the explanation.
3. Targets group with an "Edit" text button (F5). Measurements group with a "+" icon (F4), measurement chips with the fade (F13).
4. All weigh-ins kept as is (already clean).

### S16. Activity

1. "Burned" as Metric hero only when there is any value; otherwise one EmptyLine: "Nothing logged today · Add steps · Add cardio".
2. Steps and cardio as rows; disclaimers behind (i). "+ Cardio" becomes a header "+" icon.

### S17. Journey and badges

1. Journey: goals kept (they work). Milestones become one group of rows (icon tile, title, subtitle, date trailing) instead of one card each. Recaps kept.
2. Badges: "14 of 37 earned" as the footnote under the title; Latest unlock kept as the hero; Almost there as rows with a thin progress line; the grid with earned in colour and locked in monochrome, number only inside the shape.

### S18. More

1. Profile row at the top (avatar, name, goal subtitle, Pro capsule).
2. The reload reminder becomes one row ("Reload for the latest version", "Reload" capsule).
3. Groups with sentence-case section headers ("You", "Training", "App") and `--fill` icon tiles (no coloured tiles). Legal links as a footnote row at the bottom.

### S19. Settings, profile, account

1. Settings: row titles only; each description moves to the group footer. kg / lb and Mon / Sun as trailing segmented controls in the row. Toggles stay lime. Export rows with a trailing "Export" text button.
2. Profile: header card becomes avatar, name and goal centred without a card; "Fictional demo profile" in orange goes (the banner says it); "Set up yours" and "Run setup again" as one text button row; the lists kept.
3. Account: sync status as one row with its icon and the existing wording; "Sync now" and "Try failed changes again" as text buttons in the row footer; Sign out as a centred red row in its own group; Delete account as a red row that opens the existing confirm flow.

### S20. Pro, plans and membership

1. Top to bottom: "Overload Pro" capsule, headline, two-line subhead, "In your training right now" StatGrid (3 tiles), four key features as rows with lime-dim icon tiles, plans, one primary button, "Compare Free and Pro" row that expands the full table, FAQ accordion, trust lines as footnotes. Remove the repeated feature lists (the page is 6.9 screens today).
2. Auto-renew and Pay once as a segmented control; plan cards per G7 with the price as Metric primary; "Introductory prices" as a footnote, not an olive card.
3. Top button and plans always show the same state (trial, plans open, plans closed).
4. ProMember: membership as one group of rows (plan, renews or ends, manage).

### S21. OverloadGPT, feedback, science, legal, contact

1. OverloadGPT: consent card as a group with one lime "Turn on"; chat unchanged (opens at the latest message); suggestions as capsules.
2. Feedback: stars, topic chips and text field in one group; lime "Send feedback" not covered by anything.
3. Science: article layout (no card per section), title-2 headings on black, formulas in an `--elevated` block, sources as rows with an external icon; the section index as one group of rows at the top.
4. Legal and contact: line height 1.5, 65 characters a line on desktop, "Open the app" as a capsule button.

### S22. App-wide pieces

1. Toasts: one style, bottom above the tab bar, action text in lime ("Undo").
2. Error, crash, offline and start-up help screens: same Section and Row look, one primary button.
3. "What's new": one sheet per release in G11 style.
4. Story cards (Instagram) unchanged.
5. Desktop (1440): sidebar with the five tabs plus More, Activity and the extra links; content max width 720 for lists, 1040 for Progress with two columns where a segment has more than 4 modules.

---

## 8. Faster logging and convenience (included above, listed here so you can strike them)

- **C1.** Home "Start Push" visible without scrolling (S3.3).
- **C2.** Logger opens at the first exercise; check-in no longer in the way (B4).
- **C3.** One-line logger header, more room for sets (S6.1).
- **C4.** Rest shown inline in workout detail, half the scrolling (S9.5).
- **C5.** Usual meal as a one-tap capsule under each empty meal (S10.4).
- **C6.** Water in one tap from Home and Food (S3.6, S10.5).
- **C7.** Plate total and "Log lunch" pinned at the bottom of Add food (S11.4).
- **C8.** History filter in one sheet (S8.1).
- **C9.** Exercises A to Z index (S13.3).
- **C10.** More one tap away from every tab through the avatar (B9).

Optional additions (small new behaviour, off unless you keep them):

- **O1.** Empty meal row "..." menu: "Copy yesterday's breakfast" (uses existing logs, saved through the existing repository).
- **O2.** Weigh-in sheet: −0.1 and +0.1 steppers beside the number, starting from the last weight.
- **O3.** Logger: when the last set of an exercise is ticked, the next exercise scrolls into view on its own (the rest timer starts as today).

---

## 9. Parts and order

1. **Part 1, foundation**: G1 to G5 tokens, type, Metric, kit primitives, formatter rules with tests. No layout change yet.
2. **Part 2, chrome**: G6, B1, B2, B3, B7, B9, ghost title fix, bottom padding rule.
3. **Part 3, bugs**: F1 to F14 (those not solved by Parts 1 and 2).
4. **Part 4, Home and Workout**: S3, S4, S5.
5. **Part 5, logger and summary**: S6, S7, B4, B8.
6. **Part 6, Food**: S10, S11.
7. **Part 7, Progress**: S12, B5, B6.
8. **Part 8, lists**: S8, S9, S13, S14, S15, S16, S17.
9. **Part 9, account and the rest**: S1, S2, S18 to S22.
10. **Part 10, QA**: section 10 and 11 in full, screenshots, report, one pull request.

---

## 10. Tests to add

- `Metric`: unit never wraps alone at 320 px; compact rule; change colours; zero renders nothing.
- Formatter: compact numbers, ranges ("107 to 147 g"), durations ("Under a minute", "1 h 13 min").
- Chart axis thinning: no overlapping labels at 360 px.
- Tab bar: five items; absent in the logger and on the summary; `/routines` still opens.
- No floating OverloadGPT button on any route; the header icon opens `/coach`.
- Overlap check on every route: no fixed or floating element covers a focusable control at rest, at 360, 390 and 430 px.
- Ghost titles: collapsed title at opacity 0 at scroll 0 on every pushed page.
- Logger: opens at the first exercise; the check-in row opens the sheet; stored answers unchanged.
- Progress: every module of today reachable in exactly one segment (by test ids).
- Home: Today's start button inside the first 844 px.
- Demo chip only on Home.
- Each F item has its own regression test.
- All existing e2e suites, `devices.spec.ts`, `sheets-iphone.spec.ts`, `startup.spec.ts` and `pnpm test:update` pass.

---

## 11. Definition of done (every part)

1. `pnpm check` (typecheck, lint with 0 warnings, unit tests, production build with the development-code check) passes.
2. The e2e suites touched by the part pass; Part 10 runs the whole suite on mobile and desktop plus `pnpm test:update`.
3. axe WCAG 2.1 AA: 0 violations on touched screens. Contrast of `--text-2` and `--text-3` checked where text uses them.
4. Screenshots of touched screens at 390 × 844, before and after, in `docs/screenshots/v3/`.
5. Report: files changed, pass or fail per item id, anything not applied and why, conflicts with existing behaviour, any value not mapped to a token.
6. Commit `ui-v3: part N` on `ui-v3`, push, stop and wait for the owner.

## 12. Final report (`docs/ui-v3-report.md`)

What changed per part and per item id, the Progress module mapping table, the real-user smoke test result (Android and iPhone sizes), the update check result, what was not applied and why, and open questions for the owner.

---

## 13. Owner's additions (29 October 2026)

The owner approved every item above, including O1 to O3, and added:

- **A1. OverloadGPT from anywhere.** The floating button goes (B2). Entry points: a sparkle button in the header of every main tab (Home, Workout, Food, Progress, History) that opens the same OverloadGPT sheet the floating button opened; the Explain icons on cards; the More row. Hidden inside a running workout, as today.
- **A2. Pro near the top of More and Profile**, right under the name, with the price, so buying is one tap.
- **A3. More frequent, honest Pro reminders for free members.** Spaced reminders on Home built from the person's own numbers (`nudge.ts`), a lighter cadence than today's four, a dismiss that pushes the next one further away, never during a workout, never on the logger or summary.
- **A4. Pro page leads with the price**, then what Pro gives, then the person's own numbers, the comparison, FAQ and reassurance. Conversion tactics allowed: price anchoring (monthly next to the yearly price per month, best value preselected), loss framing ("what you keep with Pro"), risk reversal (cancel any time, refund policy link), the person's own data as proof, one clear call to action. Not allowed: invented reviews or user counts, fake countdowns or scarcity, prices or savings not taken from `billing_plans`.
