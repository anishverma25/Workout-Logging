import { describe, expect, it } from 'vitest';
import { clampTo, parseDurationDigits, parseWholeNumber } from './keypad';

describe('parseDurationDigits', () => {
  it('reads digits like a microwave', () => {
    expect(parseDurationDigits('45')).toBe(45);
    expect(parseDurationDigits('230')).toBe(150);
    expect(parseDurationDigits('1000')).toBe(600);
    expect(parseDurationDigits('90')).toBe(90);
    expect(parseDurationDigits('2:30')).toBe(150);
  });
  it('rejects anything that is not a time', () => {
    expect(parseDurationDigits('')).toBeNull();
    expect(parseDurationDigits('2.5')).toBeNull();
    expect(parseDurationDigits('abc')).toBeNull();
    expect(parseDurationDigits('12345')).toBeNull();
  });
  it('is clamped by the caller', () => {
    expect(clampTo(parseDurationDigits('5')!, 15, 600)).toBe(15);
    expect(clampTo(parseDurationDigits('1500')!, 15, 600)).toBe(600);
  });
});

describe('parseWholeNumber', () => {
  it('takes whole degrees only', () => {
    expect(parseWholeNumber('30')).toBe(30);
    expect(parseWholeNumber('7.5')).toBeNull();
    expect(parseWholeNumber('')).toBeNull();
  });
});
