import { describe, expect, it } from 'vitest';
import { buildData } from '@/test/fixtures';
import { computeBadges } from '../achievements/badges';
import { streakCard } from '../share/cards';
import { buildSessions } from './sessions';
import { weeklyStreak } from './week';

/** Batch 20 (O1): Home, badges and the story card count the same streak. */
const NOW = new Date('2027-02-04T20:00:00+05:30'); // a Thursday
const at = (iso: string) => ({
  at: iso,
  exercises: [{ key: 'barbell-bench-press', sets: [{ w: 60, r: 8 }] }],
});
// Two workouts a week for the four weeks before this one (Mondays and Wednesdays).
const specs = [
  '2027-01-04',
  '2027-01-06',
  '2027-01-11',
  '2027-01-13',
  '2027-01-18',
  '2027-01-20',
  '2027-01-25',
  '2027-01-27',
].map((d) => at(`${d}T07:00:00.000Z`));
const data = buildData(specs);
const sessions = buildSessions(data);

function everywhere(minSessions: number) {
  const home = weeklyStreak(sessions, minSessions, NOW, 1).weeks;
  const card = streakCard(data, NOW, 1, minSessions)?.weeks ?? 0;
  const badges = computeBadges({
    sessions,
    exercises: data.exercises,
    bodyWeights: [],
    now: NOW,
    weekStartsOn: 1,
    minSessions,
  });
  const fourWeeks = badges.find((b) => b.id === 'streak-4')!;
  return { home, card, badge4: fourWeeks.earnedAt !== null };
}

describe('one streak everywhere', () => {
  it('two a week meets a target of 2 on Home, the card and the badges alike', () => {
    expect(everywhere(2)).toEqual({ home: 4, card: 4, badge4: true });
  });
  it('a target of 3 is missed everywhere, not only on Home', () => {
    expect(everywhere(3)).toEqual({ home: 0, card: 0, badge4: false });
  });
});
