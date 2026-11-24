import { describe, expect, it } from 'vitest';
import { brainSummary, reportBannerDue } from './homeEntry';

const base = { openWeek: '2026-11-16', savedWeeks: [], hiddenWeeks: [], sessions: 3, foodDays: 0 };

describe('reportBannerDue', () => {
  it('shows when the open week has enough logged and no report', () => {
    expect(reportBannerDue(base)).toBe(true);
    expect(reportBannerDue({ ...base, sessions: 0, foodDays: 3 })).toBe(true);
  });
  it('never shows again once the report for that week exists', () => {
    expect(reportBannerDue({ ...base, savedWeeks: ['2026-11-16'] })).toBe(false);
  });
  it('a report for another week does not hide it', () => {
    expect(reportBannerDue({ ...base, savedWeeks: ['2026-11-09'] })).toBe(true);
  });
  it('stays hidden for the week the person closed it', () => {
    expect(reportBannerDue({ ...base, hiddenWeeks: ['2026-11-16'] })).toBe(false);
  });
  it('does not show for a thin week (the report could not be made)', () => {
    expect(reportBannerDue({ ...base, sessions: 1, foodDays: 2 })).toBe(false);
  });
});

describe('brainSummary', () => {
  it('learning: says the week and fills the meter', () => {
    const s = brainSummary({
      stage: { learning: true, week: 2, of: 4 },
      changes: 1,
      decided: null,
      pro: true,
    });
    expect(s.stage).toBe('learning');
    expect(s.headline).toBe('Learning you: week 2 of 4');
    expect(s.progress).toBe(0.5);
    expect(s.badge).toBe('Learning you · Week 2 of 4');
    expect(s.detail).toBe('1 change ready for next week.');
  });
  it('week 0 reads as week 1, never past the end', () => {
    expect(
      brainSummary({
        stage: { learning: true, week: 0, of: 4 },
        changes: 0,
        decided: null,
        pro: true,
      }).headline,
    ).toBe('Learning you: week 1 of 4');
    expect(
      brainSummary({
        stage: { learning: true, week: 9, of: 4 },
        changes: 0,
        decided: null,
        pro: true,
      }).progress,
    ).toBe(1);
  });
  it('a decided week says so', () => {
    const stage = { learning: false, week: 6, of: 4 };
    expect(brainSummary({ stage, changes: 2, decided: 'applied', pro: true }).detail).toMatch(
      /applied/,
    );
    expect(brainSummary({ stage, changes: 2, decided: 'kept', pro: true }).detail).toMatch(/kept/);
    expect(brainSummary({ stage, changes: 0, decided: null, pro: true }).detail).toMatch(
      /Nothing to change/,
    );
  });
  it('free members see what it does and that the plan is Pro', () => {
    const s = brainSummary({
      stage: { learning: false, week: 6, of: 4 },
      changes: 3,
      decided: null,
      pro: false,
    });
    expect(s.stage).toBe('ready');
    expect(s.badge).toBe('Knows you');
    expect(s.detail).toMatch(/Pro/);
    expect(s.detail).not.toMatch(/3/);
  });
});
