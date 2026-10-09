import { addDays, startOfWeek, type WeekStartsOn } from '@/lib/dates';
import { stableId } from '@/lib/ids';
import type { BodyWeightEntry } from '../models/schemas';
import { isAlive, isLoadEligible, isWorkingSet, type Session } from './sessions';
import { sessionVolumeLoad } from './volume';

export interface Milestone {
  /** Stable, so "seen" can be remembered. */
  id: string;
  title: string;
  detail: string;
  achievedAt: Date;
  workoutId: string | null;
  kind: 'count' | 'lift' | 'bodyweight' | 'volume' | 'streak' | 'anniversary';
}

const WORKOUTS = [1, 10, 25, 50, 100, 250, 500, 1000];
const SETS = [500, 1000, 2500, 5000, 10000];
const TONNES = [10, 100, 500, 1000];
const STREAK_WEEKS = [4, 12, 26, 52];

/** Plate milestones: 20 kg bar plus 20 kg plates each side. */
const PLATES: { key: string; name: string; kg: number; plates: string }[] = [
  { key: 'barbell-bench-press', name: 'Bench press', kg: 60, plates: 'a plate each side' },
  { key: 'barbell-bench-press', name: 'Bench press', kg: 100, plates: 'two plates each side' },
  { key: 'back-squat', name: 'Squat', kg: 100, plates: 'two plates each side' },
  { key: 'back-squat', name: 'Squat', kg: 140, plates: 'three plates each side' },
  { key: 'deadlift', name: 'Deadlift', kg: 140, plates: 'three plates each side' },
  { key: 'deadlift', name: 'Deadlift', kg: 180, plates: 'four plates each side' },
  { key: 'overhead-press', name: 'Overhead press', kg: 60, plates: 'a plate each side' },
];

/** Lifting your body weight or a multiple of it, for real (a completed set, not an estimate). */
const MULTIPLES: { key: string; name: string; times: number }[] = [
  { key: 'barbell-bench-press', name: 'Bench press', times: 1 },
  { key: 'back-squat', name: 'Squat', times: 1.5 },
  { key: 'deadlift', name: 'Deadlift', times: 2 },
];

const id = (key: string) => stableId(`exercise:${key}`);

function weightOn(entries: BodyWeightEntry[], date: Date): number | null {
  let best: BodyWeightEntry | null = null;
  for (const e of entries) {
    if (!isAlive(e)) continue;
    const at = new Date(e.measuredAt);
    if (at <= addDays(date, 1) && (!best || at > new Date(best.measuredAt))) best = e;
  }
  return best && date.getTime() - new Date(best.measuredAt).getTime() <= 30 * 86_400_000
    ? best.weightKg
    : null;
}

/**
 * Every milestone reached, in order, from the log alone: workout and set counts, plate
 * milestones and body-weight multiples on real sets, total tonnage, weekly streaks and the
 * one-year anniversary. Recomputed each time, so editing history updates them.
 */
export function milestones(
  sessions: Session[],
  bodyWeights: BodyWeightEntry[],
  now: Date,
  weekStartsOn: WeekStartsOn,
  /** Sessions a week that keep a streak going. */
  weeklyTarget: number | null,
): Milestone[] {
  const out: Milestone[] = [];
  let workouts = 0;
  let sets = 0;
  let tonnes = 0;
  const liftBest = new Map<string, number>();
  const done = new Set<string>();
  const add = (m: Milestone) => {
    if (done.has(m.id)) return;
    done.add(m.id);
    out.push(m);
  };

  for (const s of sessions) {
    if (s.date > now) break;
    workouts++;
    if (WORKOUTS.includes(workouts))
      add({
        id: `workouts-${workouts}`,
        kind: 'count',
        title: workouts === 1 ? 'Baseline set' : `${workouts} workouts`,
        detail:
          workouts === 1
            ? 'Every number from here is measured against today.'
            : `${workouts} workouts logged.`,
        achievedAt: s.date,
        workoutId: s.workout.id,
      });
    const before = sets;
    sets += s.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);
    for (const t of SETS)
      if (before < t && sets >= t)
        add({
          id: `sets-${t}`,
          kind: 'count',
          title: `${t.toLocaleString()} working sets`,
          detail: 'Every one of them logged.',
          achievedAt: s.date,
          workoutId: s.workout.id,
        });
    const tonnesBefore = tonnes;
    tonnes += sessionVolumeLoad(s) / 1000;
    for (const t of TONNES)
      if (tonnesBefore < t && tonnes >= t)
        add({
          id: `tonnes-${t}`,
          kind: 'volume',
          title: `${t.toLocaleString()} tonnes lifted`,
          detail: 'Load × reps over every working set you have logged.',
          achievedAt: s.date,
          workoutId: s.workout.id,
        });

    const bw = weightOn(bodyWeights, s.date);
    for (const { exercise, sets: logged, workoutExercise } of s.exercises) {
      const heaviest = Math.max(
        0,
        ...logged
          .filter((x) => isLoadEligible(x, exercise) && (x.reps ?? 0) >= 1)
          .map((x) => x.weightKg ?? 0),
      );
      if (heaviest <= 0) continue;
      const exId = workoutExercise.exerciseId;
      liftBest.set(exId, Math.max(liftBest.get(exId) ?? 0, heaviest));
      for (const p of PLATES)
        if (exId === id(p.key) && heaviest >= p.kg)
          add({
            id: `plates-${p.key}-${p.kg}`,
            kind: 'lift',
            title: `${p.kg} kg ${p.name.toLowerCase()}`,
            detail: `${p.name} with ${p.plates}.`,
            achievedAt: s.date,
            workoutId: s.workout.id,
          });
      if (bw)
        for (const m of MULTIPLES)
          if (exId === id(m.key) && heaviest >= bw * m.times)
            add({
              id: `bw-${m.key}-${m.times}`,
              kind: 'bodyweight',
              title:
                m.times === 1
                  ? `Body-weight ${m.name.toLowerCase()}`
                  : `${m.times}× body-weight ${m.name.toLowerCase()}`,
              detail:
                m.times === 1
                  ? `A ${m.name.toLowerCase()} set with your own body weight on the bar.`
                  : `A ${m.name.toLowerCase()} set with ${m.times} times your body weight.`,
              achievedAt: s.date,
              workoutId: s.workout.id,
            });
    }
  }

  // Weekly streaks: consecutive calendar weeks that met the target (or had a session).
  const need = Math.max(1, weeklyTarget ?? 1);
  const first = sessions[0];
  if (first) {
    let run = 0;
    for (
      let w = startOfWeek(first.date, weekStartsOn);
      addDays(w, 7) <= addDays(now, 1);
      w = addDays(w, 7)
    ) {
      const end = addDays(w, 7);
      const count = sessions.filter((s) => s.date >= w && s.date < end).length;
      run = count >= need ? run + 1 : 0;
      if (STREAK_WEEKS.includes(run))
        add({
          id: `streak-${run}`,
          kind: 'streak',
          title: `${run} weeks in a row`,
          detail:
            weeklyTarget && weeklyTarget > 1
              ? `${run} weeks with at least ${weeklyTarget} sessions.`
              : `Training every week for ${run} weeks.`,
          achievedAt: addDays(end, -1),
          workoutId: null,
        });
    }
    const year = new Date(first.date);
    year.setFullYear(year.getFullYear() + 1);
    if (year <= now)
      add({
        id: 'anniversary-1',
        kind: 'anniversary',
        title: 'One year of training',
        detail: `Your first workout here was a year ago.`,
        achievedAt: year,
        workoutId: null,
      });
  }
  return out.sort((a, b) => a.achievedAt.getTime() - b.achievedAt.getTime());
}
