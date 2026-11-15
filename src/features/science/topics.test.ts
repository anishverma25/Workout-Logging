import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Batch 15: the science page says what the app does. Each number below is written in
 * topics.tsx from the constant that enforces it, so changing the rule changes the page. The
 * test fails when the text near a fragment has a bare number instead of the constant.
 */
const SOURCE = readFileSync('src/features/science/topics.tsx', 'utf8');

const PAIRS: [fragment: string, constant: string][] = [
  ['A lift has stalled when nothing has moved for', 'STALL_WEEKS_BY_EXPERIENCE.beginner'],
  ['across at least', 'STALL_MIN_SESSIONS'],
  ['shown as holding, not stalled,', 'HOLD_WEEKS'],
  ['it keeps each muscle', 'SETS_FLOOR'],
  ['it keeps each muscle', 'SETS_CEILING'],
  ['hard sets a week and calls under', 'SETS_LOW'],
  ['A lift counts as moved at', 'LIFT_UP'],
  ['A lighter week (about', 'DELOAD_SHARE'],
  ['is a logged day that reaches', 'PROTEIN_DAY_SHARE'],
  ['fully logged days (over', 'LOGGED_DAY_MIN_KCAL'],
  ['`Needs ${', 'MAINTENANCE_MIN_DAYS'],
  ['calories never under', 'MIN_DAILY_KCAL'],
  ['log at least', 'STALL_DEFICIT_KCAL'],
];

describe('science topics take their numbers from the code', () => {
  it.each(PAIRS)('“%s” uses %s', (fragment, constant) => {
    const at = SOURCE.indexOf(fragment);
    expect(at, `fragment not found: ${fragment}`).toBeGreaterThanOrEqual(0);
    const near = SOURCE.slice(at, at + fragment.length + 160);
    expect(near).toContain(constant);
  });

  it('no stall, set range or protein-day number is written by hand', () => {
    for (const bad of [
      /stalled when nothing has moved for \d/,
      /between \d+ and \d+ hard sets a week/,
      /reaches \d+% of your protein target/,
    ])
      expect(SOURCE).not.toMatch(bad);
  });
});
