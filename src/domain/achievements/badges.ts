import { addDays, startOfWeek, type WeekStartsOn } from '@/lib/dates';
import { stableId } from '@/lib/ids';
import { detectPersonalRecords } from '../analytics/prs';
import { isAlive, isLoadEligible, type Session } from '../analytics/sessions';
import { sessionVolumeLoad } from '../analytics/volume';
import type { BodyWeightEntry, Exercise } from '../models/schemas';

/**
 * Badges: achievements earned from the log alone, recomputed every time (editing history
 * updates them). Each has a target, so a locked badge shows how close it is. Nothing here is
 * estimated: counts, real sets and the weights actually on the bar.
 */

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'legend';

export type BadgeIcon =
  | 'dumbbell'
  | 'flame'
  | 'medal'
  | 'weight'
  | 'plate'
  | 'body'
  | 'sunrise'
  | 'moon'
  | 'calendar'
  | 'bolt';

export type BadgeGroup = 'workouts' | 'streaks' | 'medals' | 'tonnage' | 'plates' | 'habits';

export interface Badge {
  id: string;
  group: BadgeGroup;
  title: string;
  /** What it takes, in plain words. */
  goal: string;
  icon: BadgeIcon;
  tier: BadgeTier;
  target: number;
  /** Progress towards the target, capped at the target. */
  current: number;
  earnedAt: Date | null;
  /** The workout it was earned in, when there is one. */
  workoutId: string | null;
}

export const GROUP_LABELS: Record<BadgeGroup, string> = {
  workouts: 'Workouts',
  streaks: 'Streaks',
  medals: 'Medals',
  tonnage: 'Total lifted',
  plates: 'Plate club',
  habits: 'Habits',
};

const tierFor = (index: number, count: number): BadgeTier =>
  index === count - 1 && count >= 4
    ? 'legend'
    : index >= count * 0.6
      ? 'gold'
      : index >= count * 0.3
        ? 'silver'
        : 'bronze';

const WORKOUTS: [number, string][] = [
  [1, 'Day one'],
  [10, 'Locked in'],
  [25, 'Habit unlocked'],
  [50, 'Gym rat'],
  [100, 'Century club'],
  [250, 'No days off'],
  [500, 'Built different'],
  [1000, 'Living legend'],
];
const STREAKS: [number, string][] = [
  [2, 'Back to back'],
  [4, 'Month strong'],
  [8, 'Two months deep'],
  [12, 'Quarter grind'],
  [26, 'Half-year hero'],
  [52, 'Year of gains'],
];
const MEDALS: [number, string][] = [
  [1, 'First medal'],
  [10, 'Medal collector'],
  [50, 'PR machine'],
  [100, 'Record breaker'],
  [250, 'Hall of fame'],
];
/** Tonnes, with something that weighs about as much. */
const TONNES: [number, string, string][] = [
  [10, '10 tonne club', 'about seven cars'],
  [100, '100 tonne club', 'a blue whale'],
  [500, '500 tonne club', 'a jumbo jet, loaded'],
  [1000, 'Kilotonne', 'about 160 elephants'],
];
/** 20 kg bar plus 20 kg plates each side. */
const PLATES: { key: string; lift: string; kg: number; title: string }[] = [
  { key: 'barbell-bench-press', lift: 'bench press', kg: 60, title: 'One plate bench' },
  { key: 'barbell-bench-press', lift: 'bench press', kg: 100, title: 'Two plate bench' },
  { key: 'back-squat', lift: 'squat', kg: 100, title: 'Two plate squat' },
  { key: 'back-squat', lift: 'squat', kg: 140, title: 'Three plate squat' },
  { key: 'deadlift', lift: 'deadlift', kg: 140, title: 'Three plate deadlift' },
  { key: 'deadlift', lift: 'deadlift', kg: 180, title: 'Four plate deadlift' },
  { key: 'overhead-press', lift: 'overhead press', kg: 60, title: 'One plate press' },
];
const MULTIPLES: { key: string; lift: string; times: number; title: string }[] = [
  { key: 'barbell-bench-press', lift: 'bench press', times: 1, title: 'Bodyweight bench' },
  { key: 'back-squat', lift: 'squat', times: 1.5, title: '1.5× bodyweight squat' },
  { key: 'deadlift', lift: 'deadlift', times: 2, title: 'Double bodyweight deadlift' },
];

const exId = (key: string) => stableId(`exercise:${key}`);

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

export function computeBadges(input: {
  sessions: Session[];
  exercises: Exercise[];
  bodyWeights: BodyWeightEntry[];
  now: Date;
  weekStartsOn: WeekStartsOn;
}): Badge[] {
  const { now, weekStartsOn } = input;
  const sessions = input.sessions.filter((s) => s.date <= now);
  const out: Badge[] = [];

  // Workouts, in order.
  WORKOUTS.forEach(([n, title], i) => {
    const at = sessions[n - 1];
    out.push({
      id: `workouts-${n}`,
      group: 'workouts',
      title,
      goal: n === 1 ? 'Log your first workout' : `Log ${n} workouts`,
      icon: 'dumbbell',
      tier: tierFor(i, WORKOUTS.length),
      target: n,
      current: Math.min(n, sessions.length),
      earnedAt: at?.date ?? null,
      workoutId: at?.workout.id ?? null,
    });
  });

  // Weeks in a row with at least one workout; the best run ever, and when each length was hit.
  const weekOf = (d: Date) => startOfWeek(d, weekStartsOn).getTime();
  const weeks = [...new Set(sessions.map((s) => weekOf(s.date)))].sort((a, b) => a - b);
  const reachedAt = new Map<number, { date: Date; workoutId: string }>();
  let run = 0;
  let best = 0;
  weeks.forEach((w, i) => {
    run = i > 0 && w - weeks[i - 1]! <= 8 * 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    if (!reachedAt.has(run)) {
      const first = sessions.find((s) => weekOf(s.date) === w)!;
      reachedAt.set(run, { date: first.date, workoutId: first.workout.id });
    }
  });
  STREAKS.forEach(([n, title], i) => {
    const hit = reachedAt.get(n);
    out.push({
      id: `streak-${n}`,
      group: 'streaks',
      title,
      goal: `Train ${n} weeks in a row`,
      icon: 'flame',
      tier: tierFor(i, STREAKS.length),
      target: n,
      current: Math.min(n, best),
      earnedAt: hit?.date ?? null,
      workoutId: hit?.workoutId ?? null,
    });
  });

  // Medals: personal records, in order.
  const records = detectPersonalRecords(sessions, input.exercises).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  MEDALS.forEach(([n, title], i) => {
    const r = records[n - 1];
    out.push({
      id: `medals-${n}`,
      group: 'medals',
      title,
      goal: n === 1 ? 'Win your first medal' : `Win ${n} medals`,
      icon: 'medal',
      tier: tierFor(i, MEDALS.length),
      target: n,
      current: Math.min(n, records.length),
      earnedAt: r?.date ?? null,
      workoutId: r?.workoutId ?? null,
    });
  });

  // Total lifted.
  let kg = 0;
  const crossed = new Map<number, Session>();
  for (const s of sessions) {
    const before = kg;
    kg += sessionVolumeLoad(s);
    for (const [t] of TONNES) if (before < t * 1000 && kg >= t * 1000) crossed.set(t, s);
  }
  TONNES.forEach(([t, title, like], i) => {
    const s = crossed.get(t);
    out.push({
      id: `tonnes-${t}`,
      group: 'tonnage',
      title,
      goal: `Lift ${t.toLocaleString('en-GB')} tonnes in total, ${like}`,
      icon: 'weight',
      tier: tierFor(i, TONNES.length),
      target: t,
      current: Math.min(t, Math.floor(kg / 1000)),
      earnedAt: s?.date ?? null,
      workoutId: s?.workout.id ?? null,
    });
  });

  // Plate club and body-weight lifts: real completed sets only.
  const heaviest = new Map<string, number>();
  const plateHit = new Map<string, Session>();
  const multipleHit = new Map<string, Session>();
  for (const s of sessions) {
    const bw = weightOn(input.bodyWeights, s.date);
    for (const { exercise, sets, workoutExercise } of s.exercises) {
      const top = Math.max(
        0,
        ...sets
          .filter((x) => isLoadEligible(x, exercise) && (x.reps ?? 0) >= 1)
          .map((x) => x.weightKg ?? 0),
      );
      if (top <= 0) continue;
      const id = workoutExercise.exerciseId;
      heaviest.set(id, Math.max(heaviest.get(id) ?? 0, top));
      for (const p of PLATES) {
        const key = `${p.key}-${p.kg}`;
        if (id === exId(p.key) && top >= p.kg && !plateHit.has(key)) plateHit.set(key, s);
      }
      if (bw)
        for (const m of MULTIPLES) {
          const key = `${m.key}-${m.times}`;
          if (id === exId(m.key) && top >= bw * m.times && !multipleHit.has(key))
            multipleHit.set(key, s);
        }
    }
  }
  PLATES.forEach((p) => {
    const s = plateHit.get(`${p.key}-${p.kg}`);
    out.push({
      id: `plates-${p.key}-${p.kg}`,
      group: 'plates',
      title: p.title,
      goal: `${p.kg} kg on the ${p.lift} for a rep`,
      icon: 'plate',
      tier: p.kg >= 140 || (p.key === 'barbell-bench-press' && p.kg >= 100) ? 'gold' : 'silver',
      target: p.kg,
      current: Math.min(p.kg, heaviest.get(exId(p.key)) ?? 0),
      earnedAt: s?.date ?? null,
      workoutId: s?.workout.id ?? null,
    });
  });
  MULTIPLES.forEach((m) => {
    const s = multipleHit.get(`${m.key}-${m.times}`);
    out.push({
      id: `bw-${m.key}-${m.times}`,
      group: 'plates',
      title: m.title,
      goal: `A ${m.lift} with ${m.times === 1 ? 'your' : `${m.times}×`} body weight on the bar`,
      icon: 'body',
      tier: 'gold',
      target: 1,
      current: s ? 1 : 0,
      earnedAt: s?.date ?? null,
      workoutId: s?.workout.id ?? null,
    });
  });

  // Habits: when you train.
  const habit = (
    id: string,
    title: string,
    goal: string,
    icon: BadgeIcon,
    target: number,
    test: (s: Session) => boolean,
  ) => {
    const matching = sessions.filter(test);
    const at = matching[target - 1];
    out.push({
      id,
      group: 'habits',
      title,
      goal,
      icon,
      tier: 'silver',
      target,
      current: Math.min(target, matching.length),
      earnedAt: at?.date ?? null,
      workoutId: at?.workout.id ?? null,
    });
  };
  habit(
    'early-bird',
    'Early bird',
    'Start 10 workouts before 7 am',
    'sunrise',
    10,
    (s) => s.date.getHours() < 7,
  );
  habit(
    'night-owl',
    'Night owl',
    'Start 10 workouts after 9 pm',
    'moon',
    10,
    (s) => s.date.getHours() >= 21,
  );
  habit(
    'weekend-warrior',
    'Weekend warrior',
    'Train on 10 weekends',
    'calendar',
    10,
    (s) => s.date.getDay() === 0 || s.date.getDay() === 6,
  );
  habit(
    'heavy-day',
    'Heavy day',
    'Lift 10,000 kg in one workout',
    'bolt',
    1,
    (s) => sessionVolumeLoad(s) >= 10_000,
  );

  return out;
}

/** Badges earned in one workout, for its summary and its story card. */
export function badgesEarnedIn(badges: Badge[], workoutId: string): Badge[] {
  return badges.filter((b) => b.earnedAt && b.workoutId === workoutId);
}

/** What the medallion shows: a big number and a short word under it. */
export function badgeStamp(b: Badge): { big: string; small: string } {
  const group = b.id.split('-')[0];
  if (b.group === 'workouts')
    return { big: String(b.target), small: b.target === 1 ? 'workout' : 'workouts' };
  if (b.group === 'streaks') return { big: String(b.target), small: 'weeks' };
  if (b.group === 'medals')
    return { big: String(b.target), small: b.target === 1 ? 'medal' : 'medals' };
  if (b.group === 'tonnage')
    return { big: b.target >= 1000 ? '1k' : String(b.target), small: 'tonnes' };
  if (group === 'plates') return { big: String(b.target), small: 'kg' };
  if (group === 'bw') {
    const times = b.id.split('-').pop()!;
    return { big: `${times}×`, small: 'bodyweight' };
  }
  if (b.id === 'early-bird') return { big: '6am', small: 'club' };
  if (b.id === 'night-owl') return { big: '9pm', small: 'club' };
  if (b.id === 'weekend-warrior') return { big: '10', small: 'weekends' };
  if (b.id === 'heavy-day') return { big: '10k', small: 'kg day' };
  return { big: String(b.target), small: '' };
}
