import type { RoutineTemplate } from '@/data/library/templates';

/** Monday first, as people in India read a week; Date#getDay() numbers. */
const ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const LETTER: Record<number, string> = { 0: 'S', 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S' };

/** A day's name in two or three letters: "Push", "Pull", "Legs", "Up", "Lo", "A", "B", "Full". */
export function shortDayName(name: string): string {
  const n = name.trim();
  const workout = /^workout\s+([a-z0-9])$/i.exec(n);
  if (workout) return workout[1]!.toUpperCase();
  const full = /^full body\s+([a-z0-9])$/i.exec(n);
  if (full) return full[1]!.toUpperCase();
  const numbered = /^(upper|lower)\s+(\d)$/i.exec(n);
  if (numbered) return `${numbered[1]![0]!.toUpperCase()}${numbered[2]}`;
  if (/^upper/i.test(n)) return 'Up';
  if (/^lower/i.test(n)) return 'Lo';
  const word = n.split(/\s+/)[0]!;
  return word.length <= 4 ? word : word.slice(0, 3);
}

export interface CoverDay {
  weekday: number;
  letter: string;
  /** The short name of the session on this day, or null for a rest day. */
  label: string | null;
}

/** The template's week, Monday to Sunday. */
export function coverWeek(t: RoutineTemplate): CoverDay[] {
  return ORDER.map((weekday) => {
    const day = t.days.find((d) => d.weekdays.includes(weekday));
    return { weekday, letter: LETTER[weekday]!, label: day ? shortDayName(day.name) : null };
  });
}
