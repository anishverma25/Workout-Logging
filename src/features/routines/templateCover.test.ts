import { describe, expect, it } from 'vitest';
import { ROUTINE_TEMPLATES } from '@/data/library/templates';
import { coverWeek, shortDayName } from './templateCover';

describe('template covers', () => {
  it('name each session in a few letters', () => {
    expect(shortDayName('Push')).toBe('Push');
    expect(shortDayName('Legs')).toBe('Legs');
    expect(shortDayName('Upper')).toBe('Up');
    expect(shortDayName('Lower 2')).toBe('L2');
    expect(shortDayName('Workout A')).toBe('A');
    expect(shortDayName('Full body C')).toBe('C');
  });

  it('show every template with exactly its training days, Monday first', () => {
    for (const t of ROUTINE_TEMPLATES) {
      const week = coverWeek(t);
      expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
      const trained = new Set(t.days.flatMap((d) => d.weekdays));
      expect(
        week
          .filter((d) => d.label)
          .map((d) => d.weekday)
          .sort(),
      ).toEqual([...trained].sort());
      for (const d of week) if (d.label) expect(d.label.length).toBeLessThanOrEqual(4);
    }
  });
});
