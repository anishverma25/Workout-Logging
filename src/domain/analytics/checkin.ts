import { addDays, startOfWeek, type WeekStartsOn } from '@/lib/dates';
import type { Experience } from '../models/schemas';
import { performanceByExercise } from './performance';
import { detectPersonalRecords } from './prs';
import { sessionsBetween, workingSetCount, type Session } from './sessions';
import { balanceRatios, detectPlateaus, loadSpike } from './standards';
import type { Exercise } from '../models/schemas';

export interface WeeklyCheckin {
  weekStart: Date;
  sessions: number;
  target: number | null;
  workingSets: number;
  /** Lifts whose best e1RM last week beat everything before it. */
  improved: { exerciseId: string; name: string; gainKg: number }[];
  records: number;
  stalled: { exerciseId: string; name: string; weeks: number }[];
  focus: { kind: FocusKind; text: string };
}

export type FocusKind = 'ease_off' | 'consistency' | 'stalled' | 'balance' | 'keep_going' | 'start';

/**
 * Last calendar week in review, from fixed rules. The focus is the first that applies:
 * a load spike, then missed sessions, then a stalled lift, then lopsided training, otherwise
 * keep going.
 */
export function weeklyCheckin(input: {
  sessions: Session[];
  exercises: Exercise[];
  target: number | null;
  experience: Experience | null | undefined;
  now: Date;
  weekStartsOn: WeekStartsOn;
}): WeeklyCheckin | null {
  const { sessions, exercises, target, now, weekStartsOn } = input;
  const thisWeek = startOfWeek(now, weekStartsOn);
  const weekStart = addDays(thisWeek, -7);
  const first = sessions[0];
  if (!first || first.date >= thisWeek) return null;
  const week = sessionsBetween(sessions, weekStart, thisWeek);
  const names = new Map(exercises.map((e) => [e.id, e.name]));

  const before = sessions.filter((s) => s.date < weekStart);
  const bestBefore = new Map<string, number>();
  for (const [id, list] of performanceByExercise(before))
    for (const p of list)
      if (p.bestE1rm !== null) bestBefore.set(id, Math.max(bestBefore.get(id) ?? 0, p.bestE1rm));
  const improved: WeeklyCheckin['improved'] = [];
  for (const [id, list] of performanceByExercise(week)) {
    const best = Math.max(...list.map((p) => p.bestE1rm ?? 0));
    const prior = bestBefore.get(id);
    if (best > 0 && prior !== undefined && best > prior + 1e-9)
      improved.push({ exerciseId: id, name: names.get(id) ?? 'Exercise', gainKg: best - prior });
  }
  improved.sort((a, b) => b.gainKg - a.gainKg);

  const upToWeekEnd = sessions.filter((s) => s.date < thisWeek);
  const records = detectPersonalRecords(upToWeekEnd, exercises).filter(
    (r) => r.date >= weekStart && r.date < thisWeek,
  ).length;
  const lastDay = addDays(thisWeek, -1);
  const stalled = detectPlateaus(performanceByExercise(upToWeekEnd), lastDay, input.experience).map(
    (p) => ({
      exerciseId: p.exerciseId,
      name: names.get(p.exerciseId) ?? 'Exercise',
      weeks: p.weeks,
    }),
  );
  const spike = loadSpike(upToWeekEnd, lastDay);
  const lopsided = balanceRatios(upToWeekEnd, lastDay).find(
    (b) => b.verdict === 'a_heavy' || b.verdict === 'b_heavy',
  );

  let focus: WeeklyCheckin['focus'];
  if (week.length === 0)
    focus = {
      kind: 'start',
      text: 'No workouts last week. Plan two short sessions this week to get going again.',
    };
  else if (spike)
    focus = {
      kind: 'ease_off',
      text: `You did ${spike.ratio.toFixed(1)} times your usual sets. Keep this week closer to ${Math.round(spike.chronicSetsPerWeek)} sets.`,
    };
  else if (target && week.length < target)
    focus = {
      kind: 'consistency',
      text: `${week.length} of ${target} sessions. Put your training days in your calendar to hit ${target} this week.`,
    };
  else if (stalled[0])
    focus = {
      kind: 'stalled',
      text: `${stalled[0].name} has not improved for ${stalled[0].weeks} weeks. Try a different rep range for it this week.`,
    };
  else if (lopsided)
    focus = {
      kind: 'balance',
      text:
        lopsided.verdict === 'a_heavy'
          ? `More ${lopsided.a.label.toLowerCase()} than ${lopsided.b.label.toLowerCase()} lately. Add a few sets of ${lopsided.b.label.toLowerCase()} work.`
          : `More ${lopsided.b.label.toLowerCase()} than ${lopsided.a.label.toLowerCase()} lately. Add a few sets of ${lopsided.a.label.toLowerCase()} work.`,
    };
  else
    focus = {
      kind: 'keep_going',
      text: 'A solid week. Add load where the logger suggests it and keep the same rhythm.',
    };

  return {
    weekStart,
    sessions: week.length,
    target,
    workingSets: week.reduce((n, s) => n + workingSetCount(s), 0),
    improved,
    records,
    stalled,
    focus,
  };
}
