import { describe, expect, it } from 'vitest';
import {
  chooseNudge,
  DISMISS_DAYS,
  EMPTY_NUDGE_STATE,
  GAP_DAYS,
  MAX_NUDGES,
  QUIET_DAYS,
  type NudgeFacts,
  type NudgeState,
} from './nudge';

/**
 * The promise these rules make: a free member is reminded about Pro with their own numbers, a
 * few times, with widening gaps, and never while they have Pro or in the first quiet days
 * after a trial. Nothing here invents a number or a deadline.
 */

const DAY = 86_400_000;
const NOW = new Date('2026-06-01T09:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);

const facts = (patch: Partial<NudgeFacts> = {}): NudgeFacts => ({
  pro: false,
  endedAt: ago(30),
  workoutsSince: 12,
  historyDays: 120,
  records: 5,
  monthlyInr: 29,
  ...patch,
});

const state = (patch: Partial<NudgeState> = {}): NudgeState => ({
  ...EMPTY_NUDGE_STATE,
  ...patch,
});

describe('chooseNudge', () => {
  it('says nothing to someone who has Pro, or who never had a trial', () => {
    expect(chooseNudge(facts({ pro: true }), state(), NOW)).toBeNull();
    expect(chooseNudge(facts({ endedAt: null }), state(), NOW)).toBeNull();
  });

  it('keeps quiet for the first days after the trial ends', () => {
    expect(chooseNudge(facts({ endedAt: ago(QUIET_DAYS - 1) }), state(), NOW)).toBeNull();
    expect(chooseNudge(facts({ endedAt: ago(QUIET_DAYS + 1) }), state(), NOW)).not.toBeNull();
  });

  it('leads with the number that is worth the most to them', () => {
    expect(chooseNudge(facts(), state(), NOW)?.id).toBe('history');
    // With a short history, it moves on rather than stretching the truth.
    const short = facts({ historyDays: 20 });
    expect(chooseNudge(short, state(), NOW)?.id).toBe('workouts');
    expect(chooseNudge(facts({ historyDays: 20, workoutsSince: 2 }), state(), NOW)?.id).toBe(
      'records',
    );
  });

  it('only ever says things that are true of this person', () => {
    const quiet = facts({ historyDays: 5, workoutsSince: 1, records: 0, monthlyInr: null });
    expect(chooseNudge(quiet, state(), NOW)).toBeNull();
    // The price is a fact too, once the server has sent it.
    const priced = chooseNudge(facts({ ...quiet, monthlyInr: 29 }), state(), NOW);
    expect(priced?.id).toBe('price');
    expect(priced?.title).toContain('under ₹1 a day');
    // A higher price makes no such claim.
    expect(chooseNudge(facts({ ...quiet, monthlyInr: 99 }), state(), NOW)?.title).not.toContain(
      'a day',
    );
  });

  it('never repeats a reminder and waits longer each time', () => {
    const shown = state({ shownIds: ['history'], lastShownAt: ago(1) });
    expect(chooseNudge(facts(), shown, NOW)).toBeNull();
    const later = state({ shownIds: ['history'], lastShownAt: ago(GAP_DAYS[1] + 1) });
    expect(chooseNudge(facts(), later, NOW)?.id).toBe('workouts');
    // The third gap is longer than the second.
    const third = state({
      shownIds: ['history', 'workouts'],
      lastShownAt: ago(GAP_DAYS[1] + 1),
    });
    expect(chooseNudge(facts(), third, NOW)).toBeNull();
    expect(chooseNudge(facts(), { ...third, lastShownAt: ago(GAP_DAYS[2] + 1) }, NOW)?.id).toBe(
      'records',
    );
  });

  it('stops for good after four reminders', () => {
    const done = state({
      shownIds: ['history', 'workouts', 'records', 'price'],
      lastShownAt: ago(400),
    });
    expect(done.shownIds).toHaveLength(MAX_NUDGES);
    expect(chooseNudge(facts(), done, NOW)).toBeNull();
  });

  it('respects "not now" for a good while', () => {
    const dismissed = state({
      shownIds: ['history'],
      lastShownAt: ago(DISMISS_DAYS),
      dismissedAt: ago(DISMISS_DAYS - 1),
    });
    expect(chooseNudge(facts(), dismissed, NOW)).toBeNull();
    expect(
      chooseNudge(facts(), { ...dismissed, dismissedAt: ago(DISMISS_DAYS + 1) }, NOW)?.id,
    ).toBe('workouts');
  });
});
