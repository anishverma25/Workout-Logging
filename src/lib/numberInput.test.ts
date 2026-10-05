import { isValidDraft, parseDraft, toDraft } from './numberInput';

describe('number input drafts', () => {
  it('allows an empty field while typing', () => {
    expect(isValidDraft('')).toBe(true);
    expect(parseDraft('')).toBeNull();
  });

  it('accepts natural typing of decimals, including a trailing point and comma decimals', () => {
    for (const draft of ['8', '80', '77.', '77.5', '77,5', '102.25'])
      expect(isValidDraft(draft)).toBe(true);
    expect(parseDraft('77,5')).toBe(77.5);
    expect(parseDraft('77.')).toBe(77);
  });

  it('rejects letters, signs and too many decimals', () => {
    for (const draft of ['a', '-5', '7.555', '1e3', '12345'])
      expect(isValidDraft(draft)).toBe(false);
  });

  it('enforces integers for reps', () => {
    expect(isValidDraft('8.5', false)).toBe(false);
    expect(parseDraft('8', { allowDecimal: false })).toBe(8);
  });

  it('applies bounds when parsing', () => {
    expect(parseDraft('0', { min: 1 })).toBeNull();
    expect(parseDraft('600', { max: 500 })).toBeNull();
  });

  it('round-trips stored values without trailing zeros', () => {
    expect(toDraft(80)).toBe('80');
    expect(toDraft(77.5)).toBe('77.5');
    expect(toDraft(null)).toBe('');
  });
});
