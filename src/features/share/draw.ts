import interTight800 from '@fontsource/inter-tight/files/inter-tight-latin-800-normal.woff2?url';
import interTight900 from '@fontsource/inter-tight/files/inter-tight-latin-900-normal.woff2?url';
import mono500 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2?url';
import mono800 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-800-normal.woff2?url';
import { badgeStamp, GROUP_LABELS, type Badge } from '@/domain/achievements/badges';
import { formatRecordValue, PR_LABELS } from '@/domain/analytics/prs';
import {
  compareVolume,
  type MedalsCard,
  type PrCard,
  type StreakCard,
  type WorkoutCard,
} from '@/domain/share/cards';
import { formatDayMonthFixed, shortDayName } from '@/lib/format/dates';
import { formatWeightValue, type WeightUnit } from '@/lib/units';

/**
 * Story cards drawn on a canvas at 1080 × 1920, the size Instagram and WhatsApp use for stories
 * and status. Everything that matters sits between SAFE_TOP and SAFE_BOTTOM: Instagram puts the
 * profile row over the top 250 px and the reply bar over the bottom 270 px.
 */

export const CARD_W = 1080;
export const CARD_H = 1920;
const SAFE_TOP = 250;
const SAFE_BOTTOM = 1650;
const X = 88;
const INNER = CARD_W - X * 2;

/* The app's palette (tokens.css), as canvas needs literal colours. */
const C = {
  black: '#000000',
  surface: '#1c1c1e',
  white: '#ffffff',
  text2: 'rgba(235,235,245,0.6)',
  lime: '#c6f432',
  limeA: (a: number) => `rgba(198,244,50,${a})`,
  border: 'rgba(255,255,255,0.16)',
};

const TIGHT = 'OverloadTight';
const MONO = 'OverloadMono';
const font = (weight: number, size: number, family = 'Inter') =>
  `${weight} ${size}px ${family === 'Inter' ? "'Inter', sans-serif" : `'${family}', 'Inter', sans-serif`}`;

let fontsReady: Promise<void> | null = null;

/** Loads the card fonts once: Inter Tight for numbers, JetBrains Mono for the receipt. */
export function loadCardFonts(): Promise<void> {
  fontsReady ??= (async () => {
    const faces = [
      new FontFace(TIGHT, `url(${interTight800})`, { weight: '800' }),
      new FontFace(TIGHT, `url(${interTight900})`, { weight: '900' }),
      new FontFace(MONO, `url(${mono500})`, { weight: '500' }),
      new FontFace(MONO, `url(${mono800})`, { weight: '800' }),
    ];
    await Promise.all(
      faces.map(async (f) => {
        try {
          document.fonts.add(await f.load());
        } catch {
          // Falls back to Inter, still readable.
        }
      }),
    );
    await Promise.all(
      ['400', '500', '600', '700'].map((w) =>
        document.fonts.load(`${w} 32px Inter`).catch(() => []),
      ),
    );
  })();
  return fontsReady;
}

// ---------------------------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  f: string,
  color: string,
  align: CanvasTextAlign = 'left',
  baseline: CanvasTextBaseline = 'alphabetic',
) {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
}

/** The largest size up to `max` at which `s` fits in `width`. */
function fit(ctx: Ctx, s: string, width: number, max: number, weight: number, family = 'Inter') {
  let size = max;
  ctx.font = font(weight, size, family);
  while (size > 12 && ctx.measureText(s).width > width) {
    size -= 2;
    ctx.font = font(weight, size, family);
  }
  return size;
}

/** Shortens `s` with an ellipsis so it fits. */
function clip(ctx: Ctx, s: string, width: number) {
  if (ctx.measureText(s).width <= width) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > width) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

function mark(ctx: Ctx, x: number, y: number, size: number, onLime: boolean) {
  const k = size / 32;
  rr(ctx, x, y, size, size, 9 * k, onLime ? C.black : C.lime);
  const bar = onLime ? C.lime : C.black;
  ctx.globalAlpha = 0.45;
  rr(ctx, x + 7.5 * k, y + 17 * k, 4 * k, 8 * k, 1.2 * k, bar);
  ctx.globalAlpha = 0.7;
  rr(ctx, x + 14 * k, y + 12 * k, 4 * k, 13 * k, 1.2 * k, bar);
  ctx.globalAlpha = 1;
  rr(ctx, x + 20.5 * k, y + 7 * k, 4 * k, 18 * k, 1.2 * k, bar);
}

/** Logo, name, tagline and link: the same on every card, inside the safe area. */
function footer(ctx: Ctx, tagline: string, link: string, onLime = false) {
  const y = SAFE_BOTTOM - 92;
  mark(ctx, X, y, 84, onLime);
  const ink = onLime ? C.black : C.white;
  text(ctx, 'Overload', X + 106, y + 40, font(800, 42, TIGHT), ink);
  text(ctx, tagline, X + 106, y + 78, font(500, 26), onLime ? 'rgba(0,0,0,0.7)' : C.text2);
  ctx.font = font(600, 28);
  const w = ctx.measureText(link).width + 60;
  const px = CARD_W - X - w;
  if (onLime) rr(ctx, px, y + 8, w, 70, 35, C.black);
  else {
    ctx.beginPath();
    ctx.roundRect(px + 1, y + 9, w - 2, 68, 34);
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  text(
    ctx,
    link,
    px + w / 2,
    y + 43,
    font(600, 28),
    onLime ? C.white : C.white,
    'center',
    'middle',
  );
}

const dateLine = (d: Date) => `${shortDayName(d.getDay())}, ${formatDayMonthFixed(d)}`;
const kgText = (kg: number, unit: WeightUnit) => `${formatWeightValue(kg, unit)} ${unit}`;
const thousands = (v: number) => Math.round(v).toLocaleString('en-GB');

export interface CardContext {
  person: string | null;
  unit: WeightUnit;
  /** The app's public address, printed in the footer. */
  link: string;
}

// ---------------------------------------------------------------------------------------------
// 1. New PR
// ---------------------------------------------------------------------------------------------

export function drawPrCard(ctx: Ctx, pr: PrCard, workout: WorkoutCard, c: CardContext) {
  rr(ctx, 0, 0, CARD_W, CARD_H, 0, C.black);
  // Who and when.
  const initial = (c.person ?? 'O').slice(0, 1).toUpperCase();
  ctx.beginPath();
  ctx.arc(X + 42, SAFE_TOP + 42, 42, 0, Math.PI * 2);
  ctx.fillStyle = '#2c2c2e';
  ctx.fill();
  text(ctx, initial, X + 42, SAFE_TOP + 44, font(800, 36, TIGHT), C.white, 'center', 'middle');
  ctx.font = font(600, 34);
  text(
    ctx,
    clip(ctx, c.person ?? 'My workout', 520),
    X + 104,
    SAFE_TOP + 36,
    font(600, 34),
    C.white,
  );
  ctx.font = font(400, 28);
  text(
    ctx,
    clip(ctx, `${dateLine(pr.date)} · ${pr.workoutTitle}`, 560),
    X + 104,
    SAFE_TOP + 76,
    font(400, 28),
    C.text2,
  );
  text(
    ctx,
    `Workout ${workout.number}`,
    CARD_W - X,
    SAFE_TOP + 52,
    font(600, 28),
    C.text2,
    'right',
  );

  // The sticker.
  ctx.save();
  ctx.translate(X + 10, 470);
  ctx.rotate((-4 * Math.PI) / 180);
  ctx.font = font(900, 64, TIGHT);
  const sw = ctx.measureText('New PR').width + 68;
  rr(ctx, 0, -60, sw, 104, 22, C.lime);
  text(ctx, 'New PR', 34, 14, font(900, 64, TIGHT), C.black);
  ctx.restore();

  // The lift.
  const nameSize = fit(ctx, pr.exerciseName, INNER, 60, 800, TIGHT);
  text(ctx, pr.exerciseName, X, 640, font(800, nameSize, TIGHT), C.white);

  const big =
    pr.kind === 'reps' || pr.weightKg === null
      ? String(pr.reps ?? 0)
      : formatWeightValue(pr.weightKg, c.unit);
  const top = pr.kind === 'reps' || pr.weightKg === null ? 'reps' : c.unit;
  const bottom = pr.kind === 'reps' || pr.weightKg === null ? '' : `× ${pr.reps ?? 0}`;
  const bigSize = fit(ctx, big, INNER - 230, 380, 900, TIGHT);
  ctx.font = font(900, bigSize, TIGHT);
  const bw = ctx.measureText(big).width;
  text(ctx, big, X - bigSize * 0.03, 980, font(900, bigSize, TIGHT), C.lime);
  text(ctx, top, X + bw + 24, 980 - 92, font(800, 76, TIGHT), C.white);
  if (bottom) text(ctx, bottom, X + bw + 24, 980, font(800, 76, TIGHT), C.text2);

  // Two facts.
  const boxY = 1050;
  const boxW = (INNER - 20) / 2;
  const facts: [string, string][] = [
    [
      'Up from last best',
      pr.kind === 'reps'
        ? `+${thousands(pr.gain)} reps`
        : `+${formatWeightValue(pr.gain, c.unit)} ${c.unit}`,
    ],
    pr.e1rmKg !== null
      ? ['Estimated 1RM', kgText(pr.e1rmKg, c.unit)]
      : [
          'Workout volume',
          `${thousands(c.unit === 'kg' ? workout.volumeKg : workout.volumeKg * 2.20462)} ${c.unit}`,
        ],
  ];
  facts.forEach(([label, value], i) => {
    const x = X + i * (boxW + 20);
    rr(ctx, x, boxY, boxW, 170, 32, C.surface);
    text(ctx, label, x + 36, boxY + 60, font(400, 28), C.text2);
    const vs = fit(ctx, value, boxW - 72, 58, 800, TIGHT);
    text(ctx, value, x + 36, boxY + 132, font(800, vs, TIGHT), C.white);
  });

  // The ladder of records.
  const ly = 1240;
  rr(ctx, X, ly, INNER, 280, 32, C.surface);
  text(
    ctx,
    pr.ladder.some((l) => l.start) ? 'From where you started' : `Last ${pr.ladder.length} records`,
    X + 36,
    ly + 58,
    font(400, 28),
    C.text2,
  );
  const max = Math.max(...pr.ladder.map((l) => l.value));
  const min = Math.min(...pr.ladder.map((l) => l.value));
  const n = Math.max(1, pr.ladder.length);
  const gap = 18;
  const barW = (INNER - 72 - gap * (n - 1)) / n;
  pr.ladder.forEach((l, i) => {
    const h = max === min ? 130 : 50 + ((l.value - min) / (max - min)) * 80;
    const x = X + 36 + i * (barW + gap);
    rr(
      ctx,
      x,
      ly + 82 + (130 - h),
      barW,
      h,
      12,
      i === n - 1 ? C.lime : C.limeA(0.25 + (0.5 * i) / n),
    );
    const label =
      i === n - 1 ? 'Today' : l.start ? 'Start' : formatDayMonthFixed(l.date).split(' ')[1]!;
    text(
      ctx,
      label,
      x + barW / 2,
      ly + 250,
      font(i === n - 1 ? 600 : 400, 24),
      i === n - 1 ? C.white : C.text2,
      'center',
    );
  });

  footer(ctx, 'Tracked, not guessed', c.link);
}

// ---------------------------------------------------------------------------------------------
// 2. Workout receipt
// ---------------------------------------------------------------------------------------------

function lineValue(l: WorkoutCard['lines'][number], unit: WeightUnit): string {
  if (l.weightKg && l.reps) return `${formatWeightValue(l.weightKg, unit)} × ${l.reps}`;
  if (l.reps) return `${l.reps} reps`;
  if (l.durationSec) {
    const m = Math.floor(l.durationSec / 60);
    return m > 0 ? `${m}:${String(l.durationSec % 60).padStart(2, '0')}` : `${l.durationSec} s`;
  }
  if (l.distanceM)
    return l.distanceM >= 1000 ? `${(l.distanceM / 1000).toFixed(1)} km` : `${l.distanceM} m`;
  return 'Done';
}

export function drawReceiptCard(ctx: Ctx, w: WorkoutCard, c: CardContext) {
  rr(ctx, 0, 0, CARD_W, CARD_H, 0, C.black);
  text(ctx, 'Showed up.', CARD_W / 2, SAFE_TOP + 80, font(900, 92, TIGHT), C.white, 'center');
  text(ctx, 'Paid in full.', CARD_W / 2, SAFE_TOP + 172, font(900, 92, TIGHT), C.lime, 'center');

  const shown = w.lines.slice(0, 6);
  const more = w.lines.length - shown.length;
  const rows: [string, string][] = [
    ['WORKING SETS', String(w.workingSets)],
    ...(w.minutes !== null
      ? ([['TIME', `${Math.round(w.minutes)} MIN`]] as [string, string][])
      : []),
    ...(w.restSeconds !== null
      ? ([
          [
            'REST BETWEEN SETS',
            `${Math.floor(w.restSeconds / 60)}:${String(Math.round(w.restSeconds % 60)).padStart(2, '0')}`,
          ],
        ] as [string, string][])
      : []),
    ['NEW RECORDS', String(w.records)],
  ];
  const LS = 50;
  const RS = 40;
  const BH = 72;
  const paperW = 840;
  // The same steps as the drawing below, so the paper fits its contents exactly.
  const paperH = 460 + (shown.length + (more > 0 ? 1 : 0)) * LS + rows.length * RS + BH;
  const px = (CARD_W - paperW) / 2;
  const py = SAFE_TOP + 220;

  ctx.save();
  ctx.translate(CARD_W / 2, py + paperH / 2);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.translate(-CARD_W / 2, -(py + paperH / 2));
  rr(ctx, px, py, paperW, paperH, 10, C.lime);
  const L = px + 56;
  const R = px + paperW - 56;
  const ink = C.black;
  let y = py + 64 + 30;
  text(ctx, 'OVERLOAD', L, y, font(800, 40, MONO), ink);
  text(ctx, `#${String(w.number).padStart(4, '0')}`, R, y, font(500, 26, MONO), ink, 'right');
  y += 50;
  ctx.font = font(500, 26, MONO);
  text(ctx, clip(ctx, w.title.toUpperCase(), 360), L, y, font(500, 26, MONO), ink);
  const when =
    `${shortDayName(w.date.getDay())} ${formatDayMonthFixed(w.date)} ${String(w.date.getHours()).padStart(2, '0')}:${String(w.date.getMinutes()).padStart(2, '0')}`.toUpperCase();
  text(ctx, when, R, y, font(500, 26, MONO), ink, 'right');
  y += 40;
  const dashed = (yy: number, solid = false) => {
    ctx.beginPath();
    ctx.setLineDash(solid ? [] : [10, 8]);
    ctx.moveTo(L, yy);
    ctx.lineTo(R, yy);
    ctx.strokeStyle = solid ? ink : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
  };
  dashed(y);
  y += 60;
  for (const l of shown) {
    const value = lineValue(l, c.unit);
    ctx.font = font(800, 30, MONO);
    const vw = ctx.measureText(value).width;
    ctx.font = font(500, 30, MONO);
    text(ctx, clip(ctx, l.name, R - L - vw - 30), L, y, font(500, 30, MONO), ink);
    text(ctx, value, R, y, font(800, 30, MONO), ink, 'right');
    y += LS;
  }
  if (more > 0) {
    text(ctx, `+ ${more} MORE`, L, y, font(500, 28, MONO), 'rgba(0,0,0,0.65)');
    y += LS;
  }
  y -= 14;
  dashed(y);
  y += 50;
  for (const [k, v] of rows) {
    text(ctx, k, L, y, font(500, 28, MONO), ink);
    text(ctx, v, R, y, font(500, 28, MONO), ink, 'right');
    y += RS;
  }
  y -= 10;
  dashed(y, true);
  y += 64;
  text(ctx, 'TOTAL LIFTED', L, y, font(800, 38, MONO), ink);
  const total = `${thousands(c.unit === 'kg' ? w.volumeKg : w.volumeKg * 2.20462)} ${c.unit.toUpperCase()}`;
  text(ctx, total, R, y, font(800, fit(ctx, total, 360, 54, 800, MONO), MONO), ink, 'right');
  y += 40;
  // A barcode, made from the workout number so each one is different.
  let bx = L;
  let seed = w.number * 9301 + 49297;
  while (bx < R - 6) {
    seed = (seed * 9301 + 49297) % 233280;
    const bwid = 3 + (seed % 5) * 2;
    rr(ctx, bx, y, Math.min(bwid, R - bx), BH, 0, ink);
    bx += bwid + 6;
  }
  y += BH + 46;
  text(ctx, 'NO REFUNDS ON GAINS', CARD_W / 2, y, font(500, 24, MONO), ink, 'center');
  ctx.restore();

  footer(ctx, c.person ? `Logged by ${c.person}` : 'Every set, logged', c.link);
}

// ---------------------------------------------------------------------------------------------
// 3. Total lifted
// ---------------------------------------------------------------------------------------------

export function canDrawTotal(w: WorkoutCard) {
  return compareVolume(w.volumeKg) !== null;
}

export function drawTotalCard(ctx: Ctx, w: WorkoutCard, c: CardContext) {
  const cmp = compareVolume(w.volumeKg)!;
  rr(ctx, 0, 0, CARD_W, CARD_H, 0, C.lime);
  const ink = C.black;
  text(ctx, dateLine(w.date), X, SAFE_TOP + 30, font(600, 30), ink);
  ctx.font = font(600, 30);
  const right = w.minutes !== null ? `${w.title} · ${Math.round(w.minutes)} min` : w.title;
  text(ctx, clip(ctx, right, 520), CARD_W - X, SAFE_TOP + 30, font(600, 30), ink, 'right');

  const lb = c.unit === 'lb';
  const amount = thousands(lb ? w.volumeKg * 2.20462 : w.volumeKg);
  text(ctx, 'Today I moved', X, 540, font(800, 70, TIGHT), ink);
  const size = fit(ctx, amount, INNER, 280, 900, TIGHT);
  // Digits stand about 0.73 of the size above the baseline; the comma drops below it.
  const numberBase = 540 + 50 + size * 0.73;
  text(ctx, amount, X - size * 0.03, numberBase, font(900, size, TIGHT), ink);
  text(ctx, lb ? 'pounds.' : 'kilograms.', X, numberBase + 150, font(900, 110, TIGHT), ink);

  const lead = `That is more than`;
  const what = cmp.beat.label.replace(/^A /, 'a ').replace(/^An /, 'an ');
  const ty = 1110;
  text(ctx, lead, X, ty, font(800, 64, TIGHT), ink);
  const ws = fit(ctx, `${what}.`, INNER, 64, 800, TIGHT);
  text(ctx, `${what}.`, X, ty + 70, font(800, ws, TIGHT), ink);

  const bars: [string, number, number][] = [
    ...(cmp.smaller
      ? ([[cmp.smaller.label, cmp.smaller.kg, 0.45]] as [string, number, number][])
      : []),
    [cmp.beat.label, cmp.beat.kg, 0.7],
    ['Me, today', w.volumeKg, 1],
  ];
  let by = 1260;
  const labelW = 260;
  const valueW = 200;
  const trackX = X + labelW + 20;
  const trackW = INNER - labelW - valueW - 40;
  for (const [label, kg, a] of bars) {
    ctx.font = font(label === 'Me, today' ? 800 : 600, 30);
    text(ctx, clip(ctx, label, labelW), X, by + 30, ctx.font, ink);
    rr(ctx, trackX, by, trackW, 40, 20, 'rgba(0,0,0,0.12)');
    ctx.globalAlpha = a;
    rr(ctx, trackX, by, Math.max(40, (trackW * kg) / w.volumeKg), 40, 20, ink);
    ctx.globalAlpha = 1;
    const v = `${thousands(lb ? kg * 2.20462 : kg)} ${c.unit}`;
    text(ctx, v, CARD_W - X, by + 30, font(label === 'Me, today' ? 800 : 600, 30), ink, 'right');
    by += 70;
  }

  footer(ctx, 'Every set, every kilo, counted', c.link, true);
}

// ---------------------------------------------------------------------------------------------
// 4. Streak
// ---------------------------------------------------------------------------------------------

export function drawStreakCard(ctx: Ctx, s: StreakCard, c: CardContext, weekStartsOn: 0 | 1) {
  rr(ctx, 0, 0, CARD_W, CARD_H, 0, C.black);
  text(
    ctx,
    `${c.person ? `${c.person} · ` : ''}since ${formatDayMonthFixed(s.since)}`,
    X,
    SAFE_TOP + 30,
    font(600, 30),
    C.text2,
  );
  const n = String(s.weeks);
  const size = 300;
  ctx.font = font(900, size, TIGHT);
  const nw = ctx.measureText(n).width;
  text(ctx, n, X - 8, SAFE_TOP + 330, font(900, size, TIGHT), C.lime);
  text(
    ctx,
    s.weeks === 1 ? 'week' : 'weeks',
    X + nw + 20,
    SAFE_TOP + 250,
    font(800, 84, TIGHT),
    C.white,
  );
  text(ctx, 'straight.', X + nw + 20, SAFE_TOP + 330, font(800, 84, TIGHT), C.white);
  text(ctx, 'Not one week skipped.', X, SAFE_TOP + 420, font(800, 52, TIGHT), C.text2);

  const gy = SAFE_TOP + 480;
  const gap = 14;
  const cw = (INNER - gap * 6) / 7;
  const days =
    weekStartsOn === 1 ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  days.forEach((d, i) =>
    text(ctx, d, X + i * (cw + gap) + cw / 2, gy + 24, font(500, 24), C.text2, 'center'),
  );
  const ch = 34;
  s.grid.forEach((v, i) => {
    const row = Math.floor(i / 7);
    const col = i % 7;
    const x = X + col * (cw + gap);
    const y = gy + 48 + row * (ch + 10);
    if (v === null) return;
    rr(ctx, x, y, cw, ch, 10, v ? (row === 11 ? C.lime : C.limeA(0.62)) : C.surface);
  });

  const sy = gy + 48 + 12 * (ch + 10) + 30;
  const boxW = (INNER - 40) / 3;
  const stats: [string, number][] = [
    ['Workouts', s.workouts],
    ['Records', s.records],
    ['Hours', s.hours],
  ];
  stats.forEach(([label, v], i) => {
    const x = X + i * (boxW + 20);
    rr(ctx, x, sy, boxW, 150, 32, C.surface);
    text(ctx, label, x + 32, sy + 54, font(400, 26), C.text2);
    text(ctx, thousands(v), x + 32, sy + 120, font(800, 58, TIGHT), C.white);
  });

  footer(ctx, 'Your streak lives here', c.link);
}

// ---------------------------------------------------------------------------------------------
// 5. Badge unlocked
// ---------------------------------------------------------------------------------------------

const TIER_STOPS: Record<Badge['tier'], [string, string]> = {
  bronze: ['#e3a06e', '#9a5a30'],
  silver: ['#eef1f5', '#9aa3ad'],
  gold: ['#ffdd73', '#c9971a'],
  legend: ['#d8ff5a', '#78a300'],
};
const TIER_NAME: Record<Badge['tier'], string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  legend: 'Legend',
};

function octagonPath(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = ((i * 45 + 22.5) * Math.PI) / 180;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The medallion, as on the Badges page, at any size. */
export function drawMedallion(ctx: Ctx, badge: Badge, cx: number, cy: number, r: number) {
  const [a, b] = TIER_STOPS[badge.tier];
  // A soft glow in the tier's colour.
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.6);
  glow.addColorStop(0, `${a}55`);
  glow.addColorStop(1, `${a}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 1.7, cy - r * 1.7, r * 3.4, r * 3.4);
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  octagonPath(ctx, cx, cy, r);
  ctx.fillStyle = g;
  ctx.fill();
  octagonPath(ctx, cx, cy, r * 0.83);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = r * 0.03;
  ctx.lineJoin = 'round';
  ctx.stroke();
  const { big, small } = badgeStamp(badge);
  const size = fit(ctx, big, r * 1.3, r * 0.75, 900, TIGHT);
  text(
    ctx,
    big,
    cx,
    cy + (small ? size * 0.22 : size * 0.36),
    font(900, size, TIGHT),
    '#000000',
    'center',
  );
  if (small)
    text(
      ctx,
      small,
      cx,
      cy + size * 0.22 + r * 0.3,
      font(700, r * 0.17),
      'rgba(0,0,0,0.7)',
      'center',
    );
}

export function drawBadgeCard(ctx: Ctx, badge: Badge, c: CardContext) {
  rr(ctx, 0, 0, CARD_W, CARD_H, 0, C.black);
  const who = c.person ? `${c.person} unlocked` : 'Unlocked';
  text(ctx, who, X, SAFE_TOP + 30, font(600, 30), C.text2);
  if (badge.earnedAt)
    text(ctx, dateLine(badge.earnedAt), CARD_W - X, SAFE_TOP + 30, font(600, 30), C.text2, 'right');

  drawMedallion(ctx, badge, CARD_W / 2, 700, 290);

  text(ctx, 'Badge unlocked', CARD_W / 2, 1120, font(800, 40, TIGHT), C.lime, 'center');
  const ts = fit(ctx, badge.title, INNER, 110, 900, TIGHT);
  text(ctx, badge.title, CARD_W / 2, 1120 + 20 + ts, font(900, ts, TIGHT), C.white, 'center');
  ctx.font = font(500, 34);
  const goal = clip(ctx, `${badge.goal}.`, INNER);
  text(ctx, goal, CARD_W / 2, 1120 + ts + 100, font(500, 34), C.text2, 'center');

  const pill = `${TIER_NAME[badge.tier]} · ${GROUP_LABELS[badge.group]}`;
  ctx.font = font(700, 30);
  const pw = ctx.measureText(pill).width + 64;
  const py = 1120 + ts + 150;
  rr(ctx, (CARD_W - pw) / 2, py, pw, 64, 32, C.surface);
  text(ctx, pill, CARD_W / 2, py + 33, font(700, 30), C.white, 'center', 'middle');

  footer(ctx, 'Earn yours, one set at a time', c.link);
}

// ---------------------------------------------------------------------------------------------
// 6. Medals: every record of one workout
// ---------------------------------------------------------------------------------------------

function goldMedal(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.fillStyle = '#f5c542';
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy - r * 1.9);
  ctx.lineTo(cx - r * 0.15, cy - r * 1.9);
  ctx.lineTo(cx + r * 0.25, cy - r * 0.8);
  ctx.lineTo(cx - r * 0.3, cy - r * 0.8);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.7, cy - r * 1.9);
  ctx.lineTo(cx + r * 0.15, cy - r * 1.9);
  ctx.lineTo(cx - r * 0.25, cy - r * 0.8);
  ctx.lineTo(cx + r * 0.3, cy - r * 0.8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // A five-point star.
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r * 0.55 : r * 0.24;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();
}

export function drawMedalsCard(ctx: Ctx, m: MedalsCard, c: CardContext) {
  rr(ctx, 0, 0, CARD_W, CARD_H, 0, C.black);
  ctx.font = font(600, 30);
  text(
    ctx,
    clip(ctx, `${dateLine(m.date)} · ${m.title}`, INNER),
    X,
    SAFE_TOP + 30,
    font(600, 30),
    C.text2,
  );

  goldMedal(ctx, X + 70, SAFE_TOP + 230, 70);
  const n = String(m.medals.length);
  text(ctx, n, X + 180, SAFE_TOP + 290, font(900, 220, TIGHT), '#f5c542');
  ctx.font = font(900, 220, TIGHT);
  const nw = ctx.measureText(n).width;
  const wordsX = X + 200 + nw;
  const ws = fit(ctx, 'in one workout.', CARD_W - X - wordsX, 76, 800, TIGHT);
  const word = m.medals.length === 1 ? 'medal' : 'medals';
  text(ctx, word, wordsX, SAFE_TOP + 210, font(800, ws, TIGHT), C.white);
  text(ctx, 'in one workout.', wordsX, SAFE_TOP + 290, font(800, ws, TIGHT), C.white);

  const shown = m.medals.slice(0, 7);
  // The list sits in the middle of the space between the headline and the footer.
  const listH = shown.length * 132 + (m.medals.length > shown.length ? 60 : 0);
  const top = SAFE_TOP + 400;
  let y = top + Math.max(0, (SAFE_BOTTOM - 140 - top - listH) / 2);
  for (const medal of shown) {
    rr(ctx, X, y, INNER, 118, 28, C.surface);
    ctx.beginPath();
    ctx.arc(X + 58, y + 59, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245,197,66,0.18)';
    ctx.fill();
    goldMedal(ctx, X + 58, y + 64, 15);
    const value = formatRecordValue(medal.type, medal.value, c.unit);
    ctx.font = font(800, 40, TIGHT);
    const vw = ctx.measureText(value).width;
    ctx.font = font(700, 34);
    text(
      ctx,
      clip(ctx, medal.exerciseName, INNER - 150 - vw - 30),
      X + 108,
      y + 52,
      font(700, 34),
      C.white,
    );
    text(ctx, PR_LABELS[medal.type], X + 108, y + 92, font(400, 26), C.text2);
    text(ctx, value, CARD_W - X - 34, y + 74, font(800, 40, TIGHT), '#f5c542', 'right');
    y += 132;
  }
  if (m.medals.length > shown.length)
    text(ctx, `+ ${m.medals.length - shown.length} more`, X, y + 30, font(600, 30), C.text2);

  footer(ctx, 'Medals earned on Overload', c.link);
}
