import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { BENCH, buildData } from '@/test/fixtures';
import { readTableFile, MAX_IMPORT_BYTES, MAX_IMPORT_COLUMNS } from '@/domain/import/spreadsheet';
import { isSafeAvatar, MAX_AVATAR_CHARS } from '@/app/community';
import { safeNext } from '@/features/account/next';
import type { BodyWeightEntry, RoutineDay } from '../models/schemas';
import { performanceByExercise } from './performance';
import { bodyWeightAt, WEIGHT_MAX_AGE_DAYS } from './progress';
import { adherence } from './schedule';
import { buildSessions } from './sessions';

const ROUTINE = '11111111-1111-4111-8111-111111111111';
const at = (d: number, h = 18) => new Date(2026, 8, d, h).toISOString();

describe('batch 21: progress and import correctness', () => {
  it('G1: sessions before the routine started never count as done', () => {
    const days: RoutineDay[] = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        routineId: ROUTINE,
        name: 'Full',
        position: 0,
        weekdays: [1, 2, 3, 4, 5, 6, 0],
        createdAt: at(1),
        updatedAt: at(1),
        deletedAt: null,
        origin: 'user',
      } as unknown as RoutineDay,
    ];
    const sessions = buildSessions(
      buildData([7, 8, 9].map((d) => ({ at: at(d), routineId: ROUTINE, exercises: [] }))),
    );
    // Routine made on Thursday 10 Sep; Mon to Wed were imported history.
    const result = adherence(
      sessions,
      days,
      ROUTINE,
      new Date(2026, 8, 7),
      new Date(2026, 8, 14),
      new Date(2026, 8, 13, 23),
      new Date(2026, 8, 10, 9),
    );
    expect(result.completed).toBe(0);
    expect(result.planned).toBe(3);
  });

  it('G2: the same exercise twice in one workout is one session of it', () => {
    const data = buildData([
      {
        at: at(7),
        exercises: [
          { key: 'barbell-bench-press', sets: [{ w: 60, r: 8 }] },
          { key: 'barbell-bench-press', sets: [{ w: 80, r: 5 }] },
        ],
      },
    ]);
    const perf = performanceByExercise(buildSessions(data)).get(BENCH) ?? [];
    expect(perf).toHaveLength(1);
    expect(perf[0]!.heaviestLoad).toBe(80);
  });

  it('G3: the chart e1RM is the best e1RM, whatever the rep range', () => {
    const data = buildData([
      {
        at: at(7),
        exercises: [
          {
            key: 'barbell-bench-press',
            sets: [
              { w: 60, r: 3 },
              { w: 70, r: 10 },
            ],
          },
        ],
      },
    ]);
    const [p] = performanceByExercise(buildSessions(data)).get(BENCH) ?? [];
    expect(p!.chartE1rm).toBe(p!.bestE1rm);
  });

  it('G6: a weigh-in older than 90 days is not used, and never picked as "after"', () => {
    const weigh = (iso: string, kg: number): BodyWeightEntry =>
      ({
        id: iso,
        weightKg: kg,
        measuredAt: iso,
        createdAt: iso,
        updatedAt: iso,
        deletedAt: null,
        origin: 'user',
      }) as unknown as BodyWeightEntry;
    const old = weigh(new Date(2026, 0, 1, 8).toISOString(), 90);
    const day = new Date(2026, 0, 1 + WEIGHT_MAX_AGE_DAYS + 5, 18);
    expect(bodyWeightAt([old], day)).toBeNull();
    expect(bodyWeightAt([old], new Date(2026, 0, 20))).toBe(90);
    const soon = weigh(new Date(2026, 0, 1 + WEIGHT_MAX_AGE_DAYS + 8, 8).toISOString(), 85);
    expect(bodyWeightAt([old, soon], day)).toBe(85);
  });

  it('X2: oversized files are refused with a plain message', () => {
    const big = new Uint8Array(MAX_IMPORT_BYTES + 1);
    expect(() => readTableFile('big.csv', big)).toThrow(/over 20 MB/);
    const wide = Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, i) => `c${i}`).join(',');
    expect(() => readTableFile('wide.csv', strToU8(`${wide}\n${wide}\n`))).toThrow(/columns/);
    expect(readTableFile('ok.csv', strToU8('a,b\n1,2\n')).rows).toHaveLength(1);
  });

  it('X3: only small JPEG, PNG or WebP photos of others are drawn', () => {
    expect(isSafeAvatar('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(isSafeAvatar('data:image/webp;base64,AAAA')).toBe(true);
    expect(isSafeAvatar('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isSafeAvatar('data:image/png;base64,AA"onerror=x')).toBe(false);
    expect(isSafeAvatar(`data:image/png;base64,${'A'.repeat(MAX_AVATAR_CHARS)}`)).toBe(false);
    expect(isSafeAvatar(42)).toBe(false);
  });

  it('X3: setup only follows same-app links', () => {
    expect(safeNext('https://evil.example', '/')).toBe('/');
    expect(safeNext('//evil.example', '/')).toBe('/');
    expect(safeNext('/food', '/')).toBe('/food');
  });
});
