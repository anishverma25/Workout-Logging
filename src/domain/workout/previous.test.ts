import type { WorkoutSet } from '@/domain/models/schemas';
import { matchingPreviousSet, suggestFor } from './previous';

const set = (id: string, setType: WorkoutSet['setType'], weightKg = 60, reps = 8) =>
  ({
    id,
    setType,
    weightKg,
    reps,
    durationSec: null,
    distanceM: null,
    completedAt: '2026-09-01T10:00:00.000Z',
  }) as WorkoutSet;

describe('matching last time', () => {
  const previous = [set('p1', 'working', 60, 8), set('p2', 'working', 62.5, 7)];
  const today = [
    set('t1', 'working'),
    set('t2', 'working'),
    set('t3', 'working'),
    set('t4', 'working'),
  ];

  it('pairs sets by position within their type', () => {
    expect(matchingPreviousSet(previous, today, 't2')?.id).toBe('p2');
  });

  it('shows no last time for a set that did not exist last time', () => {
    expect(matchingPreviousSet(previous, today, 't3')).toBeNull();
    expect(matchingPreviousSet(previous, today, 't4')).toBeNull();
  });

  it('still suggests the last comparable set for an extra set', () => {
    expect(suggestFor(previous, today, 't4')).toMatchObject({ weightKg: 62.5, reps: 7 });
  });

  it('never guesses across set types', () => {
    const withBackoff = [...today, set('b1', 'backoff')];
    expect(matchingPreviousSet(previous, withBackoff, 'b1', { fallback: true })).toBeNull();
  });
});
