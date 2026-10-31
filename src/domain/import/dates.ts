/**
 * Dates as other apps write them in their exports. They carry no time zone: they are the
 * wall-clock time where the person trained, so they are read in the device's own time zone.
 *
 * Seen in the wild:
 * - Hevy:   "12 Oct 2026, 19:07"  and older  "Oct 12, 2026, 7:07 PM"
 * - Strong: "2023-03-01 18:05:22" and         "2023-03-01 18:05"
 *
 * And after the file went through Excel, which rewrites dates in the phone's or computer's own
 * format: "12/10/2026 19:07" (day first in India and Europe), "10/12/2026 7:07 PM" (month
 * first in the US), "12-Oct-26 19:07", or, in an .xlsx, a serial number such as 46307.79.
 */

/** Day first or month first, for dates written with slashes. */
export type DateOrder = 'dmy' | 'mdy';

const SLASH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ ,T]+(.+))?$/;

/**
 * Which way a column's slash dates go. Any first part over 12 means day first; any second part
 * over 12 means month first. When every date fits both ways, the reading that keeps the rows in
 * date order wins (exports are sorted by date). When even that cannot tell, `fallback`: the
 * device's own convention.
 */
export function dateOrder(values: (string | undefined)[], fallback: DateOrder = 'dmy'): DateOrder {
  const parts: [number, number, number][] = [];
  for (const v of values) {
    const m = SLASH.exec((v ?? '').trim());
    if (!m) continue;
    if (Number(m[1]) > 12) return 'dmy';
    if (Number(m[2]) > 12) return 'mdy';
    parts.push([Number(m[1]), Number(m[2]), fullYear(m[3]!)]);
  }
  const breaks = (order: DateOrder) => {
    const keys = parts.map(([a, b, y]) =>
      order === 'dmy' ? y * 400 + b * 31 + a : y * 400 + a * 31 + b,
    );
    let up = 0;
    let down = 0;
    for (let i = 1; i < keys.length; i++) {
      if (keys[i]! > keys[i - 1]!) up++;
      else if (keys[i]! < keys[i - 1]!) down++;
    }
    return Math.min(up, down);
  };
  const dmy = breaks('dmy');
  const mdy = breaks('mdy');
  return dmy < mdy ? 'dmy' : mdy < dmy ? 'mdy' : fallback;
}

/** Month first only where that is the custom: the US and a few places that follow it. */
export function localeDateOrder(locale: string | undefined): DateOrder {
  return /-(US|PH|FM|MH|PW)\b/i.test(locale ?? '') ? 'mdy' : 'dmy';
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** Excel's day count from 30 December 1899, as wall-clock time. */
function fromExcelSerial(serial: number): Date | null {
  if (!(serial > 20000 && serial < 80000)) return null;
  const totalSeconds = Math.round(serial * 86400);
  const days = Math.floor(totalSeconds / 86400);
  const secs = totalSeconds - days * 86400;
  const base = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  return new Date(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    Math.floor(secs / 3600),
    Math.floor((secs % 3600) / 60),
    secs % 60,
  );
}

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

export function parseExportDate(text: string | undefined, order: DateOrder = 'dmy'): Date | null {
  const s = (text ?? '').trim();
  if (!s) return null;

  // 46307.7965 (an .xlsx date cell)
  if (/^\d{5}(?:\.\d+)?$/.test(s)) return fromExcelSerial(Number(s));

  // 12/10/2026 19:07, 10/12/2026 7:07 PM, 12.10.26
  let slash = SLASH.exec(s);
  if (slash) {
    const [a, b] = [Number(slash[1]), Number(slash[2])];
    const [day, month] = order === 'dmy' ? [a, b] : [b, a];
    return build(fullYear(slash[3]!), month - 1, day, clock(slash[4]));
  }

  // 12-Oct-26 19:07, 12-Oct-2026
  slash = /^(\d{1,2})-([a-z]{3,4})[a-z]*-(\d{2}|\d{4})(?:[ ,T]+(.+))?$/i.exec(s);
  if (slash) {
    const mo = MONTHS[slash[2]!.toLowerCase()];
    if (mo !== undefined) return build(fullYear(slash[3]!), mo, Number(slash[1]), clock(slash[4]));
  }

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
