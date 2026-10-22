import type { WaterLog } from '@/domain/models/schemas';
import { glassesText, toGlasses, waterByDay, waterEntries, waterOn } from './water';

const log = (date: string, ml: number, at: string, deletedAt: string | null = null): WaterLog => ({
  id: `${date}-${at}`,
  createdAt: at,
  updatedAt: at,
  deletedAt,
  origin: 'user',
  date,
  ml,
});

const logs = [
  log('2026-10-22', 250, '2026-10-22T08:00:00.000Z'),
  log('2026-10-22', 500, '2026-10-22T11:00:00.000Z'),
  log('2026-10-22', 250, '2026-10-22T12:00:00.000Z', '2026-10-22T12:01:00.000Z'),
  log('2026-10-21', 1000, '2026-10-21T09:00:00.000Z'),
];

describe('water', () => {
  it('totals a day and leaves out deleted entries', () => {
    expect(waterOn(logs, '2026-10-22')).toBe(750);
    expect(waterOn(logs, '2026-10-20')).toBe(0);
  });

  it('lists a day newest first', () => {
    expect(waterEntries(logs, '2026-10-22').map((l) => l.ml)).toEqual([500, 250]);
  });

  it('converts to glasses of the person’s own size', () => {
    expect(toGlasses(1250, 250)).toBe(5);
    expect(toGlasses(500, 300)).toBe(1.7);
    expect(glassesText(250, 250)).toBe('1 glass');
    expect(glassesText(750, 250)).toBe('3 glasses');
  });

  it('gives each day of the week with its total', () => {
    expect(waterByDay(logs, ['2026-10-21', '2026-10-22'])).toEqual([
      { date: '2026-10-21', ml: 1000 },
      { date: '2026-10-22', ml: 750 },
    ]);
  });
});
