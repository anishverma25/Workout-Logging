import { restSecondsAfterSet } from './rest';

const base = {
  plannedSec: 120,
  defaultSec: 90,
  warmup: false,
  lastOfExercise: false,
  moreToCome: true,
  changeSec: 180,
};

describe('rest after a set', () => {
  it('uses the exercise rest between its own sets', () => {
    expect(restSecondsAfterSet(base)).toBe(120);
    expect(restSecondsAfterSet({ ...base, plannedSec: null })).toBe(90);
  });

  it('uses the rest between exercises after the last set of an exercise', () => {
    expect(restSecondsAfterSet({ ...base, lastOfExercise: true })).toBe(180);
    // Not after the final exercise, and not when the setting is off.
    expect(restSecondsAfterSet({ ...base, lastOfExercise: true, moreToCome: false })).toBe(120);
    expect(restSecondsAfterSet({ ...base, lastOfExercise: true, changeSec: null })).toBe(120);
  });

  it('keeps warm-up rest short', () => {
    expect(restSecondsAfterSet({ ...base, warmup: true })).toBe(60);
    expect(restSecondsAfterSet({ ...base, warmup: true, plannedSec: 45 })).toBe(45);
  });
});
