import { buildData } from '@/test/fixtures';
import { prCard, streakCard, workoutCard } from './cards';
import {
  clockTime,
  globalRankStory,
  groupRankStory,
  movement,
  ordinal,
  periodLabels,
  prStory,
  restText,
  streakStory,
  topLabel,
  workoutStory,
} from './story';

const bench = (at: string, w: number, r = 5) => ({
  at,
  minutes: 50,
  name: 'Push',
  exercises: [
    {
      key: 'barbell-bench-press',
      sets: [
        { w, r },
        { w, r },
        { w: w - 10, r: r + 2 },
      ],
    },
  ],
});

const data = buildData([
  bench('2026-09-01T10:00:00', 80),
  bench('2026-09-08T10:00:00', 82.5),
  bench('2026-09-15T10:00:00', 85),
  bench('2026-09-22T10:00:00', 85),
  bench('2026-09-29T18:42:00', 90),
]);
const last = data.workouts[data.workouts.length - 1]!.id;

describe('story content', () => {
  it('writes ordinals and times plainly', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
      '111th',
    ]);
    expect(clockTime(new Date(2026, 8, 29, 18, 42))).toBe('6:42 pm');
    expect(clockTime(new Date(2026, 8, 29, 0, 5))).toBe('12:05 am');
    expect(restText(108)).toBe('1:48');
  });

  it('sums up a workout from its own numbers only', () => {
    const s = workoutStory(workoutCard(data, last)!, { unit: 'kg', streakWeeks: 5 });
    expect(s.title).toBe('Push');
    expect(s.sub).toBe('Workout 5');
    expect(s.big).toEqual({ v: '1,460', u: 'kg', l: 'Total lifted' });
    expect(s.stats.map((x) => x.l)).toEqual(['Time', 'Sets', 'Records']);
    expect(s.chips).toContain('5th workout');
    expect(s.chips).toContain('5 week streak');
    expect(s.time).toBe('6:42 pm');
    // Rings are real fractions of the 12-week best; this was the heaviest session.
    expect(s.rings).toHaveLength(3);
    expect(s.rings[2]!.frac).toBe(1);
    for (const r of s.rings) expect(r.frac).toBeGreaterThanOrEqual(0);
  });

  it('shows a record with its gain and ladder in pounds when asked', () => {
    const s = prStory(prCard(data, last)!, { unit: 'kg' });
    expect(s.big).toEqual({ v: '90', u: 'kg', l: 'Heaviest set' });
    expect(s.note).toBe('5 kg over your last best');
    expect(s.extra.type).toBe('bars');
    if (s.extra.type === 'bars') expect(s.extra.items.map((i) => i.v)).toEqual([80, 82.5, 85, 90]);
    expect(s.rings[0]!.frac).toBe(1);
    expect(s.rings[1]!.frac).toBeCloseTo(85 / 90, 5);
    const lb = prStory(prCard(data, last)!, { unit: 'lb' });
    expect(lb.big.u).toBe('lb');
  });

  it('counts the streak grid into rings out of real wholes', () => {
    const now = new Date(2026, 9, 1);
    const s = streakStory(streakCard(data, now, 1)!, now);
    expect(s.big).toEqual({ v: '5', u: 'weeks', l: 'In a row' });
    expect(s.rings[0]!.stat.u).toBe('/12');
    expect(s.rings[0]!.frac).toBeCloseTo(5 / 12, 5);
  });

  it('labels periods, movement and top shares', () => {
    expect(periodLabels('week', '2026-11-02', '2026-11-08')).toMatchObject({
      date: 'Week of 2 Nov',
      short: '2 to 8 Nov',
    });
    expect(periodLabels('week', '2026-10-26', '2026-11-01').short).toBe('26 Oct to 1 Nov');
    expect(periodLabels('month', '2026-11-01', '2026-11-30').date).toBe('November 2026');
    expect(movement(7, 10)).toBe('Up 3 places');
    expect(movement(7, 6)).toBe('Down 1 place');
    expect(movement(7, 7)).toBe('Same place');
    expect(movement(7, null)).toBeNull();
    expect(topLabel(7, 300)).toBe('Top 10');
    expect(topLabel(40, 300)).toBe('Top 25%');
    expect(topLabel(14, 300)).toBe('Top 5%');
    expect(topLabel(40, 12)).toBeNull();
  });

  it('builds a global rank card that never shows other people', () => {
    const s = globalRankStory({
      period: 'week',
      startsOn: '2026-11-02',
      endsOn: '2026-11-08',
      rank: 2,
      total: 240,
      previousRank: 5,
      score: 90,
      workouts: 4,
      hardSets: 25,
      records: 2,
      proteinDays: 5,
    });
    expect(s.big.v).toBe('#2');
    expect(s.tier).toBe('silver');
    expect(s.note).toBe('Up 3 places since last week');
    expect(s.extra).toEqual({
      type: 'lines',
      items: [
        { l: 'Workouts', r: '4 × 10 = 40' },
        { l: 'Hard sets', r: '25 × 1 = 25' },
        { l: 'Records', r: '2 × 5 = 10' },
        { l: 'Protein days', r: '5 × 3 = 15' },
      ],
    });
    expect(s.rings[1]!.frac).toBe(1);
  });

  it('builds a group rank card with the gap to first and no names', () => {
    const s = groupRankStory({
      period: 'week',
      startsOn: '2026-11-02',
      endsOn: '2026-11-08',
      rank: 2,
      total: 12,
      previousRank: null,
      score: 90,
      workouts: 4,
      hardSets: 25,
      records: 2,
      proteinDays: 5,
      groupName: 'Campus lifters',
      members: 12,
      leaderScore: 102,
    });
    expect(s.title).toBe('Campus lifters');
    expect(s.note).toBe('12 points behind 1st');
    expect(s.chips).toEqual(['2nd place', '90 points']);
    const first = groupRankStory({
      period: 'month',
      startsOn: '2026-11-01',
      endsOn: '2026-11-30',
      rank: 1,
      total: 12,
      previousRank: 3,
      score: 300,
      workouts: 14,
      hardSets: 80,
      records: 6,
      proteinDays: 20,
      groupName: 'Campus lifters',
      members: 12,
      leaderScore: 300,
    });
    expect(first.tier).toBe('gold');
    expect(first.note).toBe('Top of Campus lifters');
    // A month's rings are out of the monthly most, not the weekly caps.
    expect(first.rings[0]!.frac).toBeLessThan(1);
  });
});
