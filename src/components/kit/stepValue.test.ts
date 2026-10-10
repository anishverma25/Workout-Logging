import { stepValue } from './stepValue';

describe('stepValue', () => {
  it('steps by half reps in reserve without drift', () => {
    let v = 0;
    for (let i = 0; i < 7; i++) v = stepValue(v, 0.5, 0, 5, 0.5);
    expect(v).toBe(3.5);
  });

  it('clamps at both ends', () => {
    expect(stepValue(5, 0.5, 0, 5, 0.5)).toBe(5);
    expect(stepValue(0, -0.5, 0, 5, 0.5)).toBe(0);
    expect(stepValue(590, 15, 15, 600, 15)).toBe(600);
  });

  it('snaps an off-grid value onto the step grid', () => {
    expect(stepValue(62, 15, 15, 600, 15)).toBe(75);
    expect(stepValue(7, 5, 0, 90, 5)).toBe(10);
  });
});
