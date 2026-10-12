/**
 * Dates as other apps write them in their exports. They carry no time zone: they are the
 * wall-clock time where the person trained, so they are read in the device's own time zone.
 *
 * Seen in the wild:
 * - Hevy:   "12 Oct 2026, 19:07"  and older  "Oct 12, 2026, 7:07 PM"
 * - Strong: "2023-03-01 18:05:22" and         "2023-03-01 18:05"
 */

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function clock(text: string | undefined): [number, number, number] | null {
  if (!text) return [0, 0, 0];
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(text.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const meridiem = m[4]?.toLowerCase();
  if (meridiem === 'pm' && h < 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  if (h > 23 || Number(m[2]) > 59) return null;
  return [h, Number(m[2]), Number(m[3] ?? 0)];
}

function build(y: number, mo: number, d: number, t: [number, number, number] | null): Date | null {
  if (!t || mo < 0 || mo > 11 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(y, mo, d, t[0], t[1], t[2]);
  // Reject dates that rolled over, such as 31 February.
  return date.getMonth() === mo && date.getDate() === d ? date : null;
}

export function parseExportDate(text: string | undefined): Date | null {
  const s = (text ?? '').trim();
  if (!s) return null;

  // 2023-03-01 18:05:22, 2023-03-01T18:05, 2023-03-01
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](.+))?$/.exec(s);
  if (m) return build(Number(m[1]), Number(m[2]) - 1, Number(m[3]), clock(m[4]));

  // 12 Oct 2026, 19:07
  m = /^(\d{1,2})\s+([a-z]{3,4})[a-z]*\.?\s+(\d{4}),?\s*(.*)$/i.exec(s);
  if (m) {
    const mo = MONTHS[m[2]!.toLowerCase()];
    if (mo !== undefined) return build(Number(m[3]), mo, Number(m[1]), clock(m[4]));
  }

  // Oct 12, 2026, 7:07 PM
  m = /^([a-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4}),?\s*(.*)$/i.exec(s);
  if (m) {
    const mo = MONTHS[m[1]!.toLowerCase()];
    if (mo !== undefined) return build(Number(m[3]), mo, Number(m[2]), clock(m[4]));
  }
  return null;
}

/** Strong's "Duration" column: "1h 2m", "45m", "50s", "1h". Seconds, or null when unreadable. */
export function parseDuration(text: string | undefined): number | null {
  const s = (text ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(h|m|s)/g)];
  if (parts.length === 0) return null;
  let seconds = 0;
  for (const [, value, unit] of parts) {
    seconds += Number(value) * (unit === 'h' ? 3600 : unit === 'm' ? 60 : 1);
  }
  return Math.round(seconds);
}
