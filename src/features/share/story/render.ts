import { MARK_LIME, MARK_WHITE } from '@/app/brandPaths';
import {
  boxGeometry,
  CARD_H,
  CARD_W,
  SAFE_BOTTOM,
  SAFE_TOP,
  type BoxGeometry,
  type BoxPlacement,
} from '@/domain/share/layout';
import type { StoryContent, StoryStat } from '@/domain/share/story';
import { css, type Family, type FontId } from './fonts';

/**
 * Draws a story card (share cards 2.0) on a 1080 × 1920 canvas: the background (the person's
 * photo or a brand background), the brand and date at the top right, and the stats box in one
 * of seven designs, placed, sized and tilted as the person arranged it. The editor shows this
 * same drawing, so the saved image is exactly what was on screen.
 *
 * Sizes are in card units: 1 u is 1% of the card width (10.8 px), as in the approved preview.
 */

export const U = CARD_W / 100;

export type DesignId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Background = 'photo' | 'bg1' | 'bg2' | 'bg3' | 'bg4';
export type Ink = 'white' | 'black';

export const DESIGNS: { id: DesignId; name: string; width: number; font: FontId }[] = [
  { id: 'A', name: 'Sticker stats', width: 56, font: 'bric' },
  { id: 'B', name: 'Receipt', width: 60, font: 'mono' },
  { id: 'C', name: 'LED scoreboard', width: 60, font: 'doto' },
  { id: 'D', name: 'Achievement', width: 60, font: 'unb' },
  { id: 'E', name: 'Die-cut sticker', width: 52, font: 'syne' },
  { id: 'F', name: 'Caption note', width: 62, font: 'serif' },
  { id: 'G', name: 'Rings widget', width: 54, font: 'bric' },
];

export const ACCENTS = [
  { value: '#d2f25c', label: 'Lime' },
  { value: '#ffffff', label: 'White' },
  { value: '#ffb020', label: 'Amber' },
  { value: '#5cc8ff', label: 'Sky' },
  { value: '#ff6b5b', label: 'Coral' },
  { value: '#c58bff', label: 'Violet' },
] as const;

export interface StoryStyle {
  design: DesignId;
  /** 'auto' uses the design's own font. */
  font: FontId | 'auto';
  accent: string;
  ink: Ink;
  /** Box opacity, 0 to 100. */
  boxOpacity: number;
  /** Photo darkness, 0 to 100. */
  dim: number;
  tags: boolean;
  showName: boolean;
  brand: 'top' | 'safe';
  brandSize: 's' | 'm' | 'l';
  background: Background;
  placement: BoxPlacement;
}

export const DEFAULT_STYLE: StoryStyle = {
  design: 'A',
  font: 'auto',
  accent: '#d2f25c',
  ink: 'white',
  boxOpacity: 30,
  dim: 45,
  tags: true,
  showName: true,
  brand: 'top',
  brandSize: 'm',
  background: 'bg1',
  placement: { px: 0.05, py: 0.84, size: 100, tilt: 0 },
};

export const BRAND_SIZE = { s: 3.6, m: 4.8, l: 6.2 } as const;

/** The font families a card in this style needs, for loading before drawing. */
export function familiesFor(style: StoryStyle): Family[] {
  const d = DESIGNS.find((x) => x.id === style.design) ?? DESIGNS[0]!;
  const main = style.font === 'auto' ? d.font : style.font;
  const out: Family[] = ['tight', main];
  if (style.design === 'E' || style.design === 'F') out.push('marker');
  if (style.design === 'F' || style.design === 'B') out.push('mono');
  return out;
}

type Ctx = CanvasRenderingContext2D;

interface Theme {
  tx: string;
  /** "r,g,b" for lines, chips and glass in the text colour. */
  wr: string;
  /** "r,g,b" of the text glow. */
  sh: string;
  /** "r,g,b" of a box panel. */
  pb: string;
  accent: string;
  bo: number;
}

const rgba = (rgb: string, a: number) => `rgba(${rgb},${Math.max(0, Math.min(1, a))})`;

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// ---------------------------------------------------------------------------------------------
// A pen that measures in a dry pass and draws in the real one
// ---------------------------------------------------------------------------------------------

interface TextOpts {
  size: number;
  weight?: number;
  family: Family;
  italic?: boolean;
  color: string;
  alpha?: number;
  align?: CanvasTextAlign;
  glow?: string | null;
}

class Pen {
  constructor(
    readonly ctx: Ctx,
    readonly dry: boolean,
    readonly theme: Theme,
    readonly main: Family,
    /** Text glow behind words on the photo. */
    readonly glow: string | null,
  ) {}

  font(o: Pick<TextOpts, 'size' | 'weight' | 'family' | 'italic'>) {
    this.ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size}px ${css(o.family)}`;
  }

  width(s: string, o: Pick<TextOpts, 'size' | 'weight' | 'family' | 'italic'>) {
    this.font(o);
    return this.ctx.measureText(s).width;
  }

  /** Draws `s` with its baseline at `y`; returns its width. */
  text(s: string, x: number, y: number, o: TextOpts): number {
    this.font(o);
    const w = this.ctx.measureText(s).width;
    if (this.dry || !s) return w;
    const c = this.ctx;
    c.save();
    c.globalAlpha *= o.alpha ?? 1;
    c.fillStyle = o.color;
    c.textAlign = o.align ?? 'left';
    c.textBaseline = 'alphabetic';
    const glow = o.glow === undefined ? this.glow : o.glow;
    if (glow) {
      c.shadowColor = glow;
      c.shadowBlur = 26;
      c.shadowOffsetY = 2;
    }
    c.fillText(s, x, y);
    c.restore();
    return w;
  }

  /** The largest size up to `max` at which `s` fits `width`. */
  fit(s: string, width: number, max: number, o: Omit<TextOpts, 'size' | 'color'>) {
    let size = max;
    while (size > 8 && this.width(s, { ...o, size }) > width) size *= 0.95;
    return size;
  }

  /** Breaks `s` into lines no wider than `width`. */
  wrap(s: string, width: number, o: Pick<TextOpts, 'size' | 'weight' | 'family' | 'italic'>) {
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.width(next, o) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Wrapped text from `top`; returns the height used. */
  para(s: string, x: number, top: number, width: number, lh: number, o: TextOpts) {
    const lines = this.wrap(s, width, o);
    lines.forEach((l, i) => this.text(l, x, top + baseline(o.size, lh) + i * o.size * lh, o));
    return lines.length * o.size * lh;
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string | null,
    stroke?: string,
    lw = 3,
    dash?: number[],
  ) {
    if (this.dry) return;
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      if (dash) c.setLineDash(dash);
      c.stroke();
    }
    c.restore();
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, lw = 3, dash?: number[]) {
    if (this.dry) return;
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = color;
    c.lineWidth = lw;
    if (dash) c.setLineDash(dash);
    c.stroke();
    c.restore();
  }
}

/** Baseline offset from a line's top for a font size at a line height. */
const baseline = (size: number, lh: number) => size * ((lh - 1) / 2 + 0.8);

/** A number with its smaller unit after it; returns the total width. */
function valueUnit(
  p: Pen,
  s: StoryStat,
  x: number,
  y: number,
  o: TextOpts,
  unit: { scale: number; color?: string; alpha?: number; weight?: number; gap?: number },
  align: 'left' | 'right' = 'left',
) {
  const uo = {
    ...o,
    size: o.size * unit.scale,
    color: unit.color ?? o.color,
    alpha: unit.alpha ?? o.alpha,
    weight: unit.weight ?? o.weight,
  };
  const vw = p.width(s.v, o);
  const gap = s.u ? (unit.gap ?? 0.5 * U) : 0;
  const uw = s.u ? p.width(s.u, uo) : 0;
  const start = align === 'right' ? x - vw - gap - uw : x;
  p.text(s.v, start, y, o);
  if (s.u) p.text(s.u, start + vw + gap, y, uo);
  return vw + gap + uw;
}

function chips(
  p: Pen,
  list: string[],
  x: number,
  top: number,
  width: number,
  die: boolean,
  ink: string,
) {
  const size = 2.5 * U;
  const padX = 2 * U;
  const h = size + 1.6 * U;
  const gap = 1.2 * U;
  let cx = x;
  let cy = top;
  list.forEach((label, i) => {
    const w = p.width(label, { size, weight: 600, family: 'tight' }) + padX * 2;
    if (cx > x && cx + w > x + width) {
      cx = x;
      cy += h + gap;
    }
    const hot = i === 0;
    const t = p.theme;
    p.rect(
      cx,
      cy,
      w,
      h,
      h / 2,
      hot ? t.accent : rgba(t.wr, die ? 0.14 : 0.16),
      hot ? t.accent : die ? rgba(hexRgb(ink), 0.45) : rgba(t.wr, 0.26),
      2,
    );
    p.text(label, cx + padX, cy + baseline(size, 1) + 0.8 * U, {
      size,
      weight: 600,
      family: 'tight',
      color: hot ? '#10130a' : ink,
      glow: null,
    });
    cx += w + gap;
  });
  return list.length ? cy + h - top : 0;
}

/** Three stats in a row: value (with unit) over a label. Returns the height used. */
function s3(
  p: Pen,
  stats: StoryStat[],
  x: number,
  top: number,
  width: number,
  o: {
    vSize: number;
    vWeight: number;
    vFamily: Family;
    lSize: number;
    lFamily: Family;
    lWeight?: number;
    lAlpha: number;
    lGap: number;
    unitScale: number;
    color: string;
  },
) {
  const cols = 3;
  const gap = 2 * U;
  const cw = (width - gap * (cols - 1)) / cols;
  stats.slice(0, 3).forEach((s, i) => {
    const cx = x + i * (cw + gap);
    const vo = { size: o.vSize, weight: o.vWeight, family: o.vFamily, color: o.color };
    // A long value shrinks to fit its column.
    const vw =
      p.width(s.v, vo) + (s.u ? p.width(s.u, { ...vo, size: o.vSize * o.unitScale }) + 0.5 * U : 0);
    const k = vw > cw ? cw / vw : 1;
    valueUnit(
      p,
      s,
      cx,
      top + o.vSize * 0.85,
      { ...vo, size: o.vSize * k },
      { scale: o.unitScale, alpha: 0.8, gap: 0.5 * U * k },
    );
    const lo = {
      size: o.lSize,
      weight: o.lWeight ?? 400,
      family: o.lFamily,
      color: o.color,
      alpha: o.lAlpha,
    };
    const lk = Math.min(1, cw / Math.max(1, p.width(s.l, lo)));
    p.text(s.l, cx, top + o.vSize + o.lGap + o.lSize * 0.85, { ...lo, size: o.lSize * lk });
  });
  return o.vSize + o.lGap + o.lSize * 1.1;
}

function extra(p: Pen, c: StoryContent, x: number, top: number, width: number, fam: Family) {
  const t = p.theme;
  const e = c.extra;
  if (e.type === 'grid') {
    const gap = 1 * U;
    const d = (width - gap * 11) / 12;
    if (!p.dry)
      e.items.forEach((on, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        const cx = x + col * (d + gap) + d / 2;
        const cy = top + row * (d + gap) + d / 2;
        p.ctx.beginPath();
        p.ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
        p.ctx.fillStyle = on ? t.accent : rgba(t.wr, 0.16);
        p.ctx.fill();
      });
    return 7 * d + 6 * gap;
  }
  const size = 2.7 * U;
  const lh = 1.85;
  const rowH = size * lh;
  const o = { size, weight: 400, family: fam, color: t.tx };
  if (e.type === 'lines') {
    e.items.forEach((it, i) => {
      const y = top + i * rowH + baseline(size, lh);
      const rw = p.width(it.r, o);
      const maxL = width - rw - 4 * U;
      let label = it.l;
      while (label.length > 3 && p.width(label, o) > maxL) label = label.slice(0, -2);
      if (label !== it.l) label = `${label.trimEnd()}…`;
      const lw = p.text(label, x, y, o);
      p.text(it.r, x + width, y, { ...o, align: 'right' });
      p.line(
        x + lw + 1.4 * U,
        y + 0.2 * U,
        x + width - rw - 1.4 * U,
        y + 0.2 * U,
        rgba(t.wr, 0.4),
        2,
        [3, 6],
      );
    });
    return e.items.length * rowH;
  }
  const max = Math.max(...e.items.map((i) => i.v), 1);
  const min = Math.min(...e.items.map((i) => i.v));
  const lw = 11 * U;
  e.items.forEach((it, i) => {
    const y = top + i * rowH;
    const vw = p.width(it.label, o);
    p.text(it.l, x, y + baseline(size, lh), o);
    const bx = x + lw;
    const bw = width - lw - vw - 2 * U;
    // Bars start a little below the lowest value so the steps show.
    const floor = min - (max - min) * 0.6;
    const frac = max > floor ? (it.v - floor) / (max - floor) : 1;
    const by = y + rowH / 2 - 0.9 * U;
    p.rect(bx, by, bw, 1.8 * U, 0.9 * U, rgba(t.wr, 0.14));
    p.rect(bx, by, Math.max(1.8 * U, bw * frac), 1.8 * U, 0.9 * U, t.accent);
    p.text(it.label, x + width, y + baseline(size, lh), { ...o, align: 'right' });
  });
  return e.items.length * rowH;
}

function star(ctx: Ctx, cx: number, cy: number, R: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    const px = cx + rad * Math.cos(a);
    const py = cy + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const TIER = { gold: '#f2c14e', silver: '#cfd5dc', bronze: '#cd8a4f' } as const;

function medal(p: Pen, c: StoryContent, x: number, y: number, size: number) {
  if (p.dry) return;
  const ctx = p.ctx;
  const k = size / 48;
  const color = c.tier ? TIER[c.tier] : p.theme.accent;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(24, 24, 22, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(24, 24, 17, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(16,19,10,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  star(ctx, 24, 24.5, 11, 4.6);
  ctx.fillStyle = '#10130a';
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The seven designs: each lays out its box at its natural width and returns its height
// ---------------------------------------------------------------------------------------------

interface DesignArgs {
  p: Pen;
  c: StoryContent;
  s: StoryStyle;
  w: number;
  /** The height from the dry pass, for panels drawn before their contents. */
  h: number;
  /** Text colour inside the box (the die-cut sticker can turn dark on a solid accent). */
  ink: string;
}

const bigCap = (c: StoryContent, cap: number) => cap * (c.rank ? 1.7 : 1) * U;

function bigNumber(
  a: DesignArgs,
  top: number,
  width: number,
  cap: number,
  o: {
    weight: number;
    color: string;
    unitScale: number;
    unitColor: string;
    unitWeight: number;
    glow?: string | null;
  },
) {
  const { p, c } = a;
  const fam = a.p.main;
  const unitGap = 1.2 * U;
  const probe = (size: number) =>
    p.width(c.big.v, { size, weight: o.weight, family: fam }) +
    (c.big.u
      ? unitGap + p.width(c.big.u, { size: size * o.unitScale, weight: o.unitWeight, family: fam })
      : 0);
  let size = bigCap(c, cap);
  while (size > 8 && probe(size) > width) size *= 0.96;
  const y = top + size * 0.82;
  valueUnit(
    p,
    c.big,
    0,
    y,
    { size, weight: o.weight, family: fam, color: o.color, glow: o.glow },
    { scale: o.unitScale, color: o.unitColor, weight: o.unitWeight, gap: unitGap },
  );
  return size;
}

const DESIGN_DRAW: Record<DesignId, (a: DesignArgs) => number> = {
  // A. Sticker stats: no panel, Strava style.
  A(a) {
    const { p, c, w } = a;
    const t = p.theme;
    const fam = p.main;
    let y = 0;
    const ts = 3.5 * U;
    const tw = p.text(c.title, 0, y + baseline(ts, 1.45), {
      size: ts,
      weight: 600,
      family: fam,
      color: t.accent,
    });
    p.text(c.sub, tw + 1.6 * U, y + baseline(ts, 1.45), {
      size: ts,
      weight: 400,
      family: fam,
      color: t.tx,
      alpha: 0.75,
    });
    y += ts * 1.45 + 1 * U;
    const size = bigNumber(a, y, w - 2 * U, 12.5, {
      weight: 800,
      color: t.tx,
      unitScale: 0.34,
      unitColor: t.accent,
      unitWeight: 600,
    });
    y += size;
    y += 0.8 * U;
    y += p.para(`${c.big.l}. ${c.note}`, 0, y, w, 1.45, {
      size: 2.9 * U,
      family: 'tight',
      color: t.tx,
      alpha: 0.88,
    });
    y += 3 * U;
    p.line(0, y, w, y, rgba(t.wr, 0.35), 2);
    y += 3 * U;
    const four = [...c.stats, ...(c.more ? [c.more] : [])].slice(0, 4);
    const colW = (w - 4 * U) / 2;
    const cellH = 2.5 * U * 1.3 + 5.2 * U * 1.1;
    four.forEach((st, i) => {
      const cx = (i % 2) * (colW + 4 * U);
      const cy = y + Math.floor(i / 2) * (cellH + 2.4 * U);
      p.text(st.l, cx, cy + 2.5 * U * 0.9, {
        size: 2.5 * U,
        family: 'tight',
        color: t.tx,
        alpha: 0.72,
      });
      valueUnit(
        p,
        st,
        cx,
        cy + 2.5 * U * 1.3 + 5.2 * U * 0.9,
        { size: 5.2 * U, weight: 600, family: fam, color: t.tx },
        { scale: 0.5, alpha: 0.8 },
      );
    });
    y += Math.ceil(four.length / 2) * cellH + (Math.ceil(four.length / 2) - 1) * 2.4 * U;
    if (a.s.tags && c.chips.length) {
      y += 2.6 * U;
      y += chips(p, c.chips.slice(0, 3), 0, y, w, false, t.tx);
    }
    return y;
  },

  // B. Receipt: glass panel, mono type, barcode.
  B(a) {
    const { p, c, w } = a;
    const t = p.theme;
    const fam = p.main;
    const pad = 4 * U;
    const inner = w - pad * 2;
    glass(a, 3.6 * U);
    let y = pad;
    const gap = 2.6 * U;
    const hs = 2.7 * U;
    const subW = p.width(c.sub, { size: hs, family: fam });
    let title = c.title;
    while (
      title.length > 3 &&
      p.width(title, { size: hs, weight: 700, family: fam }) > inner - subW - 2 * U
    )
      title = title.slice(0, -2);
    if (title !== c.title) title = `${title.trimEnd()}…`;
    p.text(title, pad, y + baseline(hs, 1.45), {
      size: hs,
      weight: 700,
      family: fam,
      color: t.accent,
    });
    p.text(c.sub, w - pad, y + baseline(hs, 1.45), {
      size: hs,
      family: fam,
      color: t.tx,
      alpha: 0.9,
      align: 'right',
    });
    y += hs * 1.45 + gap;
    y += extra(p, c, pad, y, inner, fam) + gap;
    p.line(pad, y, w - pad, y, rgba(t.wr, 0.45), 2, [8, 6]);
    y += 2.4 * U;
    const totS = 5.6 * U;
    p.text(c.big.l, pad, y + totS * 0.85, { size: 2.8 * U, family: fam, color: t.tx });
    valueUnit(
      p,
      c.big,
      w - pad,
      y + totS * 0.85,
      { size: totS, weight: 700, family: fam, color: t.tx },
      { scale: 0.46, color: t.accent, gap: 0.8 * U },
      'right',
    );
    y += totS * 1.1 + gap;
    y +=
      p.para(c.note, pad, y, inner, 1.45, { size: 2.5 * U, family: fam, color: t.tx, alpha: 0.8 }) +
      gap;
    p.line(pad, y, w - pad, y, rgba(t.wr, 0.45), 2, [8, 6]);
    y += 2.4 * U;
    y +=
      s3(p, c.stats, pad, y, inner, {
        vSize: 3.6 * U,
        vWeight: 700,
        vFamily: fam,
        lSize: 2.2 * U,
        lFamily: fam,
        lAlpha: 0.75,
        lGap: 0.5 * U,
        unitScale: 0.7,
        color: t.tx,
      }) + gap;
    // Barcode: fixed stripes, only decoration.
    if (!p.dry) {
      const bars = [
        1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1,
        1, 2, 1, 2, 1,
      ];
      const total = bars.reduce((s, n) => s + n, 0);
      let bx = pad;
      bars.forEach((n, i) => {
        const bw = (n / total) * inner;
        if (i % 2 === 0) p.rect(bx, y, bw, 6 * U, 0, t.tx);
        bx += bw;
      });
    }
    y += 6 * U + gap;
    const th = `${c.short}${c.time ? ` · ${c.time}` : ''} · thanks for lifting`;
    p.text(th, w / 2, y + 2.3 * U * 0.9, {
      size: 2.3 * U,
      family: fam,
      color: t.tx,
      alpha: 0.7,
      align: 'center',
    });
    y += 2.3 * U * 1.3 + pad;
    return y;
  },

  // C. LED scoreboard: dotted panel, glowing number.
  C(a) {
    const { p, c, w } = a;
    const t = p.theme;
    const fam = p.main;
    const pad = 3.6 * U;
    const inner = w - pad * 2;
    if (!p.dry) {
      p.rect(0, 0, w, a.h, 3.4 * U, rgba(t.pb, t.bo * 1.1), rgba(t.wr, 0.28), 2);
      const ctx = p.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, w, a.h, 3.4 * U);
      ctx.clip();
      ctx.fillStyle = rgba(t.wr, 0.12);
      const step = 1.1 * U;
      for (let yy = step / 2; yy < a.h; yy += step)
        for (let xx = step / 2; xx < w; xx += step) ctx.fillRect(xx - 1.2, yy - 1.2, 2.4, 2.4);
      ctx.restore();
    }
    let y = pad;
    const ts = 3.2 * U;
    const subW = p.width(c.sub, { size: ts, family: fam });
    let title = c.title;
    while (
      title.length > 3 &&
      p.width(title, { size: ts, weight: 700, family: fam }) > inner - subW - 2 * U
    )
      title = title.slice(0, -2);
    if (title !== c.title) title = `${title.trimEnd()}…`;
    p.text(title, pad, y + baseline(ts, 1.45), {
      size: ts,
      weight: 700,
      family: fam,
      color: t.accent,
    });
    p.text(c.sub, w - pad, y + baseline(ts, 1.45), {
      size: ts,
      weight: 700,
      family: fam,
      color: t.tx,
      alpha: 0.8,
      align: 'right',
    });
    y += ts * 1.45 + 2 * U;
    const ctx = p.ctx;
    ctx.save();
    ctx.translate(pad, 0);
    const size = bigNumber(a, y, inner, 13, {
      weight: 700,
      color: t.accent,
      unitScale: 0.38,
      unitColor: t.accent,
      unitWeight: 700,
      glow: t.accent,
    });
    ctx.restore();
    y += size + 1 * U;
    y += p.para(`${c.big.l} · ${c.note}`, pad, y, inner, 1.45, {
      size: 3 * U,
      weight: 700,
      family: fam,
      color: t.tx,
      alpha: 0.9,
    });
    y += 3 * U;
    p.line(pad, y, w - pad, y, rgba(t.wr, 0.4), 2, [3, 6]);
    y += 3 * U;
    y += s3(p, c.stats, pad, y, inner, {
      vSize: 5.4 * U,
      vWeight: 700,
      vFamily: fam,
      lSize: 2.5 * U,
      lFamily: fam,
      lWeight: 700,
      lAlpha: 0.8,
      lGap: 0.8 * U,
      unitScale: 0.55,
      color: t.tx,
    });
    if (a.s.tags && c.chips.length) {
      y += 3 * U;
      y += p.para(
        c.chips
          .slice(0, 2)
          .map((x) => `[ ${x} ]`)
          .join(' '),
        pad,
        y,
        inner,
        1.45,
        { size: 2.8 * U, weight: 700, family: fam, color: t.accent, alpha: 0.95 },
      );
    }
    return y + pad;
  },

  // D. Achievement unlocked: medal, glass panel.
  D(a) {
    const { p, c, w } = a;
    const t = p.theme;
    const fam = p.main;
    const pad = 3.6 * U;
    const inner = w - pad * 2;
    glass(a, 4.4 * U);
    let y = pad;
    const m = 11 * U;
    medal(p, c, pad, y, m);
    const tx = pad + m + 3 * U;
    const tw = w - pad - tx;
    const head = p.wrap(c.ach.h, tw, { size: 4.2 * U, weight: 600, family: fam });
    const blockH = 2.5 * U * 1.4 + head.length * 4.2 * U * 1.15;
    const by = y + Math.max(0, (m - blockH) / 2);
    p.text('Achievement unlocked', tx, by + 2.5 * U * 0.9, {
      size: 2.5 * U,
      weight: 500,
      family: 'tight',
      color: t.tx,
      alpha: 0.75,
    });
    head.forEach((l, i) =>
      p.text(l, tx, by + 2.5 * U * 1.4 + baseline(4.2 * U, 1.15) + i * 4.2 * U * 1.15, {
        size: 4.2 * U,
        weight: 600,
        family: fam,
        color: t.tx,
      }),
    );
    y += Math.max(m, blockH) + 3.4 * U;
    const ctx = p.ctx;
    ctx.save();
    ctx.translate(pad, 0);
    const size = bigNumber(a, y, inner, 9, {
      weight: 600,
      color: t.tx,
      unitScale: 0.36,
      unitColor: t.accent,
      unitWeight: 600,
    });
    ctx.restore();
    y += size + 1 * U;
    y += p.para(`${c.big.l}. ${c.ach.s}`, pad, y, inner, 1.45, {
      size: 2.8 * U,
      family: 'tight',
      color: t.tx,
      alpha: 0.85,
    });
    y += 3 * U;
    p.line(pad, y, w - pad, y, rgba(t.wr, 0.22), 2);
    y += 3 * U;
    y += s3(p, c.stats, pad, y, inner, {
      vSize: 4 * U,
      vWeight: 600,
      vFamily: fam,
      lSize: 2.4 * U,
      lFamily: 'tight',
      lAlpha: 0.72,
      lGap: 1 * U,
      unitScale: 0.55,
      color: t.tx,
    });
    if (a.s.tags && c.chips.length) {
      y += 2.6 * U;
      y += chips(p, c.chips.slice(0, 2), pad, y, inner, false, t.tx);
    }
    return y + pad;
  },

  // E. Die-cut sticker: accent panel, white border, handwritten tag.
  E(a) {
    const { p, c, w, ink } = a;
    const t = p.theme;
    const fam = p.main;
    const padX = 3.8 * U;
    const padY = 3.4 * U;
    const border = 1.2 * U;
    const inner = w - padX * 2 - border * 2;
    const x0 = border + padX;
    if (!p.dry) {
      const ctx = p.ctx;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4 * U;
      ctx.shadowOffsetY = 1.2 * U;
      p.rect(0, 0, w, a.h, 5.4 * U, '#ffffff');
      ctx.restore();
      // The inside: clear (photo through) blended with the accent by the box opacity.
      glassInside(a, border, 5.4 * U - border);
      p.rect(
        border,
        border,
        w - border * 2,
        a.h - border * 2,
        5.4 * U - border,
        rgba(hexRgb(t.accent), t.bo),
      );
    }
    let y = border + padY;
    const ts = 3.2 * U;
    const glow = ink === '#10130a' ? null : undefined;
    const subW = p.width(c.sub, { size: ts, weight: 600, family: fam });
    let title = c.title;
    while (
      title.length > 3 &&
      p.width(title, { size: ts, weight: 600, family: fam }) > inner - subW - 2 * U
    )
      title = title.slice(0, -2);
    if (title !== c.title) title = `${title.trimEnd()}…`;
    p.text(title, x0, y + baseline(ts, 1.45), {
      size: ts,
      weight: 600,
      family: fam,
      color: ink,
      glow,
    });
    p.text(c.sub, x0 + inner, y + baseline(ts, 1.45), {
      size: ts,
      weight: 600,
      family: fam,
      color: ink,
      align: 'right',
      glow,
    });
    y += ts * 1.45 + 1 * U;
    const ctx = p.ctx;
    ctx.save();
    ctx.translate(x0, 0);
    const size = bigNumber(a, y, inner, 13, {
      weight: 800,
      color: ink,
      unitScale: 0.34,
      unitColor: ink,
      unitWeight: 800,
      glow,
    });
    ctx.restore();
    y += size * 0.95 + 0.8 * U;
    y += p.para(`${c.big.l}. ${c.note}`, x0, y, inner, 1.45, {
      size: 2.7 * U,
      weight: 600,
      family: 'tight',
      color: ink,
      glow,
    });
    y += 2.6 * U;
    p.line(x0, y, x0 + inner, y, rgba(hexRgb(ink), 0.7), 0.5 * U);
    y += 2.4 * U;
    y += s3(p, c.stats, x0, y, inner, {
      vSize: 4.6 * U,
      vWeight: 800,
      vFamily: fam,
      lSize: 2.3 * U,
      lFamily: 'tight',
      lWeight: 600,
      lAlpha: 0.8,
      lGap: 0.8 * U,
      unitScale: 0.55,
      color: ink,
    });
    if (a.s.tags && c.chips.length) {
      y += 2.4 * U;
      y += chips(p, c.chips.slice(0, 2), x0, y, inner, true, ink);
    }
    y += padY + border;
    if (a.s.tags && !p.dry) handTag(p, c.hand, w + 3 * U, -4.2 * U, 7);
    return y;
  },

  // F. Caption note: editorial serif, no panel.
  F(a) {
    const { p, c, w } = a;
    const t = p.theme;
    const fam = p.main;
    let y = 0;
    const meta = `${c.short}${c.time ? ` · ${c.time}` : ''} · ${c.sub}`;
    const ms = Math.min(2.5 * U, p.fit(meta, w, 2.5 * U, { family: 'mono' }));
    p.text(meta, 0, y + ms * 0.9, { size: ms, family: 'mono', color: t.tx, alpha: 0.8 });
    y += ms * 1.4 + 1.4 * U;
    const titleSize = p.fit(c.title, w, 9 * U * (c.rank ? 1.3 : 1), {
      family: fam,
      italic: fam === 'serif',
    });
    p.text(c.title, 0, y + titleSize * 0.82, {
      size: titleSize,
      family: fam,
      italic: fam === 'serif',
      color: t.tx,
    });
    y += titleSize + 0.6 * U;
    const big = `${c.big.v}${c.big.u ? ` ${c.big.u}` : ''}, ${c.big.l.toLowerCase()}. ${c.note}.`;
    y += p.para(big, 0, y, w, 1.3, {
      size: 4 * U,
      family: fam,
      italic: fam === 'serif',
      color: t.tx,
      alpha: 0.9,
    });
    y += 3 * U;
    p.line(0, y, w, y, rgba(t.wr, 0.5), 2);
    y += 2.8 * U;
    let cx = 0;
    const vs = 5.4 * U;
    c.stats.forEach((st) => {
      const vw =
        p.width(st.v, { size: vs, family: fam }) +
        (st.u ? 0.5 * U + p.width(st.u, { size: vs * 0.55, family: fam }) : 0);
      const lw = p.width(st.l, { size: 2 * U, family: 'mono' });
      const cw = Math.max(vw, lw);
      valueUnit(
        p,
        st,
        cx,
        y + vs * 0.85,
        { size: vs, family: fam, color: t.tx },
        { scale: 0.55, alpha: 0.8 },
      );
      p.text(st.l, cx, y + vs + 0.9 * U + 2 * U * 0.85, {
        size: 2 * U,
        family: 'mono',
        color: t.tx,
        alpha: 0.75,
      });
      cx += cw + 3.4 * U;
    });
    y += vs + 0.9 * U + 2 * U * 1.2;
    if (a.s.tags) {
      y += 3 * U;
      const hs = 4 * U;
      if (!p.dry) {
        const ctx = p.ctx;
        ctx.save();
        ctx.translate(0, y + hs);
        ctx.rotate((-3 * Math.PI) / 180);
        const tw = p.text(c.hand, 0, 0, { size: hs, family: 'marker', color: t.accent });
        // A little drawn arrow after the words.
        ctx.translate(tw + 1.2 * U, -hs * 0.55);
        const k = (7 * U) / 28;
        ctx.scale(k, k);
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(2, 14);
        ctx.bezierCurveTo(9, 3, 17, 3, 24, 9);
        ctx.moveTo(24, 9);
        ctx.lineTo(18, 8);
        ctx.moveTo(24, 9);
        ctx.lineTo(21, 15);
        ctx.stroke();
        ctx.restore();
      }
      y += hs * 1.5;
    }
    return y;
  },

  // G. Rings widget: three real rings in a glass panel.
  G(a) {
    const { p, c, w } = a;
    const t = p.theme;
    const fam = p.main;
    const pad = 3.4 * U;
    const inner = w - pad * 2;
    glass(a, 4.4 * U);
    let y = pad;
    const ts = 3.3 * U;
    const subW = p.width(c.sub, { size: ts, family: fam });
    let title = c.title;
    while (
      title.length > 3 &&
      p.width(title, { size: ts, weight: 600, family: fam }) > inner - subW - 2 * U
    )
      title = title.slice(0, -2);
    if (title !== c.title) title = `${title.trimEnd()}…`;
    p.text(title, pad, y + baseline(ts, 1.45), { size: ts, weight: 600, family: fam, color: t.tx });
    p.text(c.sub, w - pad, y + baseline(ts, 1.45), {
      size: ts,
      family: fam,
      color: t.tx,
      alpha: 0.7,
      align: 'right',
    });
    y += ts * 1.45 + 2.6 * U;
    const rs = 21 * U;
    const op = [1, 0.7, 0.45];
    if (!p.dry) {
      const ctx = p.ctx;
      const k = rs / 100;
      [44, 34, 24].forEach((r, i) => {
        const ring = c.rings[i];
        ctx.save();
        ctx.translate(pad, y);
        ctx.scale(k, k);
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(50, 50, r, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(t.wr, 0.16);
        ctx.stroke();
        if (ring && ring.frac > 0) {
          ctx.beginPath();
          ctx.arc(50, 50, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, ring.frac));
          ctx.strokeStyle = t.accent;
          ctx.globalAlpha = op[i]!;
          ctx.stroke();
        }
        ctx.restore();
      });
    }
    const lx = pad + rs + 3.4 * U;
    const lw = w - pad - lx;
    const itemH = 4.4 * U + 0.6 * U + 2.3 * U * 1.2;
    const legendH = c.rings.length * itemH + (c.rings.length - 1) * 1.6 * U;
    let ly = y + Math.max(0, (rs - legendH) / 2);
    c.rings.forEach((ring, i) => {
      const vo = { size: 4.4 * U, weight: 600, family: fam, color: t.tx };
      const vw =
        p.width(ring.stat.v, vo) +
        (ring.stat.u ? 0.5 * U + p.width(ring.stat.u, { ...vo, size: 4.4 * U * 0.55 }) : 0);
      const k = vw > lw ? lw / vw : 1;
      valueUnit(
        p,
        ring.stat,
        lx,
        ly + 4.4 * U * 0.85 * k,
        { ...vo, size: 4.4 * U * k },
        { scale: 0.55, alpha: 0.8 },
      );
      const dy = ly + 4.4 * U + 0.6 * U;
      if (!p.dry) {
        p.ctx.save();
        p.ctx.globalAlpha = op[i]!;
        p.ctx.beginPath();
        p.ctx.arc(lx + 0.9 * U, dy + 1.1 * U, 0.9 * U, 0, Math.PI * 2);
        p.ctx.fillStyle = t.accent;
        p.ctx.fill();
        p.ctx.restore();
      }
      const lo = { size: 2.3 * U, family: 'tight' as Family, color: t.tx, alpha: 0.8 };
      const lk = Math.min(1, (lw - 2.8 * U) / Math.max(1, p.width(ring.stat.l, lo)));
      p.text(ring.stat.l, lx + 2.8 * U, dy + 2.3 * U * 0.9, { ...lo, size: 2.3 * U * lk });
      ly += itemH + 1.6 * U;
    });
    y += Math.max(rs, legendH) + 2.4 * U;
    y += p.para(
      `Rings: ${c.ringsNote.charAt(0).toLowerCase()}${c.ringsNote.slice(1)}.`,
      pad,
      y,
      inner,
      1.45,
      { size: 2.6 * U, family: 'tight', color: t.tx, alpha: 0.85 },
    );
    if (a.s.tags && c.chips.length) {
      y += 2.6 * U;
      y += chips(p, c.chips.slice(0, 2), pad, y, inner, false, t.tx);
    }
    return y + pad;
  },
};

function handTag(p: Pen, s: string, right: number, top: number, deg: number) {
  const ctx = p.ctx;
  const size = 3.3 * U;
  const w = p.width(s, { size, family: 'marker' }) + 4.4 * U;
  const h = size + 1.6 * U;
  ctx.save();
  ctx.translate(right - w / 2, top + h / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 2 * U;
  ctx.shadowOffsetY = 0.8 * U;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 1.4 * U);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(right - w / 2, top + h / 2);
  ctx.rotate((deg * Math.PI) / 180);
  p.text(s, 0, size * 0.32, {
    size,
    family: 'marker',
    color: '#10130a',
    align: 'center',
    glow: null,
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Glass: the blurred background seen through a panel
// ---------------------------------------------------------------------------------------------

let blurSource: HTMLCanvasElement | null = null;
/** The current card's blurred background, set by `renderStory` before the box is drawn. */
let baseTransform: DOMMatrix | null = null;

function glassInside(a: DesignArgs, inset: number, radius: number) {
  const { p, w, h } = a;
  if (p.dry || !blurSource || !baseTransform) return;
  const ctx = p.ctx;
  const bo = p.theme.bo;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, radius);
  ctx.clip();
  ctx.save();
  ctx.setTransform(baseTransform);
  ctx.globalAlpha = Math.min(1, bo * 1.6);
  ctx.drawImage(blurSource, 0, 0, CARD_W, CARD_H);
  ctx.restore();
  ctx.restore();
}

function glass(a: DesignArgs, radius: number) {
  const { p, w, h } = a;
  if (p.dry) return;
  const t = p.theme;
  glassInside(a, 0, radius);
  p.rect(0, 0, w, h, radius, rgba(t.pb, t.bo), rgba(t.wr, 0.3), 2);
}

// ---------------------------------------------------------------------------------------------
// The whole card
// ---------------------------------------------------------------------------------------------

export interface StoryPhoto {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderInput {
  content: StoryContent;
  style: StoryStyle;
  photo: StoryPhoto | null;
  /** The person's first name for the date line, or null. */
  name: string | null;
}

export interface RenderResult {
  geometry: BoxGeometry;
  /** The box's natural size, for moving and resizing in the editor. */
  w0: number;
  h0: number;
}

function drawBackground(ctx: Ctx, style: StoryStyle, photo: StoryPhoto | null) {
  ctx.fillStyle = '#0a0b08';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (style.background === 'photo' && photo) {
    const k = Math.max(CARD_W / photo.width, CARD_H / photo.height);
    const w = photo.width * k;
    const h = photo.height * k;
    ctx.drawImage(photo.image, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
    return;
  }
  const glow = (cx: number, cy: number, rx: number, ry: number, rgb: string, a: number) => {
    ctx.save();
    ctx.translate(cx * CARD_W, cy * CARD_H);
    ctx.scale(rx * CARD_W, ry * CARD_H);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(rgb, a));
    g.addColorStop(0.72, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };
  switch (style.background === 'photo' ? 'bg1' : style.background) {
    case 'bg2':
      ctx.fillStyle = '#080a12';
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      glow(0.18, 0.18, 0.7, 0.38, '124,92,255', 0.75);
      glow(0.9, 0.7, 0.65, 0.4, '60,200,255', 0.6);
      break;
    case 'bg3':
      ctx.fillStyle = '#120a0c';
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      glow(0.72, 0.22, 0.7, 0.38, '255,176,90', 0.75);
      glow(0.15, 0.78, 0.65, 0.4, '255,80,110', 0.55);
      break;
    case 'bg4': {
      glow(0.5, 0.28, 0.7, 0.4, '210,242,92', 0.28);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 2;
      const step = 6 * U;
      ctx.beginPath();
      for (let x = 0; x <= CARD_W; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CARD_H);
      }
      for (let y = 0; y <= CARD_H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(CARD_W, y);
      }
      ctx.stroke();
      break;
    }
    default:
      glow(0.5, 0.3, 0.7, 0.42, '210,242,92', 0.5);
      glow(0.5, 1, 0.6, 0.3, '210,242,92', 0.22);
  }
}

let noise: HTMLCanvasElement | null = null;
function grain(ctx: Ctx) {
  if (!noise) {
    noise = document.createElement('canvas');
    noise.width = 180;
    noise.height = 180;
    const n = noise.getContext('2d');
    if (n) {
      const img = n.createImageData(180, 180);
      // A fixed pattern so the same card always draws the same.
      let seed = 7;
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 16807) % 2147483647;
        const v = (seed % 256) | 0;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 60;
      }
      n.putImageData(img, 0, 0);
    }
  }
  const pattern = ctx.createPattern(noise, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
}

function shade(ctx: Ctx, style: StoryStyle) {
  const d = style.dim / 100;
  const shc = style.ink === 'black' ? '255,255,255' : '0,0,0';
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, rgba(shc, d * 0.55));
  g.addColorStop(0.3, rgba(shc, d * 0.08));
  g.addColorStop(0.52, rgba(shc, d * 0.12));
  g.addColorStop(1, rgba(shc, d * 0.78));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

function brand(
  ctx: Ctx,
  style: StoryStyle,
  content: StoryContent,
  name: string | null,
  theme: Theme,
) {
  const bs = BRAND_SIZE[style.brandSize] * U;
  const top = style.brand === 'safe' ? 24.5 * U : 7 * U;
  const right = CARD_W - (style.brand === 'safe' ? 8.3 * U : 6 * U);
  const pen = new Pen(ctx, false, theme, 'tight', rgba(theme.sh, 0.5));
  const nameW = pen.width('Macrotrophy', { size: bs, weight: 800, family: 'tight' });
  const ms = bs * 1.55;
  const gap = bs * 0.4;
  const cy = top + ms / 2;
  pen.text('Macrotrophy', right, cy + bs * 0.36, {
    size: bs,
    weight: 800,
    family: 'tight',
    color: theme.tx,
    align: 'right',
  });
  ctx.save();
  ctx.translate(right - nameW - gap - ms / 2, cy);
  const k = ms / 104;
  ctx.scale(k, k);
  ctx.shadowColor = rgba(theme.sh, 0.4);
  ctx.shadowBlur = 20;
  ctx.fillStyle = theme.tx;
  ctx.fill(new Path2D(MARK_WHITE));
  ctx.fillStyle = '#d2f25c';
  ctx.fill(new Path2D(MARK_LIME));
  ctx.restore();
  const date = `${style.showName && name ? `${name} · ` : ''}${content.date}`;
  pen.text(date, right, top + ms + 1.2 * U + 3 * U * 0.9, {
    size: 3 * U,
    weight: 500,
    family: 'tight',
    color: theme.tx,
    alpha: 0.88,
    align: 'right',
  });
}

function themeFor(style: StoryStyle): Theme {
  const dark = style.ink === 'black';
  return {
    tx: dark ? '#0b0b0a' : '#ffffff',
    wr: dark ? '10,10,10' : '255,255,255',
    sh: dark ? '255,255,255' : '0,0,0',
    pb: dark ? '255,255,255' : '14,14,12',
    accent: style.accent,
    bo: style.boxOpacity / 100,
  };
}

function prepareBlur(ctx: Ctx, style: StoryStyle, photo: StoryPhoto | null) {
  // A small copy of the background, scaled back up, reads as a strong blur on every browser
  // (canvas filters are not available everywhere).
  const small = document.createElement('canvas');
  small.width = 54;
  small.height = 96;
  const s = small.getContext('2d');
  if (!s) return null;
  s.drawImage(ctx.canvas, 0, 0, small.width, small.height);
  void style;
  void photo;
  const out = document.createElement('canvas');
  out.width = 270;
  out.height = 480;
  const o = out.getContext('2d');
  if (!o) return null;
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  o.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

/** Draws the whole card. `editing` adds the safe-area guides, never part of a saved image. */
export function renderStory(
  ctx: Ctx,
  input: RenderInput,
  opts: { editing?: boolean; guides?: boolean } = {},
): RenderResult {
  const { content, style, photo, name } = input;
  const design = DESIGNS.find((d) => d.id === style.design) ?? DESIGNS[0]!;
  const main: Family = style.font === 'auto' ? design.font : style.font;
  const theme = themeFor(style);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  baseTransform = ctx.getTransform();
  drawBackground(ctx, style, photo);
  grain(ctx);
  shade(ctx, style);
  blurSource = prepareBlur(ctx, style, photo);

  if (opts.guides) {
    ctx.save();
    ctx.setLineDash([16, 12]);
    ctx.strokeStyle = rgba(theme.wr, 0.55);
    ctx.lineWidth = 3;
    [SAFE_TOP, SAFE_BOTTOM].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CARD_W, y);
      ctx.stroke();
    });
    ctx.restore();
  }
  brand(ctx, style, content, name, theme);

  const w0 = design.width * U;
  const solid = theme.bo >= 0.7;
  const ink = style.design === 'E' && solid ? '#10130a' : theme.tx;
  const textGlow =
    style.design === 'A' || style.design === 'F' ? rgba(theme.sh, 0.35) : rgba(theme.sh, 0.6);
  const args = (dry: boolean, h: number): DesignArgs => ({
    p: new Pen(ctx, dry, theme, main, textGlow),
    c: content,
    s: style,
    w: w0,
    h,
    ink,
  });
  ctx.save();
  const h0 = DESIGN_DRAW[design.id](args(true, 0));
  ctx.restore();
  const g = boxGeometry(style.placement, w0, h0);
  ctx.save();
  ctx.translate(g.left, g.top);
  ctx.scale(g.scale, g.scale);
  ctx.translate(w0 / 2, h0 / 2);
  ctx.rotate((style.placement.tilt * Math.PI) / 180);
  ctx.translate(-w0 / 2, -h0 / 2);
  DESIGN_DRAW[design.id](args(false, h0));
  ctx.restore();
  ctx.restore();
  blurSource = null;
  baseTransform = null;
  return { geometry: g, w0, h0 };
}
