import { linearScale, nearestIndex, niceDomain, niceStep, spacedIndices } from './scale';

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
