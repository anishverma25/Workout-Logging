import {
  boxGeometry,
  CARD_H,
  CARD_W,
  DEFAULT_PLACEMENT,
  handlePoint,
  hitsBox,
  moveBox,
  presetBox,
  resizeBox,
  sanePlacement,
} from './layout';

const W0 = 600;
const H0 = 500;

describe('story box layout', () => {
  it('starts low on the left at the confirmed size', () => {
    const g = boxGeometry(DEFAULT_PLACEMENT, W0, H0);
    expect(g.scale).toBeCloseTo(1.15, 5);
    expect(g.left).toBeCloseTo(0.05 * (CARD_W - 690), 5);
    expect(g.top).toBeCloseTo(0.84 * (CARD_H - 575), 5);
    // Lower part of the card, never near the middle.
    expect(g.top + g.h / 2).toBeGreaterThan(CARD_H * 0.6);
  });

  it('never grows past the card', () => {
    const g = boxGeometry({ ...DEFAULT_PLACEMENT, size: 220 }, W0, H0);
    expect(g.w).toBeLessThanOrEqual(CARD_W + 1e-6);
    expect(g.h).toBeLessThanOrEqual(CARD_H + 1e-6);
  });

  it('lets the box go partly off the card but keeps 15% on', () => {
    const far = moveBox(DEFAULT_PLACEMENT, -5000, 5000, W0, H0);
    const g = boxGeometry(far, W0, H0);
    expect(g.left).toBeCloseTo(-0.85 * g.w, 5);
    expect(g.top).toBeCloseTo(CARD_H - 0.15 * g.h, 5);
    const back = moveBox(far, 99999, -99999, W0, H0);
    const b = boxGeometry(back, W0, H0);
    expect(b.left).toBeCloseTo(CARD_W - 0.15 * b.w, 5);
    expect(b.top).toBeCloseTo(-0.85 * b.h, 5);
  });

  it('keeps the corner when resized by the handle and the middle when resized by the slider', () => {
    const a = boxGeometry(DEFAULT_PLACEMENT, W0, H0);
    const byCorner = boxGeometry(resizeBox(DEFAULT_PLACEMENT, 60, 'corner', W0, H0), W0, H0);
    expect(byCorner.left).toBeCloseTo(a.left, 5);
    expect(byCorner.top).toBeCloseTo(a.top, 5);
    const bySlider = boxGeometry(resizeBox(DEFAULT_PLACEMENT, 60, 'centre', W0, H0), W0, H0);
    expect(bySlider.left + bySlider.w / 2).toBeCloseTo(a.left + a.w / 2, 5);
    expect(bySlider.top + bySlider.h / 2).toBeCloseTo(a.top + a.h / 2, 5);
    expect(resizeBox(DEFAULT_PLACEMENT, 999, 'centre', W0, H0).size).toBe(220);
    expect(resizeBox(DEFAULT_PLACEMENT, 1, 'centre', W0, H0).size).toBe(30);
  });

  it('moves to presets and reads stored placements safely', () => {
    expect(presetBox(DEFAULT_PLACEMENT, 'y', 0.08).py).toBe(0.08);
    expect(sanePlacement(null)).toEqual(DEFAULT_PLACEMENT);
    expect(sanePlacement({ px: Number.NaN, size: 999, tilt: -40 })).toEqual({
      px: 0.05,
      py: 0.84,
      size: 220,
      tilt: -12,
    });
  });

  it('finds the box and its handle under a tilt', () => {
    const g = boxGeometry(DEFAULT_PLACEMENT, W0, H0);
    const cx = g.left + g.w / 2;
    const cy = g.top + g.h / 2;
    expect(hitsBox(g, 10, cx, cy)).toBe(true);
    expect(hitsBox(g, 10, cx + g.w, cy)).toBe(false);
    const h0 = handlePoint(g, 0);
    expect(h0.x).toBeCloseTo(g.left + g.w, 5);
    expect(h0.y).toBeCloseTo(g.top + g.h, 5);
    const h10 = handlePoint(g, 10);
    expect(hitsBox(g, 10, h10.x - 5, h10.y - 5)).toBe(true);
  });
});
