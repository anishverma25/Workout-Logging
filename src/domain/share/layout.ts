/**
 * Where the stats box sits on a story card, and how it moves and grows (share cards 2.0). Pure
 * geometry in card pixels (1080 × 1920), shared by the editor and the final drawing so the saved
 * image is exactly what the person arranged.
 *
 * The position is a fraction of the free room (`px`, `py` from 0 to 1), so it stays sensible
 * when the box is resized or the design changes. The box may go partly off the card, but at
 * least `KEEP` of it always stays on, so it can be grabbed back.
 */

export const CARD_W = 1080;
export const CARD_H = 1920;
/** Instagram covers the top 250 px and the bottom 270 px with its own controls. */
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = 1650;

export const SIZE_MIN = 30;
export const SIZE_MAX = 220;
/** At 100% the box is drawn at 1.15 times its natural width (confirmed in the preview). */
export const BASE_SCALE = 1.15;
export const KEEP = 0.15;
export const TILT_MAX = 12;

export interface BoxPlacement {
  px: number;
  py: number;
  /** 30 to 220, in percent. */
  size: number;
  /** Degrees, -12 to 12. */
  tilt: number;
}

export const DEFAULT_PLACEMENT: BoxPlacement = { px: 0.05, py: 0.84, size: 100, tilt: 0 };

export interface BoxGeometry {
  scale: number;
  /** Size on the card. */
  w: number;
  h: number;
  /** Top-left corner on the card, before tilt. */
  left: number;
  top: number;
  /** Free room the fractions are taken of. */
  rx: number;
  ry: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The box's place and size on the card, for a box whose natural size is `w0` × `h0`. */
export function boxGeometry(p: BoxPlacement, w0: number, h0: number): BoxGeometry {
  const nw = Math.max(1, w0);
  const nh = Math.max(1, h0);
  const scale = Math.min((BASE_SCALE * clamp(p.size, SIZE_MIN, SIZE_MAX)) / 100, CARD_W / nw, CARD_H / nh);
  const w = nw * scale;
  const h = nh * scale;
  const rx = Math.max(CARD_W - w, CARD_W * 0.25);
  const ry = Math.max(CARD_H - h, CARD_H * 0.25);
  return { scale, w, h, rx, ry, left: p.px * rx, top: p.py * ry };
}

const clampLeft = (l: number, g: BoxGeometry) => clamp(l, -(1 - KEEP) * g.w, CARD_W - KEEP * g.w);
const clampTop = (t: number, g: BoxGeometry) => clamp(t, -(1 - KEEP) * g.h, CARD_H - KEEP * g.h);

/** Moves the box by `dx`, `dy` card pixels from where `from` had it. */
export function moveBox(from: BoxPlacement, dx: number, dy: number, w0: number, h0: number): BoxPlacement {
  const g = boxGeometry(from, w0, h0);
  return {
    ...from,
    px: clampLeft(g.left + dx, g) / g.rx,
    py: clampTop(g.top + dy, g) / g.ry,
  };
}

/**
 * Resizes the box, keeping its top-left corner (the corner handle) or its middle (the slider and
 * pinch) where it is.
 */
export function resizeBox(
  from: BoxPlacement,
  size: number,
  anchor: 'corner' | 'centre',
  w0: number,
  h0: number,
): BoxPlacement {
  const a = boxGeometry(from, w0, h0);
  const next = { ...from, size: Math.round(clamp(size, SIZE_MIN, SIZE_MAX)) };
  const b = boxGeometry(next, w0, h0);
  let left = a.left;
  let top = a.top;
  if (anchor === 'centre') {
    left += (a.w - b.w) / 2;
    top += (a.h - b.h) / 2;
  }
  return { ...next, px: clampLeft(left, b) / b.rx, py: clampTop(top, b) / b.ry };
}

/** Puts the box at a preset spot: one axis to a fraction, the other kept. */
export function presetBox(from: BoxPlacement, axis: 'x' | 'y', value: number): BoxPlacement {
  return axis === 'x' ? { ...from, px: clamp(value, 0, 1) } : { ...from, py: clamp(value, 0, 1) };
}

/** Keeps a placement read back from storage within its limits. */
export function sanePlacement(p: Partial<BoxPlacement> | null | undefined): BoxPlacement {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    // Fractions slightly outside 0 to 1 are how the box sits partly off the card.
    px: clamp(num(p?.px, DEFAULT_PLACEMENT.px), -4, 5),
    py: clamp(num(p?.py, DEFAULT_PLACEMENT.py), -4, 5),
    size: clamp(Math.round(num(p?.size, DEFAULT_PLACEMENT.size)), SIZE_MIN, SIZE_MAX),
    tilt: clamp(Math.round(num(p?.tilt, 0)), -TILT_MAX, TILT_MAX),
  };
}

/** True when a point on the card (card pixels) falls inside the tilted box. */
export function hitsBox(g: BoxGeometry, tilt: number, x: number, y: number, pad = 0): boolean {
  const cx = g.left + g.w / 2;
  const cy = g.top + g.h / 2;
  const a = (-tilt * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= g.w / 2 + pad && Math.abs(ly) <= g.h / 2 + pad;
}

/** Where the box's bottom-right corner (the resize handle) lands after the tilt. */
export function handlePoint(g: BoxGeometry, tilt: number): { x: number; y: number } {
  const cx = g.left + g.w / 2;
  const cy = g.top + g.h / 2;
  const a = (tilt * Math.PI) / 180;
  const dx = g.w / 2;
  const dy = g.h / 2;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}
