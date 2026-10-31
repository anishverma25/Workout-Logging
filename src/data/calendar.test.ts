import { trainingCalendar } from './calendar';

describe('training calendar', () => {
  it('repeats each day weekly on its weekdays with a reminder', () => {
    const ics = trainingCalendar({
      routineName: 'Push Pull Legs',
      days: [
        { id: 'a', name: 'Push', weekdays: [4, 1] },
        { id: 'b', name: 'Rest', weekdays: [] },
      ],
      time: '18:30',
      minutes: 60,
      remindBefore: 30,
      now: new Date(2026, 9, 7, 9), // Wednesday
    });
    expect(ics).toContain('DTSTART:20261008T183000'); // next Thursday
    expect(ics).toContain('DTEND:20261008T193000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TH');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('SUMMARY:Push (Push Pull Legs)');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  });
});
