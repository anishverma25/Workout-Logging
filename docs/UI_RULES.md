# Overload UI rules

The standing visual rules for every screen, sheet and state. Copied from sections 3.1 to 3.6 of
`docs/UI_REDESIGN_BRIEF.md` (Part 1). Read this file and the brief at the start of every
redesign session.

Implementation notes:

- Tokens live in `src/styles/tokens.css`. Tailwind exposes them as utilities: `bg-surface`,
  `bg-surface-2`, `bg-bar`, `text-text-1`, `text-text-2`, `text-text-3`, `bg-lime`,
  `bg-lime-dim`, `text-on-lime`, `border-border`, `border-border-strong`, `bg-track`,
  `bg-overlay`, `text-warning`, `text-danger`, `text-danger-text`.
- Type styles are utilities: `type-display`, `type-stat`, `type-title`, `type-headline`,
  `type-body`, `type-meta`, `type-caption`.
- Radii: `rounded-tile` (10), `rounded-field` (12), `rounded-nested` (16), `rounded-panel` (24),
  `rounded-full` (pills).
- Breakpoints: `tab:` from 600px, `lg:` from 1024px.
- Shared components live in `src/components/kit` (import from `@/components/kit`).
- `--danger-text` (`#FF6B5E`) is the one addition to the token table: `--danger` (`#FF453A`)
  measures 4.1:1 on `--surface-2`, below AA for 17px text, so destructive text and field
  errors use `--danger-text` (5.0:1). `--danger` stays for icons and fills.
- Legacy tokens (`--text`, `--text-muted`, `--accent`, `--tile-*`, `--ring-*`...) remain only
  until every screen moves to the kit (Parts 2 to 7). New code never uses them.

## 3.1 PWA rules

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

## 3.2 Type scale

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

## 3.3 Colour tokens (dark only)

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

## 3.4 Spacing and shape

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

## 3.5 One-off rules

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

## 3.6 Separators and formats

- "×" for sets by reps (3 × 8), "to" for ranges (6 to 8), "·" between meta items.
- Formatters are defined in Part 2 and used everywhere.
