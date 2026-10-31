/** Birth date typed as day, month and year parts. */
export interface DateParts {
  day: string;
  month: string;
  year: string;
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function partsFromIso(value: string): DateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? { day: m[3]!, month: m[2]!, year: m[1]! } : { day: '', month: '', year: '' };
}

export type BirthDateCheck =
  { ok: true; iso: string; age: number } | { ok: false; error: string | null };

/** Validates the three parts as typed. No error until a part is complete. */
export function checkBirthDate(p: DateParts, today = new Date()): BirthDateCheck {
  if (!p.day && !p.month && !p.year) return { ok: false, error: null };
  const d = Number(p.day);
  const m = Number(p.month);
  const y = Number(p.year);
  if (p.day.length === 2 && (d < 1 || d > 31)) return { ok: false, error: 'Day is 1 to 31.' };
  if (p.month.length === 2 && (m < 1 || m > 12)) return { ok: false, error: 'Month is 1 to 12.' };
  if (!p.day || !p.month || p.year.length < 4) return { ok: false, error: null };
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1) return { ok: false, error: `${MONTHS[m - 1]} has no day ${d}.` };
  let age = today.getFullYear() - y;
  if (today.getMonth() < m - 1 || (today.getMonth() === m - 1 && today.getDate() < d)) age--;
  if (date > today) return { ok: false, error: 'That date is in the future.' };
  if (age > 110) return { ok: false, error: 'Check the year.' };
  const iso = `${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`;
  return { ok: true, iso, age };
}
