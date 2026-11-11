import { computeBadges, badgeStamp, type Badge } from '@/domain/achievements/badges';
import { buildSessions } from '@/domain/analytics/sessions';
import { buildData } from '@/test/fixtures';
import { badgeShape, FIT, stampLayout } from './BadgeMedallion';
import { nextGoal, toGo } from './BadgeUnlock';

/** Every badge's number and word fit inside its shape, and the unlock copy reads right. */
const badges: Badge[] = computeBadges({
  sessions: buildSessions(buildData([])),
  exercises: buildData([]).exercises,
  bodyWeights: [],
  now: new Date(2026, 10, 10),
  weekStartsOn: 1,
});

describe('badge art', () => {
  it('fits every number inside its shape', () => {
    expect(badges.length).toBeGreaterThan(20);
    for (const b of badges) {
      const shape = badgeShape(b);
      const { big, small } = badgeStamp(b);
      const l = stampLayout(shape, big, small);
      // Inter Display digits run about 0.62 of the size wide.
      expect(l.bigSize * [...big].length * 0.62, b.id).toBeLessThanOrEqual(FIT[shape].w + 0.01);
      expect(l.bigSize, b.id).toBeGreaterThanOrEqual(8);
      if (l.word) expect(l.smallSize * l.word.length * 0.56, b.id).toBeLessThanOrEqual(FIT[shape].w * 1.15 + 0.01);
      expect(l.bigY, b.id).toBeLessThan(92);
      if (shape === 'medals') expect(l.word).toBe('');
    }
  });

  it('says what is left in the badge’s own unit', () => {
    const plate = badges.find((b) => b.id.startsWith('plates-barbell-bench-press'))!;
    expect(toGo({ ...plate, current: 67.5 })).toMatch(/^[\d.]+ kg to go$/);
    const streak = badges.find((b) => b.group === 'streaks')!;
    expect(toGo({ ...streak, current: streak.target - 1 })).toBe('1 week to go');
  });

  it('points to the next badge on the same lift, never another lift', () => {
    const bench = badges.filter((b) => b.id.startsWith('plates-barbell-bench-press')).sort((a, b) => a.target - b.target);
    const first = { ...bench[0]!, earnedAt: new Date() };
    const next = nextGoal(first, badges);
    if (bench.length > 1) expect(next?.label).toBe(`Next: ${bench[1]!.title}`);
    else expect(next).toBeNull();
  });
});
