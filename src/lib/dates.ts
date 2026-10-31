/**
 * Small, dependency-free date helpers.
 * All "day" logic uses the device's local time zone, because training weeks,
 * "today" and "yesterday" are local concepts. Stored timestamps are ISO strings (UTC).
 */

import {
  formatCalendarDate,
  formatDate,
  formatDayMonthFixed,
  longDayName,
  shortDayName,
} from '@/lib/format/dates';

export type WeekStartsOn = 0 | 1;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Calendar-day difference (a - b), immune to daylight-saving shifts. */
export function differenceInCalendarDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / DAY_MS);
}

export function isSameDay(a: Date, b: Date): boolean {
  return differenceInCalendarDays(a, b) === 0;
}

export function startOfWeek(date: Date, weekStartsOn: WeekStartsOn = 1): Date {
  const d = startOfDay(date);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

/** Local calendar key such as 2026-10-05. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISO(iso: string): Date {
  return new Date(iso);
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
}

/*
 * Display formats are fixed (en-GB order, English names) so every screen reads the same,
 * whatever the phone's language: the formatters live in `@/lib/format/dates`.
 */
const longDay = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const weekdayNarrow = new Intl.DateTimeFormat('en-GB', { weekday: 'narrow' });

/** "Saturday 10 October". */
export const formatLongDay = (d: Date) => longDay.format(d);
/** "Sat, 10 Oct", with the year when it is not this year. */
export const formatShortDate = (d: Date) => formatCalendarDate(d);
/** "10 Oct". */
export const formatDayMonth = (d: Date) => formatDayMonthFixed(d);
export const formatWeekday = (d: Date) => longDayName(d.getDay());
export const formatWeekdayShort = (d: Date) => shortDayName(d.getDay());
export const formatWeekdayNarrow = (d: Date) => weekdayNarrow.format(d);

/** "Today", "Yesterday", a weekday within the last week, otherwise "Sat, 10 Oct". */
export function formatRelativeDay(date: Date, now: Date = new Date()): string {
  return formatDate(date, now);
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number | null {
  const parts = birthDate.split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  let age = now.getFullYear() - y;
  const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/** A known Sunday, used to name weekday numbers (0 = Sunday) in the user's locale. */
const REFERENCE_SUNDAY = new Date(2026, 0, 4);

export const weekdayShortName = (weekday: number) =>
  formatWeekdayShort(addDays(REFERENCE_SUNDAY, weekday));
export const weekdayLongName = (weekday: number) =>
  formatWeekday(addDays(REFERENCE_SUNDAY, weekday));

/** Weekday numbers in display order for the user's week start. */
export function orderedWeekdays(weekStartsOn: WeekStartsOn): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
}

/** For use inside a sentence: "today", "yesterday", "on Thursday", "on Thu, 2 Oct". */
export function formatRelativeDayInline(date: Date, now: Date = new Date()): string {
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `on ${formatRelativeDay(date, now)}`;
}
