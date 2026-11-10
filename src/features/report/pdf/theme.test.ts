import { contrast, PDF_THEMES, textPairs } from './theme';

describe('report PDF colours', () => {
  for (const name of ['dark', 'light'] as const) {
    it(`${name}: every text pair is readable`, () => {
      const low = textPairs(PDF_THEMES[name])
        .map((p) => ({ ...p, ratio: Math.round(contrast(p.fg, p.bg) * 100) / 100 }))
        .filter((p) => p.ratio < p.min);
      expect(low).toEqual([]);
    });
  }

  it('measures contrast like WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
