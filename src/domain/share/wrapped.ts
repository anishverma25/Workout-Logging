import { isHardSet } from '../analytics/muscles';
import { detectPersonalRecords } from '../analytics/prs';
import { buildSessions, isWorkingSet, type TrainingData } from '../analytics/sessions';
import { muscleName } from '../analytics/weekly';
import { setVolumeLoad } from '../analytics/volume';
import { workoutMinutes } from '../activity/burn';
import type { StoryContent } from './story';

/**
 * Macrotrophy Wrapped: a month (or a year) of the person's own training in a few numbers, drawn
 * as a story card. Everything is counted from their logs; a period with too little in it has
 * no recap.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December',
];

export const WRAPPED_MIN_WORKOUTS = 3;

export interface Wrapped {
  /** "October" or "2026". */
  label: string;
  period: 'month' | 'year';
  /** yyyy-mm for a month, yyyy for a year: what "seen" is remembered by. */
  key: string;
  workouts: number;
  daysTrained: number;
  daysInPeriod: number;
  weeksTrained: number;
  weeksInPeriod: number;
  hours: number;
  /** Total load moved, kg. */
  tonnage: number;
  hardSets: number;
  records: number;
  /** The exercise with the most working sets. */
  topExercise: { name: string; sets: number } | null;
  /** Muscles by hard sets, most first. */
  muscles: { muscle: string; sets: number }[];
}

const thousands = (v: number) => Math.round(v).toLocaleString('en-GB');

export function wrapped(
  data: TrainingData,
  period: { year: number; month: number | null },
): Wrapped | null {
  const from = new Date(period.year, period.month ?? 0, 1);
  const to = period.month === null ? new Date(period.year + 1, 0, 1) : new Date(period.year, period.month + 1, 1);
  const all = buildSessions(data);
  const sessions = all.filter((s) => s.date >= from && s.date < to);
  if (sessions.length < WRAPPED_MIN_WORKOUTS) return null;
  const days = new Set(sessions.map((s) => s.date.toDateString()));
  const weeks = new Set(sessions.map((s) => Math.floor((s.date.getTime() - from.getTime()) / (7 * 86_400_000))));
  let tonnage = 0;
  let hardSets = 0;
  let minutes = 0;
  const byExercise = new Map<string, { name: string; sets: number }>();
  const byMuscle = new Map<string, number>();
  for (const s of sessions) {
    minutes += Math.max(0, Math.min(300, workoutMinutes(s.workout)));
    for (const ex of s.exercises) {
      const working = ex.sets.filter(isWorkingSet);
      if (working.length === 0) continue;
      const cur = byExercise.get(ex.workoutExercise.exerciseId) ?? { name: ex.workoutExercise.exerciseName, sets: 0 };
      cur.sets += working.length;
      byExercise.set(ex.workoutExercise.exerciseId, cur);
      const hard = working.filter(isHardSet).length;
      hardSets += hard;
      if (ex.exercise && ex.exercise.primaryMuscle !== 'cardio')
        byMuscle.set(ex.exercise.primaryMuscle, (byMuscle.get(ex.exercise.primaryMuscle) ?? 0) + hard);
      for (const set of working) tonnage += setVolumeLoad(set, ex.exercise);
    }
  }
  const ids = new Set(sessions.map((s) => s.workout.id));
  const records = detectPersonalRecords(all, data.exercises).filter((p) => ids.has(p.workoutId)).length;
  const daysInPeriod = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return {
    label: period.month === null ? String(period.year) : MONTHS[period.month]!,
    period: period.month === null ? 'year' : 'month',
    key: period.month === null ? String(period.year) : `${period.year}-${String(period.month + 1).padStart(2, '0')}`,
    workouts: sessions.length,
    daysTrained: days.size,
    daysInPeriod,
    weeksTrained: weeks.size,
    weeksInPeriod: Math.ceil(daysInPeriod / 7),
    hours: Math.round(minutes / 6) / 10,
    tonnage: Math.round(tonnage),
    hardSets,
    records,
    topExercise: [...byExercise.values()].sort((a, b) => b.sets - a.sets)[0] ?? null,
    muscles: [...byMuscle.entries()]
      .map(([muscle, sets]) => ({ muscle, sets }))
      .filter((m) => m.sets > 0)
      .sort((a, b) => b.sets - a.sets),
  };
}

/** The recap to offer on a date: last month in the first days of a month, the year around its end. */
export function wrappedDue(now: Date): { month: { year: number; month: number }; year: number | null } {
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const m = now.getMonth();
  const d = now.getDate();
  const year = m === 11 && d >= 20 ? now.getFullYear() : m === 0 && d <= 7 ? now.getFullYear() - 1 : null;
  return { month: { year: last.getFullYear(), month: last.getMonth() }, year };
}

export function wrappedStory(w: Wrapped, now: Date): StoryContent {
  const top = w.muscles.slice(0, 4);
  const max = Math.max(1, ...top.map((m) => m.sets));
  const short = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(2)}`;
  return {
    kind: 'wrapped',
    title: `${w.label}, wrapped`,
    sub: w.period === 'year' ? 'Your year in the gym' : 'Your month in the gym',
    date: w.label,
    short,
    time: '',
    big: { v: String(w.workouts), u: 'workouts', l: `In ${w.label}` },
    note: `${thousands(w.tonnage)} kg lifted over ${w.daysTrained} days`,
    stats: [
      { v: thousands(w.tonnage), u: 'kg', l: 'Lifted' },
      { v: String(w.hours), u: 'h', l: 'Trained' },
      { v: String(w.records), u: '', l: 'Records' },
    ],
    more: w.topExercise ? { v: String(w.topExercise.sets), u: 'sets', l: w.topExercise.name } : null,
    chips: [
      `${w.workouts} workouts`,
      `${thousands(w.tonnage)} kg lifted`,
      `${w.records} ${w.records === 1 ? 'record' : 'records'}`,
    ],
    ach: { h: `${w.label}, wrapped`, s: `${thousands(w.tonnage)} kg lifted` },
    hand: 'wrapped!',
    tier: null,
    rings: [
      { frac: w.daysTrained / w.daysInPeriod, stat: { v: String(w.daysTrained), u: `/${w.daysInPeriod}`, l: 'Days trained' } },
      { frac: w.weeksTrained / w.weeksInPeriod, stat: { v: String(w.weeksTrained), u: `/${w.weeksInPeriod}`, l: 'Weeks trained' } },
      { frac: w.workouts ? w.records / w.workouts : 0, stat: { v: String(w.records), u: `/${w.workouts}`, l: 'Records per workout' } },
    ],
    ringsNote: `Out of the days and weeks of ${w.label}`,
    extra: { type: 'bars', items: top.map((m) => ({ l: muscleName(m.muscle), v: m.sets / max, label: `${m.sets} sets` })) },
    rank: false,
  };
}
