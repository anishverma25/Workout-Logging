import { describe, expect, it } from 'vitest';
import { readable } from './readable';

describe('answers read like speech', () => {
  const now = new Date('2026-10-22T12:00:00');
  it('dates as people say them, with the year only when it is not this year', () => {
    expect(readable('On 2026-10-14 you squatted', now)).toBe('On 14th October you squatted');
    expect(readable('since 2025-12-01', now)).toBe('since 1st December, 2025');
    expect(readable('2026-10-22 and 2026-10-03 and 2026-10-12', now)).toBe(
      '22nd October and 3rd October and 12th October',
    );
  });
  it('sets with a times sign', () => {
    expect(readable('87.5 kg x 5 at RIR 2', now)).toBe('87.5 kg × 5 at RIR 2');
  });
});
