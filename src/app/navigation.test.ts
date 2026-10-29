import { BOTTOM_NAV, hidesTabBar } from './navigation';

describe('the tab bar (UI v3)', () => {
  it('has five tabs, with Routines inside Workout', () => {
    expect(BOTTOM_NAV.map((i) => i.label)).toEqual([
      'Home',
      'Workout',
      'Food',
      'Progress',
      'History',
    ]);
  });

  it('steps aside only in the logger and on the summary', () => {
    expect(hidesTabBar('/workout', true)).toBe(true);
    expect(hidesTabBar('/workout', false)).toBe(false);
    expect(hidesTabBar('/workouts/abc/summary', false)).toBe(true);
    expect(hidesTabBar('/history', true)).toBe(false);
    expect(hidesTabBar('/', true)).toBe(false);
  });
});
