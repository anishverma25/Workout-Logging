import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { buildData } from '@/test/fixtures';
import { computeBadges, STREAK_RULE_FROM } from '../achievements/badges';
import { buildSessions } from '../analytics/sessions';
import { globalRankStory, groupRankStory } from './story';
import { wrapped, wrappedStory } from './wrapped';
import { printableName } from '@/features/report/pdf/names';

describe('batch 14: cards, badges, Wrapped and the PDF', () => {
  it('C1: rank lines add up to the points, and a finished week says so', () => {
    const s = groupRankStory({
      period: 'week',
      startsOn: '2026-11-02',
      endsOn: '2026-11-08',
      rank: 1,
      total: 4,
      previousRank: null,
      score: 40 + 25 + 10 + 15 + 10 + 4,
      workouts: 4,
      hardSets: 25,
      records: 2,
      proteinDays: 5,
      consistencyWeeks: 1,
      progressPoints: 4,
      past: true,
      groupName: 'Lifters',
      members: 4,
      leaderScore: 104,
    });
    expect(s.sub).toBe('Last week');
    const items = s.extra?.type === 'lines' ? s.extra.items : [];
    const sum = items.reduce((t, i) => t + Number(i.r.split('= ').pop()), 0);
    expect(sum).toBe(104);
    expect(items.map((i) => i.l)).toContain('Consistency');
    const g = globalRankStory({
      period: 'week',
      startsOn: '2026-11-02',
      endsOn: '2026-11-08',
      rank: 40,
      total: 50,
      previousRank: null,
      score: 10,
      workouts: 1,
      hardSets: 0,
      records: 0,
      proteinDays: 0,
      past: true,
    });
    expect(g.ach.h).toMatch(/last week$/);
    expect(g.sub).toBe('Last week');
  });

  it('C4: weekends are counted once each; early bird is 4 to 7 am; old badges are kept', () => {
    // Ten weekends after the rule change, trained Saturday and Sunday: earned on the 10th.
    const after = new Date(STREAK_RULE_FROM.getTime() + 3 * 86_400_000);
    const sat = new Date(after);
    sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7));
    const specs = [];
    for (let w = 0; w < 6; w++)
      for (const extra of [0, 1]) {
        const d = new Date(sat);
        d.setDate(d.getDate() + w * 7 + extra);
        d.setHours(2, 0, 0, 0); // 2 am: not an early bird
        specs.push({ at: d.toISOString(), exercises: [] });
      }
    const now = new Date(sat.getTime() + 60 * 86_400_000);
    const badges = computeBadges({
      sessions: buildSessions(buildData(specs)),
      exercises: SYSTEM_EXERCISES,
      bodyWeights: [],
      now,
      weekStartsOn: 1,
    });
    const weekend = badges.find((b) => b.id === 'weekend-warrior')!;
    expect(weekend).toMatchObject({ current: 6, earnedAt: null });
    expect(badges.find((b) => b.id === 'early-bird')).toMatchObject({ current: 0 });

    // Before the change: 10 weekend sessions on 5 weekends at 2 am keep both old badges.
    const old = new Date(2026, 8, 5, 2); // Saturday 5 Sep 2026
    const oldSpecs = [];
    for (let w = 0; w < 5; w++)
      for (const extra of [0, 1]) {
        const d = new Date(old);
        d.setDate(d.getDate() + w * 7 + extra);
        oldSpecs.push({ at: d.toISOString(), exercises: [] });
      }
    const kept = computeBadges({
      sessions: buildSessions(buildData(oldSpecs)),
      exercises: SYSTEM_EXERCISES,
      bodyWeights: [],
      now,
      weekStartsOn: 1,
    });
    expect(kept.find((b) => b.id === 'weekend-warrior')!.earnedAt).not.toBeNull();
    expect(kept.find((b) => b.id === 'early-bird')!.earnedAt).not.toBeNull();
  });

  it('C5: Wrapped rings never pass full, and tonnage is in the person’s unit', () => {
    const specs = [1, 3, 5].map((d) => ({
      at: new Date(2026, 9, d, 18).toISOString(),
      exercises: [
        {
          key: 'barbell-bench-press',
          sets: [
            { w: 60 + d * 10, r: 5 },
            { w: 62 + d * 10, r: 5 },
          ],
        },
        { key: 'barbell-back-squat', sets: [{ w: 80 + d * 10, r: 5 }] },
      ],
    }));
    const w = wrapped(buildData(specs), { year: 2026, month: 9 })!;
    const s = wrappedStory(w, new Date(2026, 10, 1), 'lb');
    for (const r of s.rings) expect(r.frac).toBeLessThanOrEqual(1);
    expect(s.rings[2]!.stat.u).toBe('');
    expect(s.stats[0]!.u).toBe('lb');
    expect(s.note).toMatch(/ lb lifted/);
  });

  it('R6: a name the PDF fonts cannot print becomes the library name, or Lift', () => {
    const latin = (s: string) => [...s].filter((c) => c.codePointAt(0)! <= 0x24f).join('');
    const bench = SYSTEM_EXERCISES[0]!;
    expect(printableName('बेंच प्रेस', bench.id, latin)).toBe(bench.name);
    expect(printableName('बेंच', 'custom-id', latin)).toBe('Lift');
    expect(printableName('My press', 'custom-id', latin)).toBe('My press');
  });
});
