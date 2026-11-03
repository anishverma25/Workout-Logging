/**
 * The leaderboard story card (November 2026): your place on the global leaderboard or in a
 * group, your points and what earned them, and how far you are from the next place. Only the
 * person's own numbers: other members' names never leave the app on a card.
 */

export interface RankRowLike {
  rank: number;
  me: boolean;
  score: number;
  workouts: number;
  hardSets: number;
  records: number;
  proteinDays: number;
}

export interface RankCard {
  scope: 'global' | 'group';
  /** The group's name, or the app's for the global leaderboard. */
  where: string;
  period: 'week' | 'month';
  /** Finished period (last week or month). */
  locked: boolean;
  startsOn: string;
  endsOn: string;
  rank: number;
  total: number;
  score: number;
  workouts: number;
  hardSets: number;
  records: number;
  proteinDays: number;
  /** Points to the place above, or the lead over the place below when first. */
  gap: { kind: 'behind' | 'ahead'; points: number } | null;
}

export function rankCard(input: {
  scope: 'global' | 'group';
  where: string;
  period: 'week' | 'month';
  locked: boolean;
  startsOn: string;
  endsOn: string;
  total: number;
  rows: RankRowLike[];
  /** The person's own row when it is not among `rows` (outside the top 100). */
  mine?: RankRowLike | null;
}): RankCard | null {
  const me = input.rows.find((r) => r.me) ?? input.mine ?? null;
  if (!me || me.score <= 0) return null;
  const above = input.rows.find((r) => r.rank === me.rank - 1);
  const below = input.rows.find((r) => r.rank === me.rank + 1);
  const gap =
    me.rank === 1
      ? below
        ? { kind: 'ahead' as const, points: me.score - below.score }
        : null
      : above
        ? { kind: 'behind' as const, points: Math.max(0, above.score - me.score) }
        : null;
  return {
    scope: input.scope,
    where: input.where,
    period: input.period,
    locked: input.locked,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    rank: me.rank,
    total: Math.max(input.total, me.rank),
    score: me.score,
    workouts: me.workouts,
    hardSets: me.hardSets,
    records: me.records,
    proteinDays: me.proteinDays,
    gap,
  };
}

/** The line under the rank: "Leading by 12 points", "3 points behind #2", "Level with #2". */
export function gapLine(card: RankCard): string | null {
  if (!card.gap) return null;
  const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;
  if (card.gap.kind === 'ahead')
    return card.gap.points === 0 ? 'Level at the top' : `Leading by ${pts(card.gap.points)}`;
  return card.gap.points === 0
    ? `Level with #${card.rank - 1}`
    : `${pts(card.gap.points)} behind #${card.rank - 1}`;
}
