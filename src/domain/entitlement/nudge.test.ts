import { describe, expect, it } from 'vitest';
import {
  chooseNudge,
  DISMISS_DAYS,
  EMPTY_NUDGE_STATE,
  GAP_DAYS,
  gapAfter,
  QUIET_DAYS,
  STEADY_GAP_DAYS,
  type NudgeFacts,
  type NudgeState,
} from './nudge';

/**
 * The promise these rules make: a free member is reminded about Pro with their own numbers,
 * often at first and then every ten days, never while they have Pro or in the first quiet days
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
    const quiet = facts({ historyDays: 0, workoutsSince: 1, records: 0, monthlyInr: null });
    expect(chooseNudge(quiet, state(), NOW)).toBeNull();
    // The price is a fact too, once the server has sent it.
    const priced = chooseNudge(facts({ ...quiet, monthlyInr: 29 }), state(), NOW);
    expect(priced?.id).toBe('price');
    expect(priced?.title).toContain('under ₹1 a day');
    // A higher price makes no such claim.
    expect(chooseNudge(facts({ ...quiet, monthlyInr: 99 }), state(), NOW)?.title).not.toContain(
      'a day',
    );
    // The yearly saving is worked out from the real prices, and only offered when it is real.
    const both = state({ shownIds: ['price'], lastShownAt: ago(30) });
    const yearly = chooseNudge(facts({ ...quiet, monthlyInr: 99, yearlyInr: 899 }), both, NOW);
    expect(yearly?.id).toBe('yearly');
    expect(yearly?.title).toContain('₹289 less');
    expect(
      chooseNudge(facts({ ...quiet, monthlyInr: 99, yearlyInr: 1188 }), both, NOW)?.id,
    ).not.toBe('yearly');
  });

  it('shows each reminder once before any repeats, close together at first', () => {
    const shown = state({ shownIds: ['history'], lastShownAt: ago(1) });
    expect(chooseNudge(facts(), shown, NOW)).toBeNull();
    const later = state({ shownIds: ['history'], lastShownAt: ago(GAP_DAYS[1] + 0.1) });
    expect(chooseNudge(facts(), later, NOW)?.id).toBe('workouts');
    // The early gaps are a few days, never weeks.
    expect(GAP_DAYS.every((g) => g <= 7)).toBe(true);
    const third = state({
      shownIds: ['history', 'workouts'],
      lastShownAt: ago(GAP_DAYS[2] - 1),
    });
    expect(chooseNudge(facts(), third, NOW)).toBeNull();
    expect(chooseNudge(facts(), { ...third, lastShownAt: ago(GAP_DAYS[2] + 0.1) }, NOW)?.id).toBe(
      'records',
    );
  });

  it('keeps reminding every ten days after the schedule, the oldest reminder first', () => {
    const all = ['history', 'workouts', 'records', 'price', 'coach', 'history', 'workouts'];
    expect(gapAfter(all.length)).toBe(STEADY_GAP_DAYS);
    const soon = state({ shownIds: all, lastShownAt: ago(STEADY_GAP_DAYS - 1) });
    expect(chooseNudge(facts(), soon, NOW)).toBeNull();
    const due = state({ shownIds: all, lastShownAt: ago(STEADY_GAP_DAYS + 0.1) });
    // records, price and coach were last seen before the second history and workouts.
    expect(chooseNudge(facts(), due, NOW)?.id).toBe('records');
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
    // A week is the longest a "not now" holds; it never silences Pro for good.
    expect(DISMISS_DAYS).toBe(7);
  });
});
