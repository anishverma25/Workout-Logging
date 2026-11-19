import { describe, expect, it } from 'vitest';
import { previousEffort } from './format';

describe('last time effort', () => {
  it('shows the effort in the measure the person logs', () => {
    expect(previousEffort({ rir: 2, rpe: null, setType: 'working' }, 'rir')).toBe('RIR 2');
    expect(previousEffort({ rir: null, rpe: 8.5, setType: 'working' }, 'rpe')).toBe('RPE 8.5');
  });

  it('shows nothing for a warm-up or a set logged without effort', () => {
    expect(previousEffort({ rir: 3, rpe: null, setType: 'warmup' }, 'rir')).toBeNull();
    expect(previousEffort({ rir: null, rpe: 8, setType: 'working' }, 'rir')).toBeNull();
  });
});
