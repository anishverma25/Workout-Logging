import {
  formatCalendarDate,
  formatDate,
  formatDateInSentence,
  formatDateRange,
  formatDurationSummary,
  formatLoad,
  formatNumber,
  formatClock,
  formatRepRange,
  formatSeconds,
  shortDayName,
} from '@/lib/format';
import { formatWeightValue } from '@/lib/units';
import { orderedWeekdays } from '@/lib/dates';

// Saturday 10 October 2026, mid-morning local time.
const now = new Date(2026, 9, 10, 10, 0);
const daysAgo = (n: number) => new Date(2026, 9, 10 - n, 18, 30);

describe('dates', () => {
  it('names today, yesterday and the last week, then a short date', () => {
    expect(formatDate(daysAgo(0), now)).toBe('Today');
    expect(formatDate(daysAgo(1), now)).toBe('Yesterday');
    expect(formatDate(daysAgo(3), now)).toBe('Wednesday');
    expect(formatDate(daysAgo(6), now)).toBe('Sunday');
    expect(formatDate(daysAgo(7), now)).toBe('Sat, 3 Oct');
  });

  it('adds the year only outside the current year', () => {
    expect(formatCalendarDate(new Date(2026, 9, 10), now)).toBe('Sat, 10 Oct');
    expect(formatCalendarDate(new Date(2025, 9, 10), now)).toBe('Fri, 10 Oct 2025');
  });

  it('keeps day names capitalised inside a sentence', () => {
    expect(formatDateInSentence(daysAgo(3), now)).toBe('Wednesday');
    expect(formatDateInSentence(daysAgo(0), now)).toBe('today');
    expect(formatDateInSentence(daysAgo(1), now)).toBe('yesterday');
  });

  it('writes ranges with "to" and years on both ends when they differ', () => {
    expect(formatDateRange(new Date(2026, 8, 11), new Date(2026, 9, 10), now)).toBe(
      '11 Sep to 10 Oct',
    );
    expect(formatDateRange(new Date(2025, 11, 20), new Date(2026, 0, 5), now)).toBe(
      '20 Dec 2025 to 5 Jan 2026',
    );
    expect(formatDateRange(new Date(2025, 8, 1), new Date(2025, 8, 30), now)).toBe(
      '1 Sep to 30 Sep 2025',
    );
  });

  it('uses short day names Mon to Sun', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(shortDayName)).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
  });
});

describe('numbers', () => {
  it('groups with commas, max one decimal, no trailing zero', () => {
    expect(formatNumber(10413)).toBe('10,413');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(62.5)).toBe('62.5');
    expect(formatNumber(70.0)).toBe('70');
    expect(formatNumber(62.46)).toBe('62.5');
    expect(formatNumber(-0.01)).toBe('0');
  });

  it('shows kilograms to two decimals only when needed, pounds to one', () => {
    expect(formatLoad(41.25, 'kg')).toBe('41.25');
    expect(formatLoad(70, 'kg')).toBe('70');
    expect(formatLoad(82.5, 'kg')).toBe('82.5');
    expect(formatLoad(100, 'lb')).toBe('220.5');
    expect(formatWeightValue(41.25, 'kg')).toBe('41.25');
    expect(formatWeightValue(1000, 'kg')).toBe('1,000');
    // Calculated values (an estimate of 113.333 kg) keep one decimal.
    expect(formatWeightValue(113.3333, 'kg')).toBe('113.3');
    expect(formatLoad(107.6667, 'kg')).toBe('107.7');
  });

  it('writes rep ranges with "to"', () => {
    expect(formatRepRange(6, 8)).toBe('6 to 8');
    expect(formatRepRange(5, 5)).toBe('5');
  });
});

describe('durations', () => {
  it('formats live timers', () => {
    expect(formatClock(12)).toBe('0:12');
    expect(formatClock(724)).toBe('12:04');
    expect(formatClock(3730)).toBe('1:02:10');
  });

  it('formats summaries', () => {
    expect(formatDurationSummary(44)).toBe('44 min');
    expect(formatDurationSummary(73)).toBe('1 h 13 min');
    expect(formatDurationSummary(120)).toBe('2 h');
  });

  it('formats rest as minutes and seconds', () => {
    expect(formatSeconds(120)).toBe('2:00');
    expect(formatSeconds(45)).toBe('0:45');
    expect(formatSeconds(150)).toBe('2:30');
  });
});

describe('week start (D9)', () => {
  it('orders week strips from the chosen first day', () => {
    expect(orderedWeekdays(1).map(shortDayName)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(orderedWeekdays(0).map(shortDayName)[0]).toBe('Sun');
  });
});
