import {
  dateAxisLabels,
  linearScale,
  nearestIndex,
  niceDomain,
  niceStep,
  pickAxisLabels,
  spacedIndices,
  splitAtGaps,
} from './scale';

describe('chart scales', () => {
  it('picks nice steps', () => {
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(7, 4)).toBe(2);
    expect(niceStep(0.9, 4)).toBe(0.25);
    expect(niceStep(0, 4)).toBe(1);
  });

  it('rounds domains outward to clean ticks', () => {
    expect(niceDomain(87.3, 103.9)).toEqual({ domain: [85, 105], ticks: [85, 90, 95, 100, 105] });
    expect(niceDomain(3, 17, 4, true).domain[0]).toBe(0);
  });

  it('handles a flat series without dividing by zero', () => {
    const { domain } = niceDomain(67, 67);
    expect(domain[0]).toBeLessThan(67);
    expect(domain[1]).toBeGreaterThan(67);
    expect(niceDomain(0, 0, 4, true).domain).toEqual([0, 1]);
  });

  it('maps values linearly, including inverted ranges for y', () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(linearScale([5, 5], [0, 10])(5)).toBe(0);
  });

  it('finds the nearest point', () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2);
    expect(nearestIndex([0, 10], -5)).toBe(0);
    expect(nearestIndex([], 3)).toBe(-1);
  });

  it('spaces axis labels and keeps both ends', () => {
    expect(spacedIndices(3, 5)).toEqual([0, 1, 2]);
    expect(spacedIndices(10, 4)).toEqual([0, 3, 6, 9]);
  });
});

describe('whole-number axes', () => {
  it('never puts ticks between whole numbers for counts', () => {
    expect(niceDomain(0, 9, 4, true, true).ticks).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceDomain(0, 3, 4, true, true).ticks).toEqual([0, 1, 2, 3]);
    expect(niceDomain(0, 9, 4, true).ticks).toEqual([0, 2.5, 5, 7.5, 10]);
  });
});

describe('date axis', () => {
  const now = new Date(2026, 9, 13);
  const d = (y: number, m: number, day: number) => new Date(y, m, day).getTime();

  it('shows day and month for a short range this year', () => {
    expect(dateAxisLabels([d(2026, 8, 1), d(2026, 9, 5)], now)).toEqual(['1 Sep', '5 Oct']);
  });

  it('adds the year when the data is from another year', () => {
    expect(dateAxisLabels([d(2025, 9, 5), d(2025, 10, 9)], now)).toEqual(['5 Oct 2025', '9 Nov']);
  });

  it('marks where the year changes', () => {
    expect(dateAxisLabels([d(2025, 11, 20), d(2026, 0, 3)], now)).toEqual([
      '20 Dec 2025',
      '3 Jan 2026',
    ]);
  });

  it('uses month and year for long ranges', () => {
    expect(dateAxisLabels([d(2025, 9, 5), d(2026, 7, 9)], now)).toEqual(['Oct 2025', 'Aug 2026']);
  });

  it('never lets labels overlap', () => {
    // Points bunched at the right end, as after a long break.
    const positions = [40, 300, 305, 310, 316, 330];
    const texts = ['Oct 2025', 'Jul 2026', 'Jul 2026', 'Aug 2026', 'Aug 2026', 'Aug 2026'];
    const kept = pickAxisLabels(positions, texts);
    expect(kept[0]).toBe(0);
    expect(kept[kept.length - 1]).toBe(5);
    const w = (i: number) => texts[i]!.length * 6.6;
    for (let k = 1; k < kept.length; k++) {
      const a = kept[k - 1]!;
      const b = kept[k]!;
      const aRight = a === 0 ? positions[a]! + w(a) : positions[a]! + w(a) / 2;
      const bLeft = b === positions.length - 1 ? positions[b]! - w(b) : positions[b]! - w(b) / 2;
      expect(bLeft).toBeGreaterThan(aRight);
      expect(texts[a]).not.toBe(texts[b]);
    }
  });

  it('keeps the latest label when only one fits', () => {
    expect(pickAxisLabels([0, 20], ['9 Aug', '11 Aug'])).toEqual([1]);
  });

  it('splits a series at long gaps', () => {
    const pts = [{ x: 0 }, { x: 5 }, { x: 100 }, { x: 103 }];
    expect(splitAtGaps(pts, 10)).toEqual([[{ x: 0 }, { x: 5 }], [{ x: 100 }, { x: 103 }]]);
  });
});
