import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont } from 'pdf-lib';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MARK_LIME, MARK_WHITE } from '@/app/brandPaths';
import type { WeeklyReport } from '@/domain/analytics/weekly';
import {
  DISCLAIMER,
  energyNote,
  firstSentence,
  fmt,
  foodRows,
  LiftChart,
  madeLabel,
  MealChart,
  MEAL_SUMMARY,
  METHOD_TEXT,
  MuscleChart,
  rangeLabel,
  ringArc,
  sectionCopy,
  SOURCES,
  TILE,
  tileNote,
  Timeline,
  WeightChart,
  plural,
  type ReportLang,
  type ReportMode,
} from '../ReportView';
import { packPages } from './pack';
import { box, chart, colorOf, custom, fillRect, grid, row, rule, spacer, text, vstack, type Ctx, type Node, type Run } from './layout';
import type { SvgFonts } from './svg';
import { PDF_THEMES, type PdfTheme, type PdfThemeName } from './theme';

/**
 * The weekly report as an A4 PDF (spec `claude/weekly-intelligence-spec.md`, PDF quality rules):
 * real text in embedded fonts, the screen's charts as vectors, our own pagination that never
 * splits a block, a cover page, and the same header and footer on every page.
 */

export const A4 = { w: 595.28, h: 841.89 };
export const MARGIN = 40;
const CONTENT_TOP = 62;
const CONTENT_BOTTOM = 44;
export const CONTENT_W = A4.w - MARGIN * 2;
const SECTION_GAP = 24;
export const CONTENT_H = A4.h - CONTENT_TOP - CONTENT_BOTTOM;

export interface PdfFontBytes {
  display600: ArrayBuffer | Uint8Array;
  display800: ArrayBuffer | Uint8Array;
  sans400: ArrayBuffer | Uint8Array;
  sans600: ArrayBuffer | Uint8Array;
  mono400: ArrayBuffer | Uint8Array;
  mono500: ArrayBuffer | Uint8Array;
}

export interface PdfOptions {
  report: WeeklyReport;
  number: number;
  mode: ReportMode;
  lang: ReportLang;
  theme: PdfThemeName;
  fonts: PdfFontBytes;
}

interface Fonts extends SvgFonts {
  display600: PDFFont;
  sans600: PDFFont;
}

/** Characters the fonts lack are swapped for a near match, else left out (never a box). */
const SWAPS: Record<string, string> = { '₹': 'Rs ', '✓': '', '×': 'x', '—': ', ', '…': '...' };

function cleaner(fonts: PDFFont[]) {
  const sets = new Map(fonts.map((f) => [f, new Set(f.getCharacterSet())]));
  return (font: PDFFont, s: string) => {
    const set = sets.get(font);
    if (!set) return s;
    let out = '';
    for (const ch of s) {
      if (ch === '\n' || set.has(ch.codePointAt(0)!)) out += ch;
      else if (SWAPS[ch] !== undefined) out += [...SWAPS[ch]!].filter((c) => set.has(c.codePointAt(0)!)).join('');
    }
    return out;
  };
}

const svgOf = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

function ringMarkup(value: number, of: number, color: string) {
  const arc = ringArc(40, 40, 30, of > 0 ? value / of : 0);
  return `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="none" stroke="var(--track)" stroke-width="7"></circle>${
    arc ? `<path d="${arc}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"></path>` : ''
  }<text x="40" y="47" text-anchor="middle" font-size="19" style="font-family:Bricolage">${value}/${of}</text></svg>`;
}

export async function makeReportPdf(o: PdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const embed = (b: ArrayBuffer | Uint8Array) => doc.embedFont(b instanceof Uint8Array ? b : new Uint8Array(b), { subset: true });
  const [display600, display800, sans400, sans600, mono400, mono500] = await Promise.all([
    embed(o.fonts.display600),
    embed(o.fonts.display800),
    embed(o.fonts.sans400),
    embed(o.fonts.sans600),
    embed(o.fonts.mono400),
    embed(o.fonts.mono500),
  ]);
  const fonts: Fonts = {
    display: display800,
    display600,
    sans: sans400,
    sans600,
    mono: mono400,
    monoBold: mono500,
    clean: cleaner([display600, display800, sans400, sans600, mono400, mono500]),
  };
  const t = PDF_THEMES[o.theme];
  const r = o.report;
  const range = rangeLabel(r);

  doc.setTitle(`Macrotrophy weekly report, ${range}`);
  doc.setAuthor('Macrotrophy');
  doc.setCreator('Macrotrophy');
  doc.setProducer('Macrotrophy');
  doc.setLanguage('en-IN');

  const blocks = buildBlocks(r, o, t, fonts);
  const pages = packPages(
    blocks.map((b) => ({ height: b.node.height(CONTENT_W), section: b.section, heading: b.heading, breakBefore: b.breakBefore })),
    { pageHeight: CONTENT_H, gap: 12, sectionGap: SECTION_GAP },
  );

  pages.forEach((indexes, p) => {
    const page = doc.addPage([A4.w, A4.h]);
    const c: Ctx = { page, theme: t, fonts };
    page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: colorOf(t.page) });
    const cover = p === 0;
    if (!cover) header(c, range, fonts);
    footer(c, p + 1, pages.length, r, fonts);
    let y = cover ? 44 : CONTENT_TOP;
    indexes.forEach((i, k) => {
      const b = blocks[i]!;
      if (k) y += b.section !== blocks[indexes[k - 1]!]!.section ? SECTION_GAP : 12;
      b.node.draw(c, MARGIN, y, CONTENT_W);
      y += b.node.height(CONTENT_W);
    });
  });

  return doc.save();
}

function drawMark(c: Ctx, x: number, top: number, size: number) {
  fillRect(c, x, top, size, size, size * 0.22, c.theme.markTile);
  const s = (size * 3.7) / 512;
  const opts = { x: x + size / 2, y: c.page.getHeight() - (top + (size * 262) / 512), scale: s };
  c.page.drawSvgPath(MARK_WHITE, { ...opts, color: colorOf(c.theme.markWhite) });
  c.page.drawSvgPath(MARK_LIME, { ...opts, color: colorOf(c.theme.markLime) });
}

function header(c: Ctx, range: string, f: Fonts) {
  const top = 22;
  drawMark(c, MARGIN, top, 18);
  const H = c.page.getHeight();
  c.page.drawText('Macrotrophy', { x: MARGIN + 25, y: H - top - 13.5, size: 12.5, font: f.display, color: colorOf(c.theme.text1) });
  const right = f.clean(f.mono, `Weekly report, ${range}`);
  const w = f.mono.widthOfTextAtSize(right, 9);
  c.page.drawText(right, { x: A4.w - MARGIN - w, y: H - top - 12.5, size: 9, font: f.mono, color: colorOf(c.theme.text2) });
  c.page.drawLine({ start: { x: MARGIN, y: H - 50 }, end: { x: A4.w - MARGIN, y: H - 50 }, thickness: 0.8, color: colorOf(c.theme.divider) });
}

function footer(c: Ctx, n: number, total: number, r: WeeklyReport, f: Fonts) {
  const y = 26;
  const left = f.clean(f.mono, `Made ${madeLabel(r.madeAt)}`);
  c.page.drawText(left, { x: MARGIN, y, size: 9, font: f.mono, color: colorOf(c.theme.text3) });
  const right = `Page ${n} of ${total}`;
  const w = f.mono.widthOfTextAtSize(right, 9);
  c.page.drawText(right, { x: A4.w - MARGIN - w, y, size: 9, font: f.mono, color: colorOf(c.theme.text2) });
}

interface Block {
  node: Node;
  section: string;
  heading?: boolean;
  breakBefore?: boolean;
}

function buildBlocks(r: WeeklyReport, o: PdfOptions, t: PdfTheme, f: Fonts): Block[] {
  const full = o.mode === 'full';
  const copy = sectionCopy(r);
  const c = r.counts;
  const range = rangeLabel(r);
  const run = (s: string, font: PDFFont, size: number, color: string): Run => ({ text: s, font, size, color });
  const T = (s: string, font: PDFFont, size: number, color: string, extra?: { align?: 'left' | 'center' | 'right'; lineHeight?: number }) =>
    text([run(s, font, size, color)], { fonts: f, ...extra });
  const body = (s: string, color = t.text2) => T(s, f.sans, 10, color);
  const small = (s: string) => T(s, f.sans, 9, t.text3);
  const panel = (child: Node, fill = t.surface) => box(child, { fill, radius: 14, pad: 16 });
  const out: Block[] = [];
  const add = (section: string, node: Node, extra?: Partial<Block>) => out.push({ node, section, ...extra });
  // A caption or footnote travels with the block above it, never alone on a page.
  const note = (section: string, node: Node) => {
    const last = out[out.length - 1];
    if (last && last.section === section && !last.heading) last.node = vstack([last.node, node], 10);
    else add(section, node);
  };
  const heading = (section: string, h: { eyebrow: string; title: string; intro?: string }, breakBefore = false) =>
    add(
      section,
      vstack(
        [
          T(h.eyebrow, f.mono, 9, t.text3),
          T(h.title, f.display, 22, t.text1, { lineHeight: 1.15 }),
          h.intro ? body(h.intro) : null,
        ],
        5,
      ),
      { heading: true, breakBefore },
    );
  const dot = (color: string, size = 6): Node =>
    custom(size, (cx, x, top) => cx.page.drawCircle({ x: x + size / 2, y: cx.page.getHeight() - top - size / 2, size: size / 2, color: colorOf(color) }));
  const pillWidth = (label: string) => f.mono.widthOfTextAtSize(f.clean(f.mono, label), 9) + 26;
  const liftTag = (l: WeeklyReport['lifts'][number]) => `${l.pct > 0 ? '+' : ''}${l.pct}% ${l.real ? (l.pct > 0 ? 'gain' : 'drop') : 'noise'}`;
  const pill = (label: string, color: string): Node => {
    const size = 9;
    const w = pillWidth(label);
    return custom(17, (cx, x, top) => {
      fillRect(cx, x, top, w, 17, 8.5, cx.theme.surface, cx.theme.divider);
      cx.page.drawCircle({ x: x + 9, y: cx.page.getHeight() - top - 8.5, size: 2.5, color: colorOf(color) });
      cx.page.drawText(f.clean(f.mono, label), { x: x + 16, y: cx.page.getHeight() - top - 12, size, font: f.mono, color: colorOf(color) });
    });
  };
  const tick = (done: boolean): Node =>
    custom(18, (cx, x, top) => {
      const H = cx.page.getHeight();
      cx.page.drawCircle({ x: x + 9, y: H - top - 9, size: 9, color: colorOf(cx.theme.surface2) });
      const col = colorOf(done ? cx.theme.up : cx.theme.danger);
      if (done) cx.page.drawSvgPath('M-3.6 0.2 L-1.1 2.8 L3.8 -2.6', { x: x + 9, y: H - top - 9, borderColor: col, borderWidth: 1.6 });
      else cx.page.drawSvgPath('M-3 -3 L3 3 M3 -3 L-3 3', { x: x + 9, y: H - top - 9, borderColor: col, borderWidth: 1.6 });
    });
  const numberDot = (n: number, size = 22): Node =>
    custom(size, (cx, x, top) => {
      const H = cx.page.getHeight();
      cx.page.drawCircle({ x: x + size / 2, y: H - top - size / 2, size: size / 2, color: colorOf(cx.theme.lime) });
      const s = String(n);
      const fs = size * 0.52;
      const w = f.display.widthOfTextAtSize(s, fs);
      cx.page.drawText(s, { x: x + (size - w) / 2, y: H - top - size / 2 - fs * 0.36, size: fs, font: f.display, color: colorOf(cx.theme.onLime) });
    });
  const keyRows = (rows: [string, string][]) =>
    vstack(
      rows.flatMap(([k, v]) => [rule('divider', 4), row([{ node: T(k, f.mono, 9, t.text3), width: 96 }, { node: body(v), width: 'flex' }], 10)]),
      2,
    );

  // Cover ------------------------------------------------------------------------------------
  const brand = custom(34, (cx, x, top) => {
    drawMark(cx, x, top, 34);
    cx.page.drawText('Macrotrophy', { x: x + 44, y: cx.page.getHeight() - top - 24, size: 21, font: f.display, color: colorOf(cx.theme.text1) });
    const label = 'Weekly intelligence';
    const w = f.mono.widthOfTextAtSize(label, 9.5);
    cx.page.drawText(label, { x: x + CONTENT_W - w, y: cx.page.getHeight() - top - 21, size: 9.5, font: f.mono, color: colorOf(cx.theme.text2) });
  });
  const pillars = grid(
    (
      [
        ['Training', r.pillars.training, t.lime],
        ['Nutrition', r.pillars.nutrition, t.food],
        ['Body', r.pillars.body, t.body],
      ] as const
    ).map(([k, p, col]) =>
      box(
        vstack(
          [
            row([{ node: dot(col, 7), width: 7 }, { node: T(k, f.sans, 9.5, t.text2), width: 'flex' }], 6, 'center'),
            T(p.label, f.display, 15, t.text1, { lineHeight: 1.15 }),
            T(p.detail, f.sans, 9, t.text3),
          ],
          6,
        ),
        { fill: t.surface, radius: 12, pad: 12 },
      ),
    ),
    3,
    8,
  );
  add(
    'cover',
    vstack(
      [
        brand,
        spacer(30),
        T(`Report ${o.number}`, f.mono, 11, t.limeText),
        T(range, f.display, 50, t.text1, { lineHeight: 1.02 }),
        T(
          `Made ${madeLabel(r.madeAt)}, from ${c.sessions} ${plural(c.sessions, 'workout')}, ${c.foodDays} food ${plural(c.foodDays, 'day')} and ${c.weighIns} ${plural(c.weighIns, 'weigh-in')}.`,
          f.sans,
          10.5,
          t.text2,
        ),
        spacer(8),
        T(o.lang === 'hi' ? r.verdict.hi : r.verdict.en, f.display600, 19, t.text1, { lineHeight: 1.25 }),
        spacer(8),
        pillars,
      ],
      6,
    ),
  );
  if (r.win)
    add(
      'cover',
      box(
        vstack(
          [
            T('Win of the week', f.mono, 9.5, t.limeText),
            T(r.win.big, f.display, 40, t.limeText, { lineHeight: 1.05 }),
            text([run(`${r.win.title}. `, f.sans600, 10.5, t.text1), run(r.win.detail, f.sans, 10.5, t.text2)], { fonts: f }),
          ],
          5,
        ),
        { fill: t.limeDim, radius: 14, pad: 16 },
      ),
    );
  if (r.actions.length)
    add(
      'cover',
      panel(
        vstack(
          [
            T('What to do differently next week', f.display600, 13, t.text1),
            ...r.actions.map((a, i) =>
              vstack(
                [
                  rule('divider', 3),
                  row(
                    [
                      { node: numberDot(i + 1, 20), width: 20 },
                      {
                        node: vstack([T(o.lang === 'hi' ? a.titleHi : a.title, f.sans600, 10.5, t.text1), small(firstSentence(a.detail))], 2),
                        width: 'flex',
                      },
                    ],
                    10,
                  ),
                ],
                4,
              ),
            ),
          ],
          6,
        ),
      ),
    );

  // Next week: in Quick it comes straight after the cover as one panel; in Full near the end.
  const actionNode = (a: WeeklyReport['actions'][number], i: number) =>
    row(
      [
        { node: numberDot(i + 1, 26), width: 26 },
        {
          node: vstack(
            [
              T(o.lang === 'hi' ? a.titleHi : a.title, f.display600, 13.5, t.text1, { lineHeight: 1.2 }),
              body(a.detail),
              box(text([run('We will check: ', f.sans600, 9.5, t.text1), run(a.checkText, f.sans, 9.5, t.text2)], { fonts: f }), { fill: t.surface2, radius: 8, pad: 8 }),
            ],
            5,
          ),
          width: 'flex',
        },
      ],
      12,
    );
  const nextWeek = (breakBefore: boolean) => {
    if (!r.actions.length) return;
    heading('next', copy.next, breakBefore);
    if (full) r.actions.forEach((a, i) => add('next', panel(actionNode(a, i))));
    else add('next', panel(vstack(r.actions.map((a, i) => vstack([i ? rule('divider', 6) : null, actionNode(a, i)], 4)), 6)));
  };
  if (!full) nextWeek(true);

  // Numbers -----------------------------------------------------------------------------------
  heading('numbers', copy.numbers, full);
  const ring = (value: number, of: number, label: string, col: string) =>
    vstack([chart(ringMarkup(value, of, col), 64), T(label, f.sans, 9.5, t.text2, { align: 'center' })], 4);
  add(
    'numbers',
    panel(
      grid(
        [
          ring(c.sessions, Math.max(c.planned ?? c.sessions, c.sessions, 1), 'Sessions', 'var(--lime)'),
          c.calorieDays !== null ? ring(c.calorieDays, 7, 'Calorie days', 'var(--report-food)') : ring(c.foodDays, 7, 'Food days', 'var(--report-food)'),
          c.proteinDays !== null ? ring(c.proteinDays, 7, 'Protein days', 'var(--report-food)') : ring(c.records, Math.max(c.records, 1), 'Records', 'var(--report-food)'),
          ring(c.weighIns, 7, 'Weigh-ins', 'var(--report-body)'),
        ],
        4,
        8,
      ),
    ),
  );
  if (full && r.tiles.length) {
    add(
      'numbers',
      grid(
        r.tiles.map((tile) =>
          box(
            vstack(
              [
                T(TILE[tile.key].label, f.sans, 9.5, t.text2),
                text(
                  [
                    run(TILE[tile.key].fmt(tile.value), f.display, 20, t.text1),
                    ...(TILE[tile.key].unit ? [run(` ${TILE[tile.key].unit}`, f.sans600, 10, t.text2)] : []),
                  ],
                  { fonts: f, lineHeight: 1.2 },
                ),
                T(tileNote(tile), f.sans, 9, tile.usual !== null && tile.value > tile.usual * 1.03 && tile.key !== 'kcal' ? t.up : t.text3),
              ],
              3,
            ),
            { fill: t.surface, radius: 12, pad: 12 },
          ),
        ),
        3,
        8,
      ),
    );
    note('numbers', small('Compared with your average of the 4 weeks before, when your history covers them. A calorie day lands within 10% of your target; a protein day reaches 90% of it.'));
  }

  // Last week ---------------------------------------------------------------------------------
  if (r.lastWeek?.length) {
    heading('last', copy.last);
    add(
      'last',
      panel(
        vstack(
          r.lastWeek.map((x, i) =>
            vstack(
              [
                i ? rule('divider', 3) : null,
                row(
                  [
                    { node: tick(x.done), width: 18 },
                    { node: vstack([T(x.title, f.sans600, 10.5, t.text1), body(x.result)], 2), width: 'flex' },
                    { node: T(x.done ? 'Done' : 'Missed', f.mono, 9, x.done ? t.up : t.danger, { align: 'right' }), width: 46 },
                  ],
                  10,
                  'center',
                ),
              ],
              4,
            ),
          ),
          4,
        ),
      ),
    );
  }

  // Days --------------------------------------------------------------------------------------
  heading('days', copy.days);
  const legend = (items: [string, string][]) =>
    row(
      items.map(([label, col]) => ({
        node: row([{ node: dot(col, 7), width: 7 }, { node: T(label, f.sans, 9, t.text2), width: 'flex' }], 5, 'center'),
        width: 'flex' as const,
      })),
      10,
    );
  add(
    'days',
    panel(
      vstack(
        [
          legend([
            ['Calories eaten', t.food],
            ...(r.targets.kcal ? ([[`Target ${fmt(r.targets.kcal)}`, t.lime]] as [string, string][]) : []),
            ...(r.targets.maintenance ? ([[`Est. maintenance ${fmt(r.targets.maintenance)}`, t.body]] as [string, string][]) : []),
          ]),
          chart(svgOf(createElement(Timeline, { r })), 300),
        ],
        8,
      ),
    ),
  );

  // Findings ----------------------------------------------------------------------------------
  const label = (l: 'established' | 'early') => pill(l === 'established' ? 'Established' : 'Early signal', l === 'established' ? t.up : t.text2);
  if (!full && r.findings.length) {
    heading('short', copy.short);
    add(
      'short',
      panel(
        vstack(
          r.findings.slice(0, 3).map((fd, i) =>
            vstack([i ? rule('divider', 4) : null, label(fd.label), T(fd.title, f.sans600, 11, t.text1), body(fd.saw)], 4),
          ),
          6,
        ),
      ),
    );
    note('short', small('The full report adds the 8 week strength charts, muscle volume, body and energy, nutrition detail and the evidence behind each number.'));
  }
  if (full && r.findings.length) {
    heading('find', copy.find);
    for (const fd of r.findings)
      add(
        'find',
        panel(
          vstack(
            [
              label(fd.label),
              T(fd.title, f.display, 15, t.text1, { lineHeight: 1.2 }),
              keyRows([
                ['What we saw', fd.saw],
                [fd.label === 'early' ? 'How sure we are' : 'Why it matters', fd.why],
                ...(fd.evidence.length ? ([['Evidence', fd.evidence.join(', ')]] as [string, string][]) : []),
              ]),
            ],
            6,
          ),
        ),
      );
  }

  // Strength ----------------------------------------------------------------------------------
  if (full && r.lifts.length) {
    heading('strength', copy.strength);
    const liftNode = (l: WeeklyReport['lifts'][number]) =>
      vstack(
        [
          T(l.name, f.display600, 12.5, t.text1),
          row(
            [
              { node: T(`${l.now} kg now, ${l.base} kg 4 weeks ago`, f.sans, 9.5, t.text2), width: 'flex' },
              { node: pill(liftTag(l), l.real ? (l.pct > 0 ? t.up : t.warning) : t.text2), width: pillWidth(liftTag(l)) },
            ],
            6,
            'center',
          ),
          chart(svgOf(createElement(LiftChart, { lift: l }))),
        ],
        5,
      );
    // Up to four lifts share a panel (two rows of two), so the section usually stays whole.
    for (let i = 0; i < r.lifts.length; i += 4) {
      add('strength', panel(grid(r.lifts.slice(i, i + 4).map(liftNode), 2, 20)));
    }
    note('strength', small('Epley estimate from sets of up to 10 reps; an estimate, not a tested max. The shaded strip is the 5% band around the level 4 weeks ago.'));
  }

  // Volume ------------------------------------------------------------------------------------
  if (full && r.muscles.length) {
    heading('volume', copy.volume);
    add(
      'volume',
      panel(
        vstack(
          [
            legend([
              ['This week', t.lime],
              ['Below your usual', t.food],
              ['Your 4 week average (line)', t.text1],
            ]),
            chart(svgOf(createElement(MuscleChart, { rows: r.muscles })), 300),
            body('What matters most is enough hard sets for each muscle across the week, usually spread over about 2 sessions. We compare you with your own average, not a fixed number.'),
          ],
          8,
        ),
      ),
    );
  }

  // Body --------------------------------------------------------------------------------------
  if (full && r.body) {
    heading('body', copy.body);
    const b = r.body;
    const e = r.energy;
    add(
      'body',
      panel(
        vstack(
          [
            chart(svgOf(createElement(WeightChart, { body: b })), 340),
            b.projection
              ? vstack(
                  [
                    rule('divider', 4),
                    row(
                      [
                        {
                          node: text(
                            [
                              run(b.projection.weeksLo === b.projection.weeksHi ? `${b.projection.weeksLo}` : `${b.projection.weeksLo} to ${b.projection.weeksHi}`, f.display, 24, t.bodyText),
                              run(' weeks', f.sans600, 10, t.text2),
                            ],
                            { fonts: f },
                          ),
                          width: 120,
                        },
                        { node: body(`Estimate: if your recent pace holds, ${b.projection.targetKg} kg lands in this range. It moves as your trend moves.`), width: 'flex' },
                      ],
                      12,
                      'center',
                    ),
                  ],
                  4,
                )
              : null,
            e
              ? vstack(
                  [
                    rule('divider', 4),
                    row(
                      [
                        { node: vstack([T(fmt(e.meanIntake), f.display, 17, t.text1, { align: 'center' }), T('Eaten a day, average kcal', f.sans, 9, t.text2, { align: 'center' })], 2), width: 'flex' },
                        { node: T(e.actualDeficit >= 0 ? '+' : '-', f.mono, 15, t.text3, { align: 'center' }), width: 14 },
                        {
                          node: vstack(
                            [
                              T(fmt(Math.abs(e.actualDeficit)), f.display, 17, t.text1, { align: 'center' }),
                              T(`${e.actualDeficit >= 0 ? 'From your body' : 'Stored by your body'}, ${Math.abs(e.changeKgPerWeek)} kg a week`, f.sans, 9, t.text2, { align: 'center' }),
                            ],
                            2,
                          ),
                          width: 'flex',
                        },
                        { node: T('=', f.mono, 15, t.text3, { align: 'center' }), width: 14 },
                        { node: vstack([T(fmt(e.maintenance), f.display, 17, t.bodyText, { align: 'center' }), T('Estimated maintenance', f.sans, 9, t.text2, { align: 'center' })], 2), width: 'flex' },
                      ],
                      6,
                    ),
                    body(energyNote(e)),
                  ],
                  6,
                )
              : null,
          ],
          8,
        ),
      ),
    );
    note('body', small('One kilogram of body weight is treated as 7,700 kcal. Sources: Orsama 2014, Helms 2014.'));
  }

  // Nutrition ---------------------------------------------------------------------------------
  const n = r.nutrition;
  if (full && n) {
    heading('food', copy.food);
    add(
      'food',
      panel(
        vstack(
          foodRows(r, n).map(([k, d, v, u], i) =>
            vstack(
              [
                i ? rule('divider', 4) : null,
                row(
                  [
                    { node: vstack([T(k, f.sans600, 10.5, t.text1), body(d)], 2), width: 'flex' },
                    { node: vstack([T(v, f.display, 15, t.text1, { align: 'right' }), T(u, f.mono, 9, t.text3, { align: 'right' })], 1), width: 110 },
                  ],
                  10,
                  'center',
                ),
              ],
              4,
            ),
          ),
          4,
        ),
      ),
    );
    if (n.meals.length)
      add(
        'food',
        panel(
          vstack(
            [
              T('Protein at each meal', f.display600, 13, t.text1),
              n.mealAim ? body(`Aim for about ${n.mealAim} g a meal, which is 0.4 g per kg of your weight.`) : null,
              chart(svgOf(createElement(MealChart, { meals: n.meals, aim: n.mealAim })), 330),
              body(MEAL_SUMMARY(n)),
            ],
            6,
          ),
        ),
      );
    note('food', small('Protein benefits level off around 1.6 g per kg a day (Morton 2018).'));
  }

  if (full) nextWeek(false);

  // Inputs and method -------------------------------------------------------------------------
  if (full) {
    heading('inputs', copy.inputs);
    const have = r.inputs.filter((i) => i.has).length;
    add(
      'inputs',
      panel(
        vstack(
          [
            row(
              [
                { node: T('Optional tracking inputs', f.display600, 13, t.text1), width: 'flex' },
                { node: T(`${have} of ${r.inputs.length} available`, f.mono, 9, t.text3, { align: 'right' }), width: 140 },
              ],
              8,
              'center',
            ),
            custom(8, (cx, x, top, w) => {
              fillRect(cx, x, top, w, 7, 3.5, cx.theme.track);
              if (have) fillRect(cx, x, top, (w * have) / r.inputs.length, 7, 3.5, cx.theme.lime);
            }),
            grid(
              r.inputs.map((i) =>
                row(
                  [
                    { node: tick(i.has), width: 18 },
                    { node: vstack([T(i.label, f.sans, 10, i.has ? t.text1 : t.text2), i.has ? null : small(i.unlock)], 1), width: 'flex' },
                  ],
                  8,
                ),
              ),
              2,
              10,
            ),
          ],
          10,
        ),
      ),
    );
    heading('method', copy.method);
    add(
      'method',
      panel(
        vstack(
          [body(METHOD_TEXT), spacer(2), ...SOURCES.map((s) => T(s, f.mono, 9, t.text2)), spacer(2), small(DISCLAIMER)],
          5,
        ),
      ),
    );
  }

  return out;
}
