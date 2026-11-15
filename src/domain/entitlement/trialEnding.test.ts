import { describe, expect, it } from 'vitest';
import { STAYS_FREE, trialEndingCopy, trialEndingDue, URGENCY } from './trialEnding';
import { candidates } from './nudge';

const DAY = 86_400_000;

describe('the trial ending card', () => {
  it('shows only in the last 3 days of a running trial', () => {
    expect(trialEndingDue(4 * DAY)).toBe(false);
    expect(trialEndingDue(3 * DAY)).toBe(true);
    expect(trialEndingDue(1)).toBe(true);
    expect(trialEndingDue(0)).toBe(false);
    expect(trialEndingDue(null)).toBe(false);
  });
  it('says the day plainly and what stays free, never with urgency', () => {
    const c = trialEndingCopy(new Date('2026-11-28T10:00:00+05:30'), [
      '2 lifts are ready for more weight or reps',
    ]);
    expect(c.title).toBe('Your Pro trial ends on Saturday, 28 November');
    expect(c.free).toBe(STAYS_FREE);
    for (const text of [c.title, c.free, ...c.findings]) expect(text).not.toMatch(URGENCY);
  });
  it('the urgency list catches the words it is for', () => {
    for (const bad of ['Hurry', 'Last chance to save', 'Only 2 days', '5 hours left', 'Go Pro!'])
      expect(bad).toMatch(URGENCY);
  });
  it('the Pro reminders on Home use no urgency words either', () => {
    const all = candidates({
      pro: false,
      endedAt: new Date('2026-10-01'),
      workoutsSince: 12,
      historyDays: 200,
      records: 9,
      monthlyInr: 149,
      yearlyInr: 1499,
    });
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const n of all) {
      expect(n.title).not.toMatch(URGENCY);
      expect(n.body).not.toMatch(URGENCY);
    }
  });
});
