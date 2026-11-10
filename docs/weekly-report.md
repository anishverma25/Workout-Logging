# Weekly report (Pro, November 2026)

The weekly intelligence report reads a person's training and food together, once a week.
Design and decisions: Project docs `claude/weekly-intelligence-spec.md` and
`claude/weekly-intelligence-preview.html`.

## How it works

- **Engine.** `weeklyReport(input)` in `src/domain/analytics/weekly.ts` is a pure function that
  returns serialisable JSON. It covers counts, pillars, the verdict (English and Hinglish), the
  win of the week, tiles against the 4 week average, the days, 8 week lifts, muscles, body,
  energy, nutrition, findings, up to three actions with checks, last week's checks and the
  optional inputs. Unit tests are in `weekly.test.ts`.
- **Rules.** The rules are explained on the science page (topic `weekly-report`):
  - a lift moves when e1RM changes 5% over 4 weeks;
  - weight uses the 7 day mean;
  - the cut band is 0.5 to 1% a week;
  - a calorie day is within 10% of target, and a protein day reaches 90% of it;
  - protein per meal is 0.4 g per kg, fibre 14 g per 1,000 kcal, and training day carbs from
    4 g per kg;
  - 7,700 kcal is treated as 1 kg.

  The Fisher exact test (checked against scipy) only gates early signals. No probability is shown.
- **Thin weeks.** A report needs 2 workouts or 3 food days. Parts with too little data are
  left out.
- **Words.** The words come from fixed templates (English and Hinglish), never from AI.

## One report a week

- Migration `supabase/migrations/20261110000021_weekly_reports.sql` adds the `weekly_reports`
  table. RLS is forced, there are no policies and no direct access.
- `claim_weekly_report(p_id, p_week_start, p_report)` does four things:
  - checks Pro (`community_is_pro`);
  - checks the week start is a Monday or a Sunday;
  - checks the week is open by the **server** clock (from the start of the week's last day,
    UTC+14, until 8 days after it ends);
  - inserts once. A second call returns the first row with `created: false`.
- `get_my_weekly_reports(limit)` is never gated, so past reports stay readable after Pro ends.
- Tests: `src/data/sync/weeklyReports.test.ts` (PGlite with the real migrations).
- App side: `src/app/weeklyReport.ts`.
  - `reportWindow` opens a week at 6 pm on its last day, and last week stays open the following
    week.
  - `fetchReports` and `claimReport` call the RPCs.
  - A copy of the last 12 reports is cached in localStorage (`overload.reports.<account>`) so
    they open offline.
  - Storage is the server plus this cache, not a Dexie table, so Dexie stays at its version.

## Screens

- **Report page.** `/report` (`features/report/ReportPage.tsx`) is linked from More and the
  desktop sidebar.
  - States: ready to make, not enough logged, made (shows the report), and Pro only. Free
    members get `ProLock` with their own counts and keep past reports.
- **Report view.** `ReportView.tsx` has a Quick summary and a Full report, and English or
  Hinglish. The choice is remembered on the phone.
  - Fonts: Bricolage Grotesque, DM Sans and DM Mono, loaded lazily (`share/story/fonts.ts`) and
    never precached (`LAZY_FONTS`).
  - Colours: tokens `--report-food` and `--report-body`.
- **PDF.** `features/report/pdf/` holds the PDF code. pdf-lib and fontkit are a lazy chunk, and
  the WOFF fonts are fetched on download.
  - `pack.ts`: our own pagination. Blocks are never split, a heading travels with its first
    block, a whole section moves to the next page when the current page is 80% full, and
    captions are merged into the block above.
  - `svg.ts`: draws the screen's own SVG charts as vectors.
  - `theme.ts`: Dark and Print friendly palettes, with a contrast test (4.5 to 1 for text, 3 to
    1 for marks).
  - `makePdf.ts`: A4, a cover page, a header and "Page X of Y" footer on every page, and
    embedded subset fonts.
  - `makePdf.test.ts` renders four variants plus a thin week. It then checks with `pdftotext`
    that each section heading sits on exactly one page, and that Full is 5 to 9 pages and
    Quick is at most 4. Set `REPORT_PDF_OUT=dir` to keep the files and look at them.
- **Download.** `DownloadSheet.tsx` uses Web Share with the PDF file when it can, otherwise it
  saves the file.

## Development note

`build/seo.ts` starts a short-lived Vite server to render the science page. It now uses its
own `cacheDir` (`node_modules/.vite-seo`). Sharing the cache made the dev server serve stale
pre-bundled files. `vite.config.ts` pre-bundles `pdf-lib`, `@pdf-lib/fontkit` and
`react-dom/server` for development.

## E2E

`tests/e2e/report.spec.ts` covers:

- making the report once;
- no second report, even with the phone's copy cleared;
- opening offline;
- Hinglish and the full report at 360 px;
- the Quick PDF download (`%PDF-` header);
- readable after Pro ends;
- the free member's lock.

`/report` is also in `devices.spec.ts`.
