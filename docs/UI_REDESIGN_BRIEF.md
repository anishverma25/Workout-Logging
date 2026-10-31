# Overload: UI Premium Redesign Brief (amended)

Version 2, 10 October 2026. Supersedes the original "PWA Redesign Brief, UI Premium" PDF.
Repository `anishverma25/Workout-Logging`. Work branch `ui-premium`, created from `phase-2-wip`.

---

## 0. How to use this document (read first, every session)

This is the single source of truth for the visual redesign. It contains the original seven-part
brief, corrected with the owner's decisions, plus the screens the original did not cover.

**Session protocol**

1. At the start of every building session, read this file and `docs/UI_RULES.md` (created in Part 1).
2. Check `git log` on `ui-premium` to see which parts are already committed. Never redo a committed part.
3. Do one part at a time, in order. Parts build on each other.
4. Each part ends with the **Definition of done** in section 13. Then stop and report.
5. If a part cannot finish in one session, commit the work so far as `ui: part N (wip)` with a short
   note in the commit body listing what is left. The next session continues from there.

**Standing rules for every part**

- Visual and interaction layer only. No changes to data models, sync, analytics formulas, routes or
  feature set, except the behaviour changes listed in section 2, which the owner has approved.
- Use only tokens and shared components. No hard-coded colours, sizes, spacing or radii.
- If an instruction conflicts with existing behaviour, existing behaviour wins. Report the conflict.
- Never weaken: offline logging, idempotent sync, honest sync status, previous performance, one-tap
  completion from last time, the "Estimated" label on e1RM, history never locked behind Pro, demo data
  blocked in accounts.
- No em dashes anywhere in UI copy or docs. No exclamation marks, no emoji, no marketing phrases.
- Production deploys from `phase-2-wip`. Nothing reaches users until `ui-premium` is merged after Part 9.

**Part map**

| Part | Scope                                                                                                                               | Approx. 5-hour Pro windows |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1    | Foundation: rules file, dark-only tokens, fonts, shared components incl. sheets and fields                                          | 1                          |
| 2    | Global fixes: tab bar, sidebar, headers, theme removal, formatters, copy, shared rows, desktop rules                                | 1.5                        |
| 3    | Home, Routines, Routine editor, Workout tab                                                                                         | 1                          |
| 4    | Progress                                                                                                                            | 1 to 1.5                   |
| 5    | History, More, Journey, Exercises, Settings                                                                                         | 1                          |
| 6    | Active workout and pickers                                                                                                          | 1.5 to 2                   |
| 7    | Everything else: auth, summary, workout detail, Records, Body metrics, methodology, Pro and UPI, setup, tour, system UI, all sheets | 1 to 1.5                   |
| 8    | Feel: motion, haptics, loading, charts                                                                                              | 1                          |
| 9    | Final QA, test sweep, merge readiness                                                                                               | 1                          |
|      | **Total**                                                                                                                           | **about 10 to 12**         |

---

## 1. Decisions log (owner approved, 10 October 2026)

| #   | Topic              | Decision                                                                                                                                                                                                                                                                                     |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Low-contrast text  | Any text that carries information uses `--text-2` or brighter. `--text-3` is only for decorative or disabled text, placeholders, and text at Title size or larger. The "Last" column, axis labels, dates, "Not yet", captions and footnotes use `--text-2`. Every screen passes WCAG 2.1 AA. |
| D2  | Focus              | No shadows for elevation. Keyboard focus is a 2px `--focus` outline, 2px offset, on `:focus-visible` only.                                                                                                                                                                                   |
| D3  | Theme              | **Dark only.** Remove the light theme, its tokens, the theme picker in Settings, and light-theme test runs. Any stored theme preference is ignored and treated as dark. This supersedes "also support a polished light theme" in the Master Product Context.                                 |
| D4  | Sets per muscle    | Show weekly fractional sets per muscle (direct 1, indirect 0.5) and the trend versus previous weeks. Bars share one fixed scale so muscles compare honestly. No target range, no "optimal" fill. Methodology explains diminishing returns and that no single number is right (Pelland 2026). |
| D5  | Balance cards      | Imbalance warning dropped. Show the two values and their ratio only.                                                                                                                                                                                                                         |
| D6  | Science entry      | Keep a 24px InfoButton per section. The methodology row is labelled "How every number is calculated" with Meta line "Formulas and the research behind them", placed at the top of Progress under the jump bar, not at the bottom.                                                            |
| D7  | Insights           | Remove only the insight that duplicates Adherence. All other insights stay.                                                                                                                                                                                                                  |
| D8  | Thresholds in copy | Every number in empty states and captions ("3 sessions", "5 weeks", "4 sessions per lift", "7 days") is read from the same exported constants the analytics use. A unit test asserts copy and constants match.                                                                               |
| D9  | Week start         | Fix Home starting on Sunday. Keep the week-start setting, default Monday. Every week strip, ring card and weekly chart follows the setting.                                                                                                                                                  |
| D10 | Day names          | Short days (Mon Tue Wed Thu Fri Sat Sun) in strips, chips and selectors. Full name (Thursday) only as the day label chip in the routine editor.                                                                                                                                              |
| D11 | Count-up numbers   | Hero numbers count up with tabular digits during the animation, so width never jitters. At rest they keep the rule (proportional for hero stats).                                                                                                                                            |
| D12 | Rest end haptic    | Medium (20 ms). Success is reserved for workout finished and new record.                                                                                                                                                                                                                     |
| D13 | Coverage           | Every screen, sheet, state and the desktop layout follows these rules. Tests are updated inside each part. Inter is subset to Latin.                                                                                                                                                         |

---

## 2. Approved behaviour changes

These are the only logic changes allowed. Each needs tests.

**B1. Repeat a completed session.** If today's planned session is already logged, the Workout tab
shows a "Completed" chip with "View" (neutral) and "Repeat" (SecondaryButton). Repeat starts a new
workout from the same routine day. Adherence counts a planned day once: the repeat is stored and shown
in History as an extra session, and never raises completed planned sessions above planned sessions.
Check the adherence function. If it already counts distinct planned days, only add a test.

**B2. Collapse and scroll after an exercise is finished.** When the last set of an exercise is ticked,
its card collapses to a 64px row (lime check, name, "3 of 3 · 70 kg × 8"). Auto-scroll to the next
exercise happens only when no input is focused and there has been no touch or scroll in the previous
1000 ms. Otherwise no scroll. A collapsed card expands with one tap, and "Add set" is available
immediately after expanding.

**B3. Finish with unfinished sets.** Tapping Finish with any unticked set opens a confirm sheet:
"X of Y sets done. Finish anyway?" with "Finish" (PrimaryButton) and "Keep going" (SecondaryButton).
On finish, keep the current rule exactly: empty unticked sets are discarded, unticked sets with typed
values are kept as not completed. If such a sheet already exists, restyle it only.

**B4. Theme removal (D3).** The theme setting is removed. Stored preference values are ignored, not
deleted, so no migration is needed. The pre-paint theme script (CSP-friendly) sets dark unconditionally
or is removed if `data-theme="dark"` is static in `index.html`.

**B5. Pickers.** Rest and bench angle wheels are replaced by stepper, presets and keypad (Part 6).
Values outside the new ranges are clamped for display and editing only. Stored values are never
rewritten unless the user changes them.

---

## 3. Part 1: Foundation

No screen is restyled in this part.

### Step 1. Create `docs/UI_RULES.md`

Copy sections 3.1 to 3.6 into it, and commit this brief as `docs/UI_REDESIGN_BRIEF.md`.

#### 3.1 PWA rules

| Topic            | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts            | Self-host Inter 4 woff2, **Latin subset only** (U+0000 to U+00FF, U+0131, U+0152 to U+0153, U+02BB to U+02BC, U+02C6, U+02DA, U+02DC, U+2000 to U+206F, U+20B9, U+2074, U+20AC, U+2122, U+2190 to U+2199, U+2212, U+2215, U+00D7, U+00B0). Weights 400, 500, 600, 700, plus Inter Display 700 for Display and Stat. Files in `/public/fonts`. `font-display: swap`. Preload only 400 and 600. Precache all five in the service worker. Target under 25 KB per file. |
| Font stack       | `Inter, "Inter Fallback", system-ui, sans-serif`. Define `Inter Fallback` from `local("Arial")` with `size-adjust: 107%; ascent-override: 90%; descent-override: 22.5%; line-gap-override: 0%` (verify visually, adjust so text does not shift on swap).                                                                                                                                                                                                            |
| Tokens           | CSS custom properties on `:root` in one token file. Dark only. No hard-coded colours, sizes, spacing or radii outside it.                                                                                                                                                                                                                                                                                                                                           |
| Type units       | rem. `-webkit-text-size-adjust: 100%`.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Controls         | `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, `user-select: none` on UI chrome (never on inputs or readable content), `overscroll-behavior: none` on the app shell. `box-shadow: none` for elevation.                                                                                                                                                                                                                                   |
| Focus            | `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }`. Never remove focus without this replacement.                                                                                                                                                                                                                                                                                                                                            |
| Safe areas       | `viewport-fit=cover`, `env(safe-area-inset-*)` on header, tab bar, floating bars and pinned buttons.                                                                                                                                                                                                                                                                                                                                                                |
| Manifest         | `display: standalone`, `orientation: portrait`, `theme_color` and `background_color` `#000000`. iOS: `apple-mobile-web-app-capable`, status bar `black-translucent`. `<meta name="theme-color" content="#000000">`.                                                                                                                                                                                                                                                 |
| Haptics          | `navigator.vibrate` behind a feature check. Never throw. Always paired with a visual change.                                                                                                                                                                                                                                                                                                                                                                        |
| Keyboard toolbar | In-page, anchored above the keyboard with `visualViewport`. Inputs use `inputMode="decimal"` or `"numeric"`.                                                                                                                                                                                                                                                                                                                                                        |
| Screen awake     | Wake Lock API during an active workout, re-requested on `visibilitychange`. Fail silently where unsupported.                                                                                                                                                                                                                                                                                                                                                        |
| Switch           | A `<button role="switch" aria-checked>`.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Service worker   | Bump the cache version at the end of every part.                                                                                                                                                                                                                                                                                                                                                                                                                    |

#### 3.2 Type scale

| Style    | Size / line (px) | rem            | Weight              | Tracking | Used for                                  |
| -------- | ---------------- | -------------- | ------------------- | -------- | ----------------------------------------- |
| Display  | 34 / 40          | 2.125 / 2.5    | 700 (Inter Display) | −0.024em | Screen titles                             |
| Stat     | 32 / 36          | 2 / 2.25       | 700 (Inter Display) | −0.022em | Big numbers                               |
| Title    | 22 / 28          | 1.375 / 1.75   | 600                 | −0.018em | Section titles, exercise names in workout |
| Headline | 17 / 22          | 1.0625 / 1.375 | 600                 | −0.012em | Row titles, buttons                       |
| Body     | 15 / 22          | 0.9375 / 1.375 | 400                 | −0.007em | Descriptions                              |
| Meta     | 13 / 18          | 0.8125 / 1.125 | 400                 | 0        | Secondary info                            |
| Caption  | 11 / 14          | 0.6875 / 0.875 | 500                 | +0.009em | Tab labels, tiny chips                    |

Rules:

- Only these seven styles exist. Weight variants allowed only where this brief names them (for example
  "Meta 600", "Caption 600", "17px 500" row labels, which is Headline size at weight 500).
- Subtitles under screen titles: Body, `--text-2`, one line.
- Units (kg, min): Meta, `--text-2`, baseline aligned with the number.
- `text-wrap: balance` on subtitles and descriptions.
- Hero stats use proportional digits at rest. `tabular-nums` for timers, set tables, axis labels,
  right-aligned numeric columns, steppers and during count-up animations (D11).

#### 3.3 Colour tokens (dark only)

| Token             | Value                                                     | Use                                                                 |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| `--bg`            | `#000000`                                                 | App background, headers                                             |
| `--bar`           | `#0A0A0A`                                                 | Tab bar, desktop sidebar                                            |
| `--surface`       | `#1C1C1E`                                                 | All cards, sheets                                                   |
| `--surface-2`     | `#2C2C2E`                                                 | Chips, inputs, nested blocks, tiles, skeletons                      |
| `--border`        | `rgba(255,255,255,0.08)`                                  | 1px on cards                                                        |
| `--border-strong` | `rgba(255,255,255,0.16)`                                  | Active exercise card, chart earlier-period bars                     |
| `--divider`       | `rgba(255,255,255,0.08)`                                  | 0.5px dividers                                                      |
| `--grid`          | `rgba(255,255,255,0.06)`                                  | Chart gridlines, ring tracks                                        |
| `--track`         | `rgba(255,255,255,0.10)`                                  | Progress and bar tracks                                             |
| `--text-1`        | `#FFFFFF`                                                 | Primary text                                                        |
| `--text-2`        | `rgba(235,235,245,0.60)`                                  | Secondary text, all informative small text (about 5.8:1 on surface) |
| `--text-3`        | `rgba(235,235,245,0.38)`                                  | Decorative, disabled, placeholders, large text only (about 3.2:1)   |
| `--lime`          | sampled from the current Start button; fallback `#C8F43A` | The one accent                                                      |
| `--lime-dim`      | lime at 14% opacity                                       | Soft accent chips and fills                                         |
| `--on-lime`       | `#000000`                                                 | Text and icons on lime                                              |
| `--focus`         | `#FFFFFF`                                                 | Focus outline                                                       |
| `--overlay`       | `rgba(0,0,0,0.60)`                                        | Sheet and dialog backdrop                                           |
| `--warning`       | `#FFB340`                                                 | Real warnings only                                                  |
| `--danger`        | `#FF453A`                                                 | Destructive only                                                    |

- Lighter or dimmer lime is the same hue with opacity, never a different hue.
- Remove everywhere: other limes, olive, yellow-green, blue, periwinkle, purple, orange, bronze,
  avatar gradients, and all light-theme tokens.
- **Lime rule.** Lime only for: primary buttons, the active tab or sidebar item icon, progress fills,
  completion checkmarks and completed set numbers, switches that are on, the current-day highlight,
  the Pro icon tile, and chart current-period data. Never for links, borders, decoration or
  secondary buttons. Max one lime button visible per screen region.

#### 3.4 Spacing and shape

| Property                    | Value                                                                        |
| --------------------------- | ---------------------------------------------------------------------------- |
| Spacing scale (4pt)         | 4, 8, 12, 16, 20, 24, 32                                                     |
| Horizontal margin           | 16 below 600px wide, 24 from 600 to 1023, 32 from 1024                       |
| Content max width (desktop) | 720 for lists, forms and settings; 1120 for Home, Progress and History grids |
| Card                        | padding 20, radius 24, nested radius 16                                      |
| Gaps                        | card 16, section 32, header to first card 24                                 |
| Rows                        | min height 44, 56 for two-line rows                                          |
| Chips and pills             | height 36, radius 999                                                        |
| Inputs                      | height 52 (set inputs, text fields), 44 (search), radius 12                  |
| Min tap target              | 44 × 44 (set check 48 × 48)                                                  |
| Shadows                     | none; cards are surface plus 1px border                                      |
| Press feedback              | opacity 0.7 and scale 0.98, 150 ms                                           |

#### 3.5 One-off rules

| Topic            | Rule                                                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection        | Selected chip, segment, day or option card = white fill, black text. Unselected = `--surface-2` fill, `--text-1`. Applies to range, filter and muscle chips, Front/Side/Back, kg/lb, week start, day selectors and setup option cards. Exception: the current day in week strips is lime. |
| Switch           | Custom 51 × 31. On = lime track, white thumb. Off = `--surface-2` track, white thumb. No ring.                                                                                                                                                                                            |
| Icon tile        | 36 × 36, radius 10, `--surface-2`, icon 20px in `--text-2`. Only the Pro row uses `--lime-dim` with a lime icon.                                                                                                                                                                          |
| Empty state      | Min height 88, `--surface-2`, radius 16, no dashed border, centred Meta `--text-2`, max two lines.                                                                                                                                                                                        |
| Dashed outlines  | Only for a missed day in Last 7 days and an empty or rest day in week strips.                                                                                                                                                                                                             |
| Copy             | Calm and specific. No exclamation marks, no marketing phrases, no emoji, no em dashes. Prefer numbers to adjectives. Sentence case.                                                                                                                                                       |
| Contrast         | Informative text at least 4.5:1. `--text-3` only where D1 allows.                                                                                                                                                                                                                         |
| Performance      | Memoise list rows, no inline functions in list renderers, SVG icons only.                                                                                                                                                                                                                 |
| Estimated values | Anything estimated carries the word "Estimated" or "e1RM", never shown as an actual max.                                                                                                                                                                                                  |

#### 3.6 Separators and formats

- "×" for sets by reps (3 × 8), "to" for ranges (6 to 8), "·" between meta items.
- Formatters are defined in Part 2 and used everywhere.

### Step 2. Fonts and tokens

Add subset font files, `@font-face`, the fallback face and the token file. Delete light tokens and any
`[data-theme="light"]` rules. Set `data-theme="dark"` statically.

### Step 3. Shared components

One folder, tokens only. Each component has every state (default, pressed, focus-visible, disabled,
loading where relevant).

| Group     | Components                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout    | Screen, LargeTitleHeader (collapsing), PushedHeader, Card, SectionHeader (Title plus optional InfoButton and TextLink)                                                                                                                             |
| Selection | Chip, ChipGroup, SegmentedControl, Switch, OptionCard (large selectable card for setup)                                                                                                                                                            |
| Data      | StatTile, ListRow (one and two line, optional right value, chevron), IconTile, Avatar, ProgressBar, Badge (lime-dim or neutral), RingChart shell                                                                                                   |
| Actions   | PrimaryButton (52 default, 44 compact), SecondaryButton (surface-2), DestructiveButton (danger text on surface-2), TextLink (neutral, optional chevron or external icon), IconButton (40 circle), InfoButton (24)                                  |
| Inputs    | TextField (label Meta `--text-2` above, error Meta `--danger` below with icon), PasswordField (show or hide IconButton), SearchField, NumberField (empty-allowed decimal, keypad), Stepper (− value +, long-press repeat and accelerate after 1 s) |
| Feedback  | EmptyState, ErrorState (IconTile, Headline, Meta, "Try again" SecondaryButton), Skeleton (exact dimensions), Toast, InlineNotice (surface-2 row with icon, for offline and info notes), SyncStatus (see Part 7)                                    |
| Overlays  | BottomSheet, ConfirmSheet, Dialog (desktop presentation of a sheet)                                                                                                                                                                                |

**BottomSheet spec.** `--surface`, top radius 24, drag handle 36 × 5 at white 20% centred 8px from
the top, backdrop `--overlay`. Auto height, max 85% of the viewport, safe-area padding. Optional
sticky header (Title plus optional Meta subtitle, 32px neutral close IconButton) and pinned footer
(buttons 52 high, above the safe area). Scroll area gets bottom padding equal to the footer height.
Focus is trapped, Escape and backdrop tap close it, focus returns to the trigger. Swipe down to
dismiss. At 1024px and wider it renders as a centred Dialog, max width 480, radius 24.

**ConfirmSheet spec.** Title (Headline), body (Body `--text-2`), primary action on top (PrimaryButton,
or DestructiveButton for destructive actions), "Cancel" or the named neutral action below.

**Toast spec.** `--surface-2`, radius 16, Body `--text-1`, optional 20px icon in `--text-2`, 16px
margin, sits above the tab bar or floating bar, auto-dismiss 3 s, `aria-live="polite"`. Never lime fill.

Do not build TabBar yet.

### Step 4. Prove the components

Show every component and state on a temporary `/ui-kit` route. Do not wire them into screens. Remove
the route before committing.

---

## 4. Part 2: Global fixes

1. **Tab bar (mobile, below 1024px).** Opaque `--bar`, no transparency or blur. Height 49 plus the
   bottom safe-area inset. 0.5px top border at white 10%. Remove the dead space below labels.
   - One icon set: 24px, 1.75 stroke on all five icons (the dumbbell is currently heavier).
     Draw five custom SVG pairs (outline and filled) in one file, because lucide has no filled variants.
   - Active: filled variant, lime, Caption weight 600 in `--text-1`.
   - Inactive: outline, white 55%, Caption weight 500.
2. **Desktop sidebar (1024px and wider).** `--bar` background, width 240, 0.5px right divider. Same
   icons. Items 44 high, radius 12. Active = `--surface-2` fill, lime icon, `--text-1` label.
   Inactive = `--text-2`. Content area uses the desktop margins and max widths from 3.4.
3. **Headers.**
   - Top-level tabs (Home, Routines, Workout, Progress, History) use LargeTitleHeader: Display title
     that collapses to a centred 17px 600 title with blur on scroll (blur never over text).
   - Pushed screens (Journey, Exercises, Settings, Routine editor, Body metrics, Records, methodology,
     Account, Pro, workout detail, any setup sub-screen) use PushedHeader: back chevron plus parent
     label on the left, no avatar.
   - The avatar appears only on top-level tabs.
4. **Avatar.** 40px circle, `--surface-2`, 1px border, white initials 15px 600. No gradient.
5. **Theme removal (D3, B4).** Remove the theme picker, light tokens and light-only code paths.
6. **Remove marketing copy.**
   - Workout: "Log sets faster than typing them into Notes."
   - History: "Every set exactly as you did it."
   - Routines: "Plans for future workouts. Editing one never changes past workouts." Move it to the
     routine editor as a Meta `--text-2` footnote.
   - Routine editor: "Fitted to your goal, experience and equipment."
   - Journey: "Goals, milestones, photos and recaps: how far you have come."
   - Keep only short factual subtitles: History "2 workouts logged" (real count), Progress
     "Calculated from your logged sets", Exercises "104 exercises" (real count, never hard-coded).
7. **Days (D9, D10).** Short format everywhere except the routine editor day label. Week order follows
   the week-start setting (default Monday). Fix Home starting on Sunday.
8. **Formatters.** Create in `src/lib/format` with unit tests, and use everywhere:
   - **Dates:** "Today", "Yesterday", weekday name for 2 to 6 days ago ("Wednesday"), otherwise
     "Sat, 10 Oct". Add the year when not the current year ("Sat, 10 Oct 2025"). Ranges:
     "11 Sep to 10 Oct", with years on both ends when they differ.
   - **Numbers:** fixed `en-GB` grouping (10,413), max one decimal, no trailing ".0" (62.5, 70).
   - **Weight:** respects kg or lb. Show up to two decimals only when the stored value needs them
     (41.25 stays 41.25, 70.0 shows 70). Converted lb values show max one decimal.
   - **Duration:** live timers "0:12", "12:04", "1:02:10". Summaries "44 min", "1 h 13 min". Rest
     values "2:00".
   - **Labels:** sentence case. Fix "wednesday" to "Wednesday".
9. **Separators.** "×", "to", "·" as in 3.6.
10. **Empty states.** Replace every dashed or oversized empty box with EmptyState.
11. **Gradients and borders.** Remove olive or lime gradients and lime card borders. Mark today or
    active with a small lime-dim Badge only.
12. **Selection, switch, icon tiles.** Replace every chip, segmented control, day selector, toggle and
    icon tile with the shared components. History filter chips are filled, not outlined.
13. **Shared workout row** (Home Recent workouts, History list). 56 × 56 date tile (`--surface-2`,
    radius 16, short day on top in Caption `--text-2`, date number below in Headline), Headline name,
    Meta `--text-2` stats line, one line of Meta `--text-2` exercise preview with ellipsis, chevron.
    Remove the letter tile ("P").
14. **Links.** All text links ("Edit routine", "View in history", "History", "Show as table",
    "Copy last time") become neutral TextLink, `--text-1`, with chevron where it navigates. Not lime.
15. **Threshold constants (D8).** Export every analytics threshold used in copy from the analytics
    module. Add the copy-matches-constants unit test now; later parts use the constants.

---

## 5. Part 3: Home, Routines, Workout

### Home

- Date above the greeting in Meta `--text-2`, greeting in Display.
- **This week ring card.** Keep the existing three metrics. Three rings, 12px thick, 6px gap, round
  caps, tracks `--grid`. Colours lime 100%, lime 60%, lime 30%. Legend rows show label and value, so
  colour is never the only cue. Numbers use Stat, "/5", "/89", "/300" use Meta `--text-2`.
  Title "This week" with Meta "Mon to Sun" (follows the week-start setting).
- **Last 7 days.** Replace dash placeholders with 4px dots in `--text-3` (decorative). Trained = lime
  pill with black check. Missed = dashed outline with ×. Remove the "Planned" legend item if no planned
  day is shown. Footnote inside the card, Meta `--text-2`: "Today only counts once you log it."
- Delete the info card "You completed 2 of 3 planned sessions in the last 7 days."
- **"Pull done" card.** Standard card, lime check badge, stats in a 2 × 2 grid (Meta `--text-2` label
  above, Headline value). "View in history" neutral TextLink with chevron.
- **Strength and Latest record empty states.** EmptyState, one line each, numbers from constants:
  "Trends appear after 3 sessions of a lift in 5 weeks." and "Records appear when you beat an earlier best."
- **Body weight.** Neutral icon. Fewer than 2 points: hide the flat line. Number in Stat, "kg" in Meta,
  "Last logged Wednesday" via the date formatter.
- **Recent workouts.** Shared workout row.
- **Desktop.** Two-column card grid within 1120 max width; Start Workout card stays first.

### Routines

- **Week strip.** 7 equal chips (flex 1, gap 6, radius 12). Short day on top (Caption), session name
  below (Meta 600, one line, shrink to fit down to 85% font size). Never truncate ("Up…" or "Lo…" must
  not appear). Rest day: dashed outline, "Rest" in `--text-2`. Today's chip lime.
- **Active routine card.** Standard card, "Active" lime-dim Badge, "Edit routine" neutral TextLink with chevron.
- **New routine.** `--surface-2`, 52 high, Headline label with plus icon.

### Routine editor

- **Day cards.** Full weekday name in a Caption lime-dim chip ("Thursday") above the session name
  (Title). Replace "Day 1/2/3". Order cards by weekday following the week-start setting.
- **Day selector.** Short day names. Days used by other sessions are dimmed (35% opacity), no
  strikethrough. Selected = white fill.
- **Exercise rows.** Headline name, then chips on one row: "3 × 6 to 8", "RIR 1", "2:00 rest"
  (`--surface-2`, radius 8, 12 horizontal padding, Meta `--text-2`, tabular). Notes like "5° incline"
  are another chip. Wrap to a second line only when needed.
- **Bottom actions.** "Add" (`--surface-2`, plus icon, one line, never wraps) and "Start" as neutral
  SecondaryButton. Editor screens show no more than one lime element.
- Footnote at the bottom, Meta `--text-2`: "Editing a routine never changes past workouts."

### Workout tab

- **Completed today (B1).** "Completed" Badge with "View" (neutral) and "Repeat" (SecondaryButton).
  Do not show "Planned today" or "Start Pull".
- **Session list.** Only the next planned session is expanded with the lime "Start" button. Others
  collapse to a 72px row: name (Headline), "6 exercises · last done Thursday" (Meta `--text-2`),
  chevron, neutral "Start" button on the right. Tapping the row expands inline.
- **Expanded exercise rows.** Name 15px 500 left, "3 × 6 to 8" Meta `--text-2` right with tabular
  digits. Max 4 rows, then a "2 more" TextLink.
- "Edit routine": neutral TextLink.
- **Empty workout.** Standard card with IconTile, Headline, Meta and a neutral button. No dashed border.

---

## 6. Part 4: Progress

### Navigation and section headers

- Sticky jump bar under the title: Strength, Volume, Balance, Consistency, Body. Tap scrolls to the
  section; the bar highlights the section in view. Selection style.
- **Methodology entry (D6).** Directly under the jump bar: a 56px ListRow with neutral IconTile,
  "How every number is calculated" (Headline) and "Formulas and the research behind them" (Meta
  `--text-2`), chevron. Replaces the large blue science card.
- Remove the lime "Evidence" chip everywhere. Each section title gets one 24px neutral InfoButton on
  the right that opens the same sheet or page section as before.
- Section title: Title. Chart card title: Headline. Descriptions: Meta `--text-2`, max two lines.

### Controls and summary cards

- Range chips (7 days, 30 days, 90 days, All time) and the Exercise chip: height 36, selection style.
  Date range line below in Meta `--text-2` via the range formatter.
- **Stat tiles.** 2 × 2, gap 12, `--surface` fill. Label Meta `--text-2`, value Stat, caption Meta
  `--text-2`. Zero or unavailable shows "None yet". Short captions ("Needs 2 weeks", from constants).
- **Insights (D7).** Remove only the insight that duplicates Adherence. Adherence uses the same wording
  and window label as Home ("2 of 3 planned, last 7 days"). Other insights remain as Body rows with a
  neutral icon.
- Drop the "T-bar row, best set each session" subtitle (it repeats the chip).

### Empty states and copy

- Empty chart cards (Estimated 1RM, Top set load, Reps at top load): EmptyState, one line, 88 high.
- **Relative strength.** "0.98" in Stat, "× body weight" Meta `--text-2`, explanation Meta `--text-2`.
- Stalled lifts empty state: "Needs 4 sessions per lift." (from constants)
- Strength levels empty state: one neutral line.
- **Frequency copy.** "Needs at least 7 days of history. 2 h trained so far." (from constants and the duration formatter)
- Records in this period: EmptyState.

### Cards and charts

- Volume and Workouts per week: same x-axis rule, every week label or every second one, never irregular.
- **Balance cards (D5)** (Push and pull, Quads and hamstrings, Upper and lower). Two-segment bar, lime
  vs white 30%. Values on each side (Headline, tabular) and the ratio in Meta `--text-2`
  ("1.2 to 1"). No warning text. Both zero: empty track with "Not enough sets yet".
- **Sets per muscle (D4).** Horizontal bars, 6px, lime fill, `--track`, one fixed scale for all muscles
  (scale max = the larger of 20 sets or the highest muscle this period, stated in the caption). Value
  right-aligned, tabular, with change versus the previous comparable period in Meta `--text-2`
  ("+3 vs last week"). Caption: "Direct sets count 1, supporting sets count 0.5." Muscles with 0
  collapse into one row of neutral chips labelled "Not trained yet".
- **By exercise bars.** 6px high, lime fill, `--track`.
- **Last trained directly.** Shared ListRow, value right-aligned `--text-2`, "Not yet" in `--text-2`.
- **Body weight chart.** Lime line and points, 7-day average white 60%, legend uses lime and white.
  Fewer than 2 points: EmptyState with the latest value. Fix the two overlapping "7 Oct" x-axis labels.
- "Show as table": neutral TextLink with chevron.

**Chart rules (all charts).** Remove all blue and periwinkle. Bars: current period lime, earlier
periods `--border-strong`. Max 4 gridlines at `--grid`, no axis lines. Axis labels Meta `--text-2`,
tabular digits.

**Methodology content update (D4, D5).** Update the muscle workload section to match D4 and remove any
imbalance thresholds. Keep the Evidence Corner wording and DOI links.

---

## 7. Part 5: History, More, Journey, Exercises, Settings

### History

- Remove the stray vertical connector line between cards.
- Range and filter chips (Workout, Exercise, Muscle): height 36, filled. Replace the sliders icon on
  each filter chip with chevron-down. An active filter shows its value ("Exercise: Bench press").
- "This week" in Title, Meta `--text-2` line below: "2 workouts · 29 sets · 10,413 kg" (real values).
- List uses the shared workout row. Keep the 12-week paging with "Show older workouts" as a
  SecondaryButton.
- **Desktop.** List column 720 max, or list plus workout detail side by side at 1280 and wider if it
  fits the existing routing without changes; otherwise keep single column.

### More

- Display "More", no avatar.
- **Profile card.** Avatar 56, name Headline, "Body recomposition · Intermediate" Meta `--text-2`,
  chevron. "Founding member" Badge neutral (`--surface-2`, `--text-2`), crown icon neutral.
- Group rows use IconTile (one style, no colours; Pro row is the only lime-dim tile). Group labels:
  Meta 600 uppercase, 0.05em tracking, `--text-2`.

### Journey

- PushedHeader, no subtitle.
- **Goals.** "Add goal" neutral chip. Goal card: title Headline, deadline Meta `--text-2` right-aligned,
  lime ProgressBar, "Now 63 kg, from 63" Meta `--text-2`, percent on the right (tabular). The info
  note ("A projection needs 4 sessions over 3 weeks of recent data.", from constants) uses Meta
  `--text-2`, not amber.
- **Milestones.** lime-dim circle with lime icon (remove orange gradients). Title Headline, description
  Meta `--text-2`, date moved out of the sentence to the right in Meta `--text-2`.
- **Progress photos.** Front/Side/Back SegmentedControl. Privacy note: lock icon aligned to the first
  line. Empty photo tile: `--surface`, neutral camera icon, "Add front" in `--text-1`.
- **Recaps.** EmptyState.

### Exercises

- PushedHeader. Subtitle "104 exercises" (real count).
- Margins per 3.4. Search: SearchField, `--surface-2`, no border, 44 high. Muscle chips: selection style.
- "More filters": neutral TextLink with sliders icon, opens a BottomSheet.
- **Row.** 40px neutral tile with a 2-letter muscle code (Caption 600 `--text-2`), name Headline,
  "Biceps · Dumbbell" Meta `--text-2`, muscle split Meta `--text-2` on one line, max two muscles,
  ellipsis, never overflowing.
- Section titles ("Recently used", "All exercises"): Title.
- Floating "New" button: lime allowed (primary action), above the tab bar and safe area. List gets
  88px bottom padding.
- Exercise detail and create or edit custom exercise screens: PushedHeader, TextFields, ChipGroups for
  muscles and equipment, SegmentedControl for tracking type, DestructiveButton for delete with ConfirmSheet.

### Settings

- PushedHeader. Group labels (Units, Rest, Training reminders, Your data, Account): Meta 600 uppercase,
  0.05em, `--text-2`. The Appearance group and theme setting are removed (D3).
- Row label Headline size at 500, description Meta `--text-2`.
- SegmentedControl for Weight (kg, lb) and Week starts (Mon, Sun, or the options that exist).
- Switches: shared Switch.
- Value chips ("2:00", "18:00"): `--surface-2`, Headline, tabular. Tapping opens the same stepper and
  presets pattern as Part 6 where it is a duration.
- "Add to calendar" and "Export": neutral SecondaryButton.
- Demo data controls (where shown): SecondaryButtons, "Clear demo data" as DestructiveButton with ConfirmSheet.
- Storage status (persistent storage): ListRow with value in `--text-2`.
- **Copy.** Rewrite "Open the file and add it to your calendar." into one sentence that matches the
  real behaviour after reading the code (for example "Downloads a calendar file with your training
  days. Open it to add them to your calendar."). Ask the owner if the behaviour is unclear.

---

## 8. Part 6: Active workout and pickers

PWA notes: keyboard toolbar in-page via `visualViewport`; haptics via `navigator.vibrate` with a
feature check; screen awake via Wake Lock.

### A. Session header (sticky)

- Left: session name (Headline, white) and below it Meta `--text-2` "0:12 · 0 of 18 sets" (tabular).
- Right: rest timer and pause as 40px circle IconButtons (`--surface-2`, neutral icon). Finish = lime
  pill, 36 high, Headline label, 16px horizontal padding.
- Remove the glow and shadow behind Finish. Nothing lime bleeds into the status bar.
- Background `--bg`, 0.5px bottom divider. Blur only after scroll, never over header text.
- 4px progress bar under the header: lime fill, `--track`, full width, animates 250 ms.
- Verify there is no blank gap (about 120px) above the header on first load.
- Finish with unfinished sets: ConfirmSheet per B3.

### B. Exercise card

- Name: Title. "…" menu: 40px neutral IconButton opening a BottomSheet.
- Line 2 Meta `--text-2`: "Target 3 × 6 to 10 · RIR 2". Line 3 Meta `--text-2`: muscle split, no
  underline, max two muscles.
- "Last time today" becomes "Last: Today" (or "Last: Thu, 8 Oct" via the formatter) in Meta `--text-2`.
  "Copy last time": neutral TextLink with icon.
- "Add set": neutral SecondaryButton, 44 high, radius 12, not a full-width pill.
- Active exercise (first with unfinished sets): 1px `--border-strong`. Others standard.
- All sets done: collapse per B2.

### C. Set rows

Same grid in the header row and every set row:

| Set | Last | kg   | Reps | RIR  | Check |
| --- | ---- | ---- | ---- | ---- | ----- |
| 28  | 72   | flex | flex | flex | 48    |

- Column headers: Caption `--text-2`, centred over inputs. RIR column shows RPE if the user's effort
  setting is RPE, as today.
- Set number: 28px circle, `--surface-2`, `--text-2`. Completed: lime circle, black number. Set types
  other than working show a one-letter Caption label in the circle (W, B, D) as today, or keep the
  existing set-type indicator restyled to tokens.
- **Last column:** "70 × 8" in Meta **`--text-2`** (D1), tabular. Missing: "New" in `--text-2`. Never
  a lone dot. Rows that only have a suggestion (no real history) keep the existing "suggestion" label
  so history is never faked.
- **Inputs.** 52 high, radius 12, `--surface-2`, Title size, tabular. Suggested (prefilled, not edited)
  values in `--text-3` (allowed, Title size). Edited or ticked: `--text-1`.
- **Check button.** 48 × 48, radius 12, `--surface-2` with a `--text-2` check. Pressed: scale 0.92.
  Completed: lime fill, black check scaling 0.8 to 1 over 200 ms, row background `--lime-dim`.
  Tapping again un-completes. One-tap completion from suggested values must keep working.
- **Keyboard toolbar.** kg: "−2.5" and "+2.5". Reps and RIR: "−1" and "+1". Plus "Next". Buttons 44
  high, `--surface-2`, Headline, tabular.
- Ticking a set starts the rest countdown when the existing setting allows. Medium haptic on set logged.

### D. Rest countdown

- Floating bar above the tab bar (or above the bottom safe area when no tab bar is shown in the active
  workout): `--surface-2`, radius 999, 56 high, 16 margin. Time remaining in Stat (tabular), "−15" and
  "+15" 40px buttons, "Skip" neutral TextLink. A 3px lime line along the bottom edge drains.
- Timing uses the stored end timestamp, never a counting interval alone (existing behaviour).
- At zero: **medium haptic** (D12) plus existing sound and vibration settings. The bar shows "Go" for
  1 s, then slides away (250 ms).
- The header timer icon opens the same controls in a BottomSheet.

### E. "How do you feel today" card

- Three rows (Sleep, Energy, Soreness). Label Headline, endpoint labels right in Meta `--text-2`
  ("1 Poor, 5 Great"), below it a 5-segment control, 40 high, one rounded container, selection style.
- Save disabled until one answer is chosen (`--surface-2` fill, `--text-3` label, disabled
  semantics). Enabled: lime PrimaryButton, 44.
- X closes it. After saving it collapses to "Check-in saved" with an "Edit" TextLink. Starts collapsed
  on later visits and never pushes the first exercise off screen.
- Subjective inputs stay labelled as self-reported wherever they appear.

### F. Exercise settings sheet (Target RIR, Rest, Bench angle)

**Layout.** BottomSheet. Header: exercise name (Title), Meta `--text-2` subtitle
"3 × 6 to 8 · RIR 0.5 · 3:00 rest". Remove "Changes save as you go." and show a small "Saved" check
(Meta `--text-2`) fading in for 1 s after each change. Section labels Meta 600 uppercase `--text-2`,
sections 24 apart. Pinned lime "Done", 52 high. The RIR footnote sits above it in Meta `--text-2`,
never clipped.

**Target RIR.** Stepper with value in Stat, step 0.5, range 0 to 5. Chips below: 0, 0.5, 1, 1.5, 2, 3
(selection style). Light haptic per change.

**Rest after each set (replaces both wheels).**

- Big time centred (Stat, tabular), "2:00".
- "−15s" and "+15s" 48px circle buttons either side. Long press repeats and accelerates after 1 s.
  Range 0:15 to 10:00.
- Preset chips, 4 × 2 grid: 0:45, 1:00, 1:30, 2:00, 2:30, 3:00, 4:00, 5:00. Selected = white fill. No
  chip selected if the value matches none.
- Tapping the time opens a numeric keypad: typing "230" gives 2:30, "45" gives 0:45. Validate and clamp
  on Done.
- Meta `--text-2`: "Default is 2:00" with "Use default" TextLink. Second line: "Applies to every set of
  this exercise."

**Bench angle (replaces the wheel).**

- Header row: label left, "Clear" TextLink right.
- Big "5°" (Stat) with Meta label under it: "Flat" at 0, "Incline" above 0 (and "Decline" below 0
  only if the existing range allows negatives).
- "−5°" and "+5°" 48px circle buttons, long press repeats, light haptic per step. Keep the existing
  allowed range (default 0 to 90).
- SVG bench diagram, 160 × 56: base line white 30%, bench line lime rotating about its pivot to the
  chosen angle, arc with the degree. Rotation animates 200 ms.
- Preset chips: Flat, 15°, 30°, 45°, 60°, 90°.
- Tapping the number opens a numeric keypad for an exact integer.
- No angle set: "Not set" in `--text-2` with an "Add angle" SecondaryButton; adding starts at 30°.

**All other in-workout sheets** (add exercise, replace exercise, set menu, reorder, notes, set type)
use BottomSheet and the shared components with no other visual rules.

### G. Quality

- Screen stays awake during an active workout.
- Inputs are never hidden by the keyboard, and the toolbar stays visible.
- Tap targets 44 minimum, set check 48.
- `prefers-reduced-motion`: instant state changes, no auto-scroll animation (jump instead).
- Report anything that could not be mapped to a token.

---

## 9. Part 7: Everything else

Apply the same rules to every remaining screen and state. Read each screen's code first and keep all
behaviour and copy meaning.

### Account and auth

- Screens: sign in, create account, forgot password, reset password, email confirmation sent,
  confirm-your-email error, signed-in account page.
- Layout: centred column, max width 400, margins per 3.4. App name "Overload" in Title at the top,
  screen title in Display, one-line Body `--text-2` subtitle.
- Fields: TextField and PasswordField, 52 high. Errors inline under the field (Meta `--danger` with
  icon) and a form-level InlineNotice for server errors. Keep all existing messages ("Confirm your
  email first", expired link, wrong password), restyled only.
- Primary action full-width PrimaryButton 52. Secondary actions as TextLinks ("Forgot your password?",
  "Create an account").
- Email sent state: IconTile with mail icon, Headline, Meta `--text-2` with the email address, "Open
  mail" is not offered (no reliable deep link), "Resend" TextLink if it exists.
- Account page: ListRows for email, sync status, sign out (DestructiveButton style text with
  ConfirmSheet that keeps the existing "unsynced data stays on this device" message).
- Guest-data import offer on sign-in: ConfirmSheet with the existing wording.

### Workout summary

- PushedHeader-free full screen with a lime "Done" PrimaryButton pinned at the bottom.
- Top: Meta `--text-2` date and duration, workout name in Display.
- 2 × 2 StatTiles: duration, sets, volume load, exercises (only metrics that are meaningful, as today).
- **Records celebration.** Card with lime-dim background and lime trophy icon tile, "2 new records"
  (Title), rows per record: exercise (Headline), value (Headline, tabular) and "Estimated 1RM" or
  "Heaviest load" label (Meta `--text-2`). Entrance: fade and scale 0.96 to 1 over 400 ms, then a
  success haptic once. No confetti. Reduced motion: instant.
- Comparison lines ("vs last Pull", "vs earlier today"): Meta `--text-2` with neutral up or down icon.
- **Sync line** at the bottom: SyncStatus component with link to details.

### Workout detail (from History)

- PushedHeader with parent "History". Title = workout name (Title), Meta date and duration.
- StatTiles row (sets, volume, duration).
- One card per exercise: name Headline, read-only set grid using the Part 6 columns minus the check
  (Set, kg, Reps, RIR), set numbers `--surface-2` with `--text-2` (no lime flood in history), set-type
  letters as in Part 6. Records in this workout get a small lime-dim "Record" Badge.
- Notes: Body `--text-2` in a nested `--surface-2` block.
- Edit and delete actions as they exist today, delete via DestructiveButton and ConfirmSheet.

### Records

- PushedHeader. Filter chips (selection style) for muscle or exercise if they exist.
- ListRows: exercise name (Headline), date (Meta `--text-2`), value right (Headline, tabular) with its
  label beneath ("Heaviest load" or "Estimated 1RM"). Actual and estimated values are never mixed in
  one column without labels. "New" lime-dim Badge for records in the last 7 days.

### Body metrics

- PushedHeader. Current weight card: Stat number, "kg" Meta, change versus previous in Meta `--text-2`,
  7-day average line when enough data exists.
- Chart per Part 8 rules. "Add weight" PrimaryButton opens a BottomSheet with NumberField, date field
  and unit shown from settings.
- Body measurements list: ListRows (measurement, latest value right, date Meta). Add or edit via
  BottomSheet. Delete via ConfirmSheet.
- No health judgements and no "ideal" language, as today.

### Methodology ("How every number is calculated")

- PushedHeader titled "How every number is calculated".
- Top: a jump list of metrics as ListRows inside one card.
- One Card per metric: name (Title), "What it shows" (Body), formula in a nested `--surface-2` block
  (Body, tabular, formula on its own line), "Why this way" (Body `--text-2`), "What it means for you"
  (Body), "Limits" (Meta `--text-2`), "Sources" as TextLinks with external icon to the DOI.
- Definition-type metrics show a neutral "Definition" Badge and no sources.
- Section InfoButtons elsewhere deep-link to the matching card here.

### Pro page

- PushedHeader. States: trial, expired, Pro (founding member), payments not open, payment pending.
- Status card: Badge ("Trial · 5 days left" lime-dim; "Pro" lime-dim; "Trial ended" neutral), Title
  headline, Meta `--text-2` with the exact end date via the formatter.
- "Included" list: ListRows with a neutral check icon (`--text-1`), not lime.
- Line in Meta `--text-2`: "Your workout history always stays free."
- **UPI flow.** Price in Stat with "/ 30 days" Meta (values from config). Steps numbered with 28px
  `--surface-2` circles. UPI ID row with copy IconButton (Toast "UPI ID copied"). "Open a UPI app"
  PrimaryButton. Transaction reference TextField, "Submit reference" SecondaryButton. Pending state
  InlineNotice. Never ask for PIN or bank details (as today).
- Payments not open: InlineNotice with the existing message.

### Setup, tour and goals (October update)

- **Setup.** Progress indicator at top: segmented 4px bars, lime for done and current, `--track` for
  upcoming. Question in Display, one-line Body `--text-2`. Options as OptionCards (selection rule:
  white fill, black text when selected), 56 high minimum. Pinned "Continue" PrimaryButton, disabled
  until valid. "Skip" TextLink where skipping exists.
- **Tour.** Coach marks: `--surface-2` card, radius 16, Body text, step "2 of 5" Meta `--text-2`,
  "Next" and "Skip tour" TextLinks. Backdrop `--overlay` with the highlighted element cut out and a
  2px white outline. Escape and Skip end the tour.
- **Goals.** Use the Journey goal card. Add or edit goal in a BottomSheet with TextField, NumberField,
  date and ChipGroup for goal type.

### System UI and states

- **SyncStatus.** One component used on the summary, account page and anywhere else it appears. Icon
  plus Meta `--text-2` text, exact existing wording: "Saved on this device", "Syncing",
  "Synced to your account", "Offline. 1 change saved on this device", "Could not reach your account".
  Icons neutral; error state icon in `--warning`. Never lime.
- **Demo data pill.** Badge, `--surface-2`, Caption 600 `--text-2`, "Demo data", 44px hit area via
  the existing `tap-target` utility.
- **New version banner.** Floating card like a Toast but persistent: "A new version is ready" (Body)
  with "Reload" SecondaryButton (compact). Never shown over an active workout's set rows; keep the
  current rule that nobody is interrupted mid-workout.
- **Offline messages.** InlineNotice with cloud-off icon, existing wording.
- **Confirm dialogs.** Every confirm uses ConfirmSheet.
- **Error states.** Every screen-level error uses ErrorState with "Try again". Route error boundary
  and the stale-chunk reload screen restyled to match.
- **Toasts.** Every toast uses the shared Toast.
- **Loading.** Spinners replaced in Part 8.

### Sheet audit

List every sheet, popover, menu and dialog in the app and confirm each uses BottomSheet, ConfirmSheet
or Dialog. Report the list in the part summary.

### Desktop audit

Check every screen at 1024 and 1440: sidebar, margins and max widths per 3.4, sheets as Dialogs, no
stretched single-column mobile layouts where a two-column grid is specified (Home, Progress). Active
workout stays a single centred column, max width 640.

---

## 10. Part 8: Feel (motion, haptics, loading, charts)

Do not swap chart libraries unless the spec cannot be met; report first if you must.

### Motion

Easing `cubic-bezier(0.2, 0, 0, 1)`. No bounce.

| Interaction                                       | Duration                        |
| ------------------------------------------------- | ------------------------------- |
| Press                                             | 150 ms                          |
| Transitions, sheets, collapse                     | 250 ms                          |
| Ring and chart fills                              | 600 ms                          |
| Number count-up (once, tabular during count, D11) | 400 ms                          |
| Tab switch                                        | 150 ms cross-fade, no slide     |
| Checkmark completion                              | 200 ms, scale 0.8 to 1          |
| Records celebration                               | 400 ms fade and scale 0.96 to 1 |

- Rings and charts animate from zero once per session. Numbers count up once per session.
- Lists: items fade in with a 30 ms stagger, first 6 only.
- `prefers-reduced-motion`: all of the above become instant.

### Haptics

| Level   | Pattern    | Triggers                                             |
| ------- | ---------- | ---------------------------------------------------- |
| Light   | 10 ms      | Tab change, chip select, switch toggle, stepper step |
| Medium  | 20 ms      | Set logged, rest countdown end (D12)                 |
| Success | 15, 40, 15 | Workout finished, new record                         |

- Feature-detected, never throws, never on scroll. Without vibrate (iOS), the visual feedback stands alone.
- Respect any existing vibration setting.

### Loading

- No spinners on screens. Skeletons in `--surface-2` with a 1.2 s shimmer (white 4% band) and the exact
  final dimensions, zero layout shift. Buttons that submit may show a 16px inline spinner in their own
  label colour.
- Pull to refresh: only if it exists; custom indicator in `--text-2`.

### Charts

- Line: 2px lime, round joins, area fill lime 18% to 0% vertical gradient.
- Max 4 gridlines at `--grid`, no axis lines or borders.
- Axis labels Meta `--text-2`, tabular.
- Last point: 8px lime dot with a 3px `--bg` (or card surface) ring.
- Tooltip: press and hold (or hover on desktop) shows `--surface-2`, radius 12, Headline value plus Meta
  date. Keyboard accessible where the chart is focusable, and "Show as table" stays available.
- Bars: 6px top radius, 16px gap, current period lime, earlier periods `--border-strong`.

---

## 11. Part 9: Final QA and merge readiness

1. Full test sweep (section 12) plus the 32-step journey from the QA report, on the redesigned UI.
2. Visual pass at 360, 390, 430, 820, 1024 and 1440 px: no overflow, no truncation of week strip
   names, no text below 4.5:1 where it carries information.
3. Token audit: grep for hex colours, `px` font sizes, `box-shadow`, `blue`, gradient and light-theme
   leftovers outside the token file. Report results.
4. Copy audit: no em dashes, exclamation marks, emoji or marketing phrases. Sentence case everywhere.
5. Bundle check: report first-load gzipped size before and after. Fonts must not add more than about
   60 KB to the first visit (only 400 and 600 preloaded).
6. Performance: one set tap still about 0.1 s with two years of data (QA benchmark).
7. Write `docs/ui-redesign-report.md`: what changed per part, anything not applied and why, open questions.
8. Bump the service worker cache, commit "ui: part 9", stop. The owner merges into `phase-2-wip`.

---

## 12. Test requirements (every part)

- **Always run:** typecheck, lint (0 warnings), unit tests, Playwright, production build.
- **Update, do not delete:** Playwright tests that break because of copy or structure changes are
  updated to the new UI. Prefer role and label selectors over text and CSS selectors.
- **Accessibility:** axe WCAG 2.1 A and AA on every screen and sheet, dark theme only, 0 violations.
  Light-theme runs are removed (D3).
- **New unit tests:** formatters (dates, numbers, weight with 2-decimal cases, durations); copy
  matches analytics constants (D8); adherence counts a repeated planned day once (B1); rest keypad
  parsing ("230" to 2:30, "45" to 0:45, clamping 0:15 to 10:00); bench angle clamp; RIR stepper range
  and step; week start respected by week strip helpers (D9).
- **New browser tests:** finish confirm sheet with discard and keep rules (B3); collapse without
  auto-scroll when an input is focused (B2); completed-today state with View and Repeat (B1); theme
  setting absent and app dark with a stored light preference (B4); "Last" column readable and never a
  lone dot; keyboard toolbar steps; rest bar Skip and ±15.
- **Never regress:** offline logging, sync status honesty, one-tap completion from last time,
  previous-performance accuracy, demo blocked in accounts.

---

## 13. Definition of done (end of every part)

1. All tests in section 12 pass.
2. Production build passes (including the secret and override check).
3. Service worker cache version bumped.
4. Report: files changed, pass or fail per numbered item in the part, anything not applied and why,
   conflicts with existing behaviour, values that could not be mapped to a token.
5. Commit `ui: part N` on `ui-premium`. Push if the GitHub App allows it.
6. Stop and wait for the owner.
