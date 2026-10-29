import { describe, expect, it } from 'vitest';
import { joinSaid, speechProblem, transcriptOf } from './speech';

const result = (transcript: string, isFinal: boolean) => ({
  0: { transcript },
  length: 1,
  isFinal,
});

describe('speaking a meal', () => {
  it('keeps the sure words apart from the ones still being heard', () => {
    expect(transcriptOf([result('2 aloo parathas', true), result(' with  curd', false)])).toEqual({
      final: '2 aloo parathas',
      interim: 'with curd',
    });
  });

  it('adds what was said to what is typed', () => {
    expect(joinSaid('', '2 rotis')).toBe('2 rotis');
    expect(joinSaid('dal, ', '2 rotis')).toBe('dal, 2 rotis');
    expect(joinSaid('dal', '')).toBe('dal');
  });

  it('says why it could not listen, and the keyboard mic that always works', () => {
    expect(speechProblem('not-allowed')).toMatch(/keyboard/);
    expect(speechProblem('service-not-allowed')).toMatch(/keyboard/);
    expect(speechProblem('no-speech')).toMatch(/Nothing was heard/);
    expect(speechProblem('weird')).toMatch(/keyboard/);
  });
});
