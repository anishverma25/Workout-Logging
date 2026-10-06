import { buildData } from '@/test/fixtures';
import { setsCsv, toCsv } from './export';

describe('CSV export', () => {
  it('quotes only what needs quoting', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', null, 3]])).toBe('a,"b,c","say ""hi""",,3');
  });

  it('writes one row per completed set', () => {
    const data = buildData([
      {
        at: '2026-10-01T10:00:00',
        exercises: [
          {
            key: 'barbell-bench-press',
            sets: [
              { w: 80, r: 5 },
              { w: 80, r: 5, done: false },
            ],
          },
        ],
      },
    ]);
    const lines = setsCsv(data).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('workout_date,workout,exercise');
    expect(lines[1]).toContain(',1,working,80,5,');
  });
});
