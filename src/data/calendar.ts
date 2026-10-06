import { APP_NAME } from '@/app/navigation';

/**
 * A calendar file (iCalendar, RFC 5545) with the routine's training days as weekly repeating
 * events and a reminder before each. Phones' own calendars then do the reminding, which works
 * whether or not the app is open: something a web app cannot do on its own.
 */

const DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (n: number) => String(n).padStart(2, '0');
/** Floating local time, so the event stays at the same clock time wherever you are. */
const local = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export interface CalendarDay {
  id: string;
  name: string;
  weekdays: number[];
}

export function trainingCalendar(input: {
  routineName: string;
  days: CalendarDay[];
  /** "18:30" */
  time: string;
  minutes: number;
  remindBefore: number;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const [h, m] = input.time.split(':').map(Number) as [number, number];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${APP_NAME}//Training days//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const day of input.days) {
    if (day.weekdays.length === 0) continue;
    // First occurrence: the next of its weekdays, from today.
    const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    while (!day.weekdays.includes(first.getDay())) first.setDate(first.getDate() + 1);
    const end = new Date(first.getTime() + input.minutes * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${day.id}@${APP_NAME.toLowerCase()}`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${local(first)}`,
      `DTEND:${local(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${[...day.weekdays].sort().map((d) => DAY[d]).join(',')}`,
      `SUMMARY:${escape(`${day.name} (${input.routineName})`)}`,
      `DESCRIPTION:${escape(`Training day from ${APP_NAME}.`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(`${day.name} in ${input.remindBefore} minutes`)}`,
      `TRIGGER:-PT${input.remindBefore}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
