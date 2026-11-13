import { describe, expect, it } from 'vitest';
import { matchSpokenExercise, parseSpokenSet } from './voice';

const set = (weight: number | null, reps: number | null, sure: boolean, over: object = {}) => ({
  kind: 'set', weight, reps, sure, unit: null, exercise: null, ...over,
});

describe('voice sets', () => {
  it.each([
    ['80 kilo 8 reps', set(80, 8, true, { unit: 'kg' })],
    ['bench 80 kilo 8 reps', set(80, 8, true, { unit: 'kg', exercise: 'bench' })],
    ['80 ke 8', set(80, 8, true)],
    ['60 ke 10', set(60, 10, true)],
    ['80kg x 8', set(80, 8, true, { unit: 'kg' })],
    ['100 into 5', set(100, 5, true)],
    ['eighty kilos eight reps', set(80, 8, true, { unit: 'kg' })],
    ['assi kilo aath', set(80, 8, true, { unit: 'kg' })],
    ['sadhe sattar ke che', set(70.5, 6, true)],
    ['dhai kilo barah baar', set(2.5, 12, true, { unit: 'kg' })],
    ['sau bees kilo paanch', set(120, 5, true, { unit: 'kg' })],
    ['one hundred and ten kg 3 reps', set(110, 3, true, { unit: 'kg' })],
    ['pachees ke pandrah', set(25, 15, true)],
    ['82.5 for 6', set(82.5, 6, true)],
    ['eighty two point five kilo six', set(82.5, 6, true, { unit: 'kg' })],
    ['135 pounds 10 reps', set(135, 10, true, { unit: 'lb' })],
    ['8 reps 80 kilo', set(80, 8, true, { unit: 'kg' })],
    ['squat sattar ke das', set(70, 10, true, { exercise: 'squat' })],
  ])('%s', (said, want) => {
    expect(parseSpokenSet(said)).toEqual(want);
  });

  it('fills but does not confirm when it could mean two things', () => {
    expect(parseSpokenSet('80 8')).toEqual(set(80, 8, false));
    expect(parseSpokenSet('12 reps')).toEqual(set(null, 12, false));
    expect(parseSpokenSet('60 kilo')).toEqual(set(60, null, false, { unit: 'kg' }));
    // 81.3 is not a weight anyone loads.
    expect(parseSpokenSet('81.3 kilo 8 reps')).toMatchObject({ weight: 81.3, sure: false });
  });

  it('understands "same again"', () => {
    for (const s of ['same again', 'Same', 'wahi', 'phir se', 'repeat', 'ek aur'])
      expect(parseSpokenSet(s)).toEqual({ kind: 'same' });
  });

  it('ignores anything that is not a set', () => {
    for (const s of ['', 'how many sets left', 'play some music', '80', 'three four five six', '80 kilo 500 reps', '900 kilo 5 reps', 'half past 8'])
      expect(parseSpokenSet(s), s).toBeNull();
  });

  it('finds the exercise only when exactly one fits', () => {
    const list = [{ name: 'Barbell bench press' }, { name: 'Incline dumbbell press' }, { name: 'Back squat' }];
    expect(matchSpokenExercise('bench', list)).toBe(list[0]);
    expect(matchSpokenExercise('squat', list)).toBe(list[2]);
    expect(matchSpokenExercise('press', list)).toBeNull();
    expect(matchSpokenExercise('curl', list)).toBeNull();
  });
});
