import type { Exercise } from '../models/schemas';
import { performanceByExercise } from './performance';
import { detectPersonalRecords } from './prs';
import { sessionDurationMinutes, sessionsBetween, workingSetCount, type Session } from './sessions';
import { sessionVolumeLoad } from './volume';

export interface Recap {
  kind: 'month' | 'year';
  start: Date;
  end: Date;
  workouts: number;
  workingSets: number;
  volumeKg: number;
  minutes: number;
  /** Distinct days with a workout. */
  days: number;
  records: number;
  /** The lift whose best e1RM rose the most, against everything before the period. */
  topLift: { exerciseId: string; name: string; fromKg: number; toKg: number } | null;
  /** Most-trained exercise by working sets. */
  favourite: { name: string; sets: number } | null;
}

function build(
  kind: Recap['kind'],
  start: Date,
  end: Date,
  sessions: Session[],
  exercises: Exercise[],
): Recap | null {
  const inside = sessionsBetween(sessions, start, end);
  if (inside.length === 0) return null;
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const before = new Map<string, number>();
  for (const [id, list] of performanceByExercise(sessions.filter((s) => s.date < start)))
    for (const p of list) if (p.bestE1rm) before.set(id, Math.max(before.get(id) ?? 0, p.bestE1rm));
  let topLift: Recap['topLift'] = null;
  for (const [id, list] of performanceByExercise(inside)) {
    const best = Math.max(0, ...list.map((p) => p.bestE1rm ?? 0));
    const prior = before.get(id);
    if (!prior || best <= prior) continue;
    if (!topLift || best - prior > topLift.toKg - topLift.fromKg)
      topLift = { exerciseId: id, name: names.get(id) ?? 'Exercise', fromKg: prior, toKg: best };
  }
  const setsBy = new Map<string, number>();
  for (const s of inside)
    for (const e of s.exercises) {
      const n = e.sets.filter((x) => x.completedAt && x.setType !== 'warmup').length;
      setsBy.set(
        e.workoutExercise.exerciseName,
        (setsBy.get(e.workoutExercise.exerciseName) ?? 0) + n,
      );
    }
  const fav = [...setsBy.entries()].sort((a, b) => b[1] - a[1])[0];
  const upToEnd = sessions.filter((s) => s.date < end);
  return {
    kind,
    start,
    end,
    workouts: inside.length,
    workingSets: inside.reduce((n, s) => n + workingSetCount(s), 0),
    volumeKg: inside.reduce((n, s) => n + sessionVolumeLoad(s), 0),
    minutes: Math.round(inside.reduce((n, s) => n + (sessionDurationMinutes(s) ?? 0), 0)),
    days: new Set(inside.map((s) => s.date.toDateString())).size,
    records: detectPersonalRecords(upToEnd, exercises).filter((r) => r.date >= start).length,
    topLift,
    favourite: fav && fav[1] > 0 ? { name: fav[0], sets: fav[1] } : null,
  };
}

/** The last full calendar month before `now`. */
export function monthRecap(sessions: Session[], exercises: Exercise[], now: Date): Recap | null {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return build('month', start, end, sessions, exercises);
}

/**
 * The last full calendar year, from 1 January. Shown in the new year, or for the current year
 * from December onward so it can be shared before the year ends.
 */
export function yearRecap(sessions: Session[], exercises: Exercise[], now: Date): Recap | null {
  const year = now.getMonth() === 11 ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(year, 0, 1);
  const end = now.getMonth() === 11 ? now : new Date(year + 1, 0, 1);
  return build('year', start, end, sessions, exercises);
}
