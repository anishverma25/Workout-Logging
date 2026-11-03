import { gapLine, rankCard, type RankRowLike } from './rankCard';

const row = (rank: number, score: number, me = false): RankRowLike => ({
  rank,
  me,
  score,
  workouts: 3,
  hardSets: 20,
  records: 1,
  proteinDays: 2,
});
const base = {
  scope: 'group' as const,
  where: 'Iron squad',
  period: 'week' as const,
  locked: false,
  startsOn: '2026-11-02',
  endsOn: '2026-11-08',
};

describe('leaderboard story card', () => {
  it('shows your place and how far the next place is', () => {
    const card = rankCard({ ...base, total: 3, rows: [row(1, 60), row(2, 52, true), row(3, 40)] })!;
    expect(card).toMatchObject({ rank: 2, total: 3, score: 52, workouts: 3 });
    expect(gapLine(card)).toBe('8 points behind #1');
  });

  it('shows the lead when first, and nothing to share without points', () => {
    const first = rankCard({ ...base, total: 2, rows: [row(1, 60, true), row(2, 59)] })!;
    expect(gapLine(first)).toBe('Leading by 1 point');
    expect(rankCard({ ...base, total: 1, rows: [row(1, 0, true)] })).toBeNull();
    expect(rankCard({ ...base, total: 2, rows: [row(1, 60), row(2, 50)] })).toBeNull();
  });

  it('uses your own row from outside the top 100', () => {
    const card = rankCard({
      ...base,
      scope: 'global',
      where: 'Overload Gym',
      total: 340,
      rows: [row(1, 90)],
      mine: { ...row(140, 13), me: true },
    })!;
    expect(card).toMatchObject({ rank: 140, total: 340 });
    expect(card.gap).toBeNull();
  });
});
