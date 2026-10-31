/** Calendar-day difference (a - b), immune to daylight-saving shifts. */
function differenceInCalendarDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86_400_000);
}

/*
 * Dates in one fixed style (en-GB order, English names): "Today", "Yesterday", a weekday name
 * for 2 to 6 days ago, otherwise "Sat, 10 Oct", with the year when it is not this year.
 */

// Fixed three-letter months; newer ICU writes "Sept" for en-GB, which breaks the pattern.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Oct", or "10 Oct 2025" with the year. */
export function formatDayMonthFixed(date: Date, withYear = false): string {
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return withYear ? `${base} ${date.getFullYear()}` : base;
}

/** "Sat, 10 Oct", with the year when it is not the year of `now`. */
export function formatCalendarDate(date: Date, now: Date = new Date()): string {
  const withYear = date.getFullYear() !== now.getFullYear();
  return `${shortDayName(date.getDay())}, ${formatDayMonthFixed(date, withYear)}`;
}

/** "Today", "Yesterday", "Wednesday" (2 to 6 days ago), otherwise "Sat, 10 Oct". */
export function formatDate(date: Date, now: Date = new Date()): string {
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff >= 2 && diff <= 6) return longDayName(date.getDay());
  return formatCalendarDate(date, now);
}

/**
 * The same day inside a sentence: "today", "yesterday", "Wednesday", "Sat, 10 Oct". Day names
 * keep their capital ("Last logged Wednesday"), only today and yesterday are lower case.
 */
export function formatDateInSentence(date: Date, now: Date = new Date()): string {
  const text = formatDate(date, now);
  return text === 'Today' || text === 'Yesterday' ? text.toLowerCase() : text;
}

/**
 * "11 Sep to 10 Oct". Both ends carry their year when the years differ, and the end carries
 * it when the whole range is in another year.
 */
export function formatDateRange(start: Date, end: Date, now: Date = new Date()): string {
  const differ = start.getFullYear() !== end.getFullYear();
  const otherYear = end.getFullYear() !== now.getFullYear();
  return `${formatDayMonthFixed(start, differ)} to ${formatDayMonthFixed(end, differ || otherYear)}`;
}

/** Short day names in the fixed style: Mon Tue Wed Thu Fri Sat Sun (0 = Sunday). */
export function shortDayName(weekday: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][((weekday % 7) + 7) % 7]!;
}

/** Full day names, used only for the routine editor's day label (D10). */
export function longDayName(weekday: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    ((weekday % 7) + 7) % 7
  ]!;
}
