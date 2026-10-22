import { buildData } from '@/test/fixtures';
import type { ActivityLog, WaterLog } from '@/domain/models/schemas';
import { setsCsv, toCsv, waterActivityCsv } from './export';

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

  it('writes water and activity one day per row, leaving out deleted entries', () => {
    const meta = {
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      origin: 'user' as const,
    };
    const water = (
      id: string,
      date: string,
      ml: number,
      deletedAt: string | null = null,
    ): WaterLog => ({
      id,
      ...meta,
      deletedAt,
      date,
      ml,
    });
    const act = (over: Partial<ActivityLog>): ActivityLog => ({
      id: 'a',
      ...meta,
      deletedAt: null,
      date: '2026-10-01',
      kind: 'cardio',
      activity: 'treadmill_walk',
      minutes: 30,
      distanceKm: null,
      speedKmh: null,
      inclinePct: null,
      watts: null,
      effort: null,
      steps: null,
      kcal: 100,
      kcalSource: 'estimated',
      ...over,
    });
    const csv = waterActivityCsv(
      [
        water('1', '2026-10-01', 250),
        water('2', '2026-10-01', 500),
        water('3', '2026-10-01', 900, 'x'),
      ],
      [
        act({}),
        act({ id: 'b', kind: 'steps', activity: null, minutes: null, steps: 8000, kcal: 200 }),
      ],
    ).split('\r\n');
    expect(csv).toEqual([
      'date,water_ml,steps,steps_kcal,cardio_minutes,cardio_kcal',
      '2026-10-01,750,8000,200,30,100',
    ]);
  });
});
