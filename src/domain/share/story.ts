import { formatDayMonthFixed, shortDayName } from '@/lib/format/dates';
import { formatWeightValue, type WeightUnit } from '@/lib/units';
import { compareVolume, type PrCard, type StreakCard, type WorkoutCard } from './cards';

/**
 * What a story card says, in words and numbers, for every design (share cards 2.0, November
 * 2026). Pure: the drawing lives in features/share/story. Every number comes from the person's
 * own data; a field whose data is missing is left out rather than filled in.
 */

export type StoryKind = 'workout' | 'pr' | 'streak' | 'global' | 'group';

export interface StoryStat {
  /** The number as printed ("12,480", "1:48", "#7"). */
  v: string;
  /** Its unit, printed smaller ("kg", "min"); empty when none. */
  u: string;
  /** A short label ("Time", "Sets"). */
  l: string;
}

export type StoryExtra =
  | { type: 'lines'; items: { l: string; r: string }[] }
  | { type: 'bars'; items: { l: string; v: number; label: string }[] }
  | { type: 'grid'; items: (boolean | null)[] };

export interface StoryRing {
  /** 0 to 1. */
  frac: number;
  /** What the ring measures, printed in the legend. */
  stat: StoryStat;
}

export interface StoryContent {
  kind: StoryKind;
  title: string;
  sub: string;
  /** "Sat 7 Nov" or "Week of 3 Nov". */
  date: string;
  /** "07.11.26" or "3 to 9 Nov". */
  short: string;
  /** "6:42 pm", or empty. */
  time: string;
  big: StoryStat;
  note: string;
  stats: StoryStat[];
  more: StoryStat | null;
  chips: string[];
  ach: { h: string; s: string };
  /** The handwritten tag ("new pr!"). */
  hand: string;
  /** Medal colour for a top three rank, else the accent. */
  tier: 'gold' | 'silver' | 'bronze' | null;
  /** Three rings for the rings design: each a real measure out of a real whole. */
  rings: StoryRing[];
  /** What the rings are measured against, printed under them. */
  ringsNote: string;
  extra: StoryExtra;
  /** A rank card draws its big number larger. */
  rank: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const thousands = (v: number) => Math.round(v).toLocaleString('en-GB');
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export const dayLabel = (d: Date) => `${shortDayName(d.getDay())} ${formatDayMonthFixed(d)}`;
const shortDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getFullYear() % 100,
  ).padStart(2, '0')}`;

/** "6:42 pm" in the person's own clock. */
export function clockTime(d: Date): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** Seconds as "1:48". */
export const restText = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** A comparison label ("A city bus") as the end of a sentence ("More than a city bus"). */
const moreThan = (label: string) => `More than ${label.charAt(0).toLowerCase()}${label.slice(1)}`;

// ---------------------------------------------------------------------------------------------
// Workout
// ---------------------------------------------------------------------------------------------

export function workoutStory(
  w: WorkoutCard,
  opts: { unit: WeightUnit; streakWeeks?: number | null },
): StoryContent {
  const { unit } = opts;
  const lifted = w.volumeKg > 0;
  const volume = thousands(Number(formatWeightValue(w.volumeKg, unit, 0).replace(/,/g, '')));
  const comparison = lifted ? compareVolume(w.volumeKg) : null;
  const exercises = w.lines.length;
  const big: StoryStat = lifted
    ? { v: volume, u: unit, l: 'Total lifted' }
    : { v: String(w.workingSets), u: '', l: 'Working sets' };
  const note = comparison
    ? moreThan(comparison.beat.label)
    : `${exercises} ${plural(exercises, 'exercise')}`;
  const stats: StoryStat[] = [];
  if (w.minutes !== null) stats.push({ v: String(w.minutes), u: 'min', l: 'Time' });
  else stats.push({ v: String(exercises), u: '', l: 'Exercises' });
  stats.push({ v: String(w.workingSets), u: '', l: 'Sets' });
  stats.push({ v: String(w.records), u: '', l: 'Records' });
  const more: StoryStat | null =
    w.restSeconds !== null
      ? { v: restText(w.restSeconds), u: '', l: 'Avg rest' }
      : w.minutes !== null
        ? { v: String(exercises), u: '', l: 'Exercises' }
        : null;

  const chips: string[] = [];
  if (w.records > 0) chips.push(`${w.records} new ${plural(w.records, 'record')}`);
  chips.push(`${ordinal(w.number)} workout`);
  if (opts.streakWeeks && opts.streakWeeks >= 2) chips.push(`${opts.streakWeeks} week streak`);

  const names = w.lines.slice(0, 2).map((l) => l.name);
  const rings: StoryRing[] = [
    {
      frac: w.minutes !== null && w.bests.minutes ? w.minutes / w.bests.minutes : 0,
      stat: stats[0]!,
    },
    { frac: w.bests.workingSets ? w.workingSets / w.bests.workingSets : 0, stat: stats[1]! },
    lifted
      ? {
          frac: w.bests.volumeKg ? w.volumeKg / w.bests.volumeKg : 0,
          stat: { v: volume, u: unit, l: 'Lifted' },
        }
      : { frac: w.records > 0 ? 1 : 0, stat: stats[2]! },
  ].map((r) => ({ ...r, frac: clamp01(r.frac) }));

  return {
    kind: 'workout',
    title: w.title,
    sub: `Workout ${w.number}`,
    date: dayLabel(w.date),
    short: shortDate(w.date),
    time: clockTime(w.date),
    big,
    note,
    stats,
    more,
    chips,
    ach:
      w.records > 0
        ? { h: `${w.records} ${plural(w.records, 'record')} set`, s: names.join(', ') }
        : { h: `Workout ${w.number} done`, s: names.join(', ') },
    hand: w.records > 1 ? 'new prs!' : w.records === 1 ? 'new pr!' : 'done!',
    tier: null,
    rings,
    ringsNote: 'Against your best in 12 weeks',
    extra: {
      type: 'lines',
      items: w.lines.slice(0, 4).map((l) => ({ l: l.name, r: lineText(l, unit) })),
    },
    rank: false,
  };
}

function lineText(l: WorkoutCard['lines'][number], unit: WeightUnit): string {
  if (l.weightKg !== null && l.weightKg > 0 && l.reps !== null)
    return `${formatWeightValue(l.weightKg, unit)} ${unit} × ${l.reps}`;
  if (l.reps !== null) return `${l.reps} reps`;
  if (l.durationSec !== null) return restText(l.durationSec);
  if (l.distanceM !== null)
    return l.distanceM >= 1000 ? `${(l.distanceM / 1000).toFixed(2)} km` : `${l.distanceM} m`;
  return 'Done';
}

// ---------------------------------------------------------------------------------------------
// New record
// ---------------------------------------------------------------------------------------------

export function prStory(pr: PrCard, opts: { unit: WeightUnit }): StoryContent {
  const { unit } = opts;
  const w = (kg: number) => formatWeightValue(kg, unit);
  const isReps = pr.kind === 'reps';
  const big: StoryStat = isReps
    ? { v: String(pr.reps ?? 0), u: 'reps', l: 'Most reps' }
    : pr.kind === 'e1rm'
      ? { v: w(pr.e1rmKg ?? 0), u: unit, l: 'Estimated 1RM' }
      : { v: w(pr.weightKg ?? 0), u: unit, l: 'Heaviest set' };
  const gainText = isReps ? `+${pr.gain}` : `+${w(pr.gain)}`;
  const gainUnit = isReps ? 'reps' : unit;
  const note = isReps
    ? `${pr.gain} more ${plural(pr.gain, 'rep')} than your last best`
    : `${w(pr.gain)} ${unit} over your last best`;
  const stats: StoryStat[] = [];
  if (!isReps && pr.reps !== null) stats.push({ v: String(pr.reps), u: '', l: 'Reps' });
  if (isReps && pr.weightKg) stats.push({ v: w(pr.weightKg), u: unit, l: 'Weight' });
  stats.push({ v: gainText, u: gainUnit, l: 'Vs last best' });
  if (pr.e1rmKg !== null && pr.kind !== 'e1rm')
    stats.push({ v: w(pr.e1rmKg), u: unit, l: 'Est. 1RM' });
  else if (pr.weightKg !== null && pr.kind === 'e1rm')
    stats.push({ v: w(pr.weightKg), u: unit, l: 'Weight' });

  const first = pr.ladder[0];
  const last = pr.ladder[pr.ladder.length - 1];
  const totalGain = first && last ? last.value - first.value : 0;
  const since = first ? `${MONTHS[first.date.getMonth()]}` : '';
  const more: StoryStat | null =
    first && last && pr.ladder.length >= 2 && totalGain > 0
      ? {
          v: isReps ? `+${totalGain}` : `+${w(totalGain)}`,
          u: isReps ? 'reps' : unit,
          l: `Since ${since}`,
        }
      : null;

  const records = pr.ladder.filter((l) => !l.start).length;
  const chips = [`${ordinal(records)} ${pr.exerciseName.toLowerCase()} record`];
  if (more) chips.push(`Up ${more.v.slice(1)} ${more.u} since ${since}`);

  // Rings: this record, the one before, and the one before that, each out of this one.
  const values = pr.ladder.map((l) => l.value);
  const top = values[values.length - 1] || 1;
  const ringStat = (i: number, label: string): StoryRing | null => {
    const v = values[values.length - 1 - i];
    if (v === undefined) return null;
    return {
      frac: clamp01(v / top),
      stat: { v: isReps ? String(v) : w(v), u: isReps ? '' : unit, l: label },
    };
  };
  const rings = [ringStat(0, 'This record'), ringStat(1, 'Last best'), ringStat(2, 'Before that')]
    .filter((r): r is StoryRing => r !== null)
    .slice(0, 3);

  return {
    kind: 'pr',
    title: 'New record',
    sub: pr.exerciseName,
    date: dayLabel(pr.date),
    short: shortDate(pr.date),
    time: clockTime(pr.date),
    big,
    note,
    stats: stats.slice(0, 3),
    more,
    chips,
    ach: { h: 'New personal record', s: `${pr.exerciseName}, ${big.l.toLowerCase()}` },
    hand: 'new pr!',
    tier: null,
    rings,
    ringsNote: 'Each out of this record',
    extra: {
      type: 'bars',
      items: pr.ladder.map((l) => ({
        l: l.start ? 'Start' : formatDayMonthFixed(l.date),
        v: l.value,
        label: isReps ? `${l.value} reps` : `${w(l.value)} ${unit}`,
      })),
    },
    rank: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------------------------

export function streakStory(s: StreakCard, now: Date): StoryContent {
  const weeksTrained = (from: number) => {
    let n = 0;
    for (let wk = from; wk < 12; wk++) {
      if (s.grid.slice(wk * 7, wk * 7 + 7).some((d) => d === true)) n++;
    }
    return n;
  };
  const daysThisWeek = s.grid.slice(77).filter((d) => d === true).length;
  const perWeek = s.weeks > 0 ? s.workouts / s.weeks : 0;
  const stats: StoryStat[] = [
    { v: String(s.workouts), u: '', l: 'Workouts' },
    { v: String(s.records), u: '', l: 'Records' },
    { v: String(s.hours), u: 'h', l: 'Hours' },
  ];
  const since = formatDayMonthFixed(s.since);
  return {
    kind: 'streak',
    title: `${s.weeks} week streak`,
    sub: `Since ${since}`,
    date: dayLabel(now),
    short: shortDate(now),
    time: '',
    big: { v: String(s.weeks), u: plural(s.weeks, 'week'), l: 'In a row' },
    note: `At least one workout every week since ${since}`,
    stats,
    more: { v: perWeek.toFixed(1), u: '', l: 'Per week' },
    chips: [
      `${s.weeks} weeks in a row`,
      `${s.records} ${plural(s.records, 'record')}`,
      `${s.workouts} workouts`,
    ],
    ach: { h: 'Streak extended', s: `${s.weeks} weeks in a row` },
    hand: `${s.weeks} weeks!`,
    tier: null,
    rings: [
      { frac: weeksTrained(0) / 12, stat: { v: String(weeksTrained(0)), u: '/12', l: 'Weeks' } },
      { frac: weeksTrained(8) / 4, stat: { v: String(weeksTrained(8)), u: '/4', l: 'Last 4 weeks' } },
      { frac: daysThisWeek / 7, stat: { v: String(daysThisWeek), u: '/7', l: 'Days this week' } },
    ],
    ringsNote: 'Weeks and days you trained',
    extra: { type: 'grid', items: s.grid },
    rank: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Leaderboard ranks
// ---------------------------------------------------------------------------------------------

export interface RankCounts {
  score: number;
  workouts: number;
  hardSets: number;
  records: number;
  proteinDays: number;
}

export interface RankInput extends RankCounts {
  period: 'week' | 'month';
  /** ISO dates of the period. */
  startsOn: string;
  endsOn: string;
  rank: number;
  /** How many people are on the board. */
  total: number;
  /** The rank in the finished period before, only when that period is frozen. */
  previousRank: number | null;
}

/** Points per thing and the weekly caps, as the server scores them (migration 0019). */
const POINTS = { workout: 10, hardSet: 1, record: 5, proteinDay: 3 };
const WEEKLY = { workouts: 6, hardSets: 25, records: 5 };

const isoDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

export function periodLabels(period: 'week' | 'month', startsOn: string, endsOn: string) {
  const a = isoDay(startsOn);
  const b = isoDay(endsOn);
  if (period === 'month')
    return {
      date: `${LONG_MONTHS[a.getMonth()]} ${a.getFullYear()}`,
      short: `${LONG_MONTHS[a.getMonth()]}`,
      sub: 'This month',
    };
  const sameMonth = a.getMonth() === b.getMonth();
  return {
    date: `Week of ${formatDayMonthFixed(a)}`,
    short: sameMonth
      ? `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]}`
      : `${formatDayMonthFixed(a)} to ${formatDayMonthFixed(b)}`,
    sub: 'This week',
  };
}

const tierFor = (rank: number): StoryContent['tier'] =>
  rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;

/** "Top 10", "Top 25%", or null when neither is true or helpful. */
export function topLabel(rank: number, total: number): string | null {
  if (rank <= 10) return 'Top 10';
  if (total >= 20) {
    for (const p of [1, 5, 10, 25]) if (rank <= Math.ceil((total * p) / 100)) return `Top ${p}%`;
  }
  return null;
}

/** "Up 3 places", "Down 1 place", "Same place", or null with no frozen period before. */
export function movement(rank: number, previous: number | null): string | null {
  if (previous === null) return null;
  const d = previous - rank;
  if (d === 0) return 'Same place';
  return `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} ${plural(Math.abs(d), 'place')}`;
}

function rankCommon(r: RankInput) {
  const labels = periodLabels(r.period, r.startsOn, r.endsOn);
  const weeks =
    r.period === 'week'
      ? 1
      : Math.max(1, (isoDay(r.endsOn).getTime() - isoDay(r.startsOn).getTime()) / 6048e5 + 1 / 7);
  const parts = [
    { l: 'Workouts', n: r.workouts, p: POINTS.workout },
    { l: 'Hard sets', n: r.hardSets, p: POINTS.hardSet },
    { l: 'Records', n: r.records, p: POINTS.record },
    { l: 'Protein days', n: r.proteinDays, p: POINTS.proteinDay },
  ];
  const lastWord = r.period === 'week' ? 'week' : 'month';
  const move = movement(r.rank, r.previousRank);
  const top = topLabel(r.rank, r.total);
  const rings: StoryRing[] = [
    {
      frac: clamp01(r.workouts / (WEEKLY.workouts * weeks)),
      stat: { v: String(r.workouts), u: '', l: 'Workouts' },
    },
    {
      frac: clamp01(r.hardSets / (WEEKLY.hardSets * weeks)),
      stat: { v: String(r.hardSets), u: '', l: 'Hard sets' },
    },
    {
      frac: clamp01(r.records / (WEEKLY.records * weeks)),
      stat: { v: String(r.records), u: '', l: 'Records' },
    },
  ];
  return {
    labels,
    move: move ? `${move} since last ${lastWord}` : null,
    moveShort: move,
    top,
    rings,
    extra: {
      type: 'lines' as const,
      items: parts.map((p) => ({ l: p.l, r: `${p.n} × ${p.p} = ${p.n * p.p}` })),
    },
  };
}

export function globalRankStory(r: RankInput): StoryContent {
  const c = rankCommon(r);
  const tier = tierFor(r.rank);
  const note = c.move ?? `Out of ${thousands(r.total)} people`;
  const chips = [c.top, c.moveShort, `${r.score} points`].filter((x): x is string => !!x);
  const head = tier
    ? `${ordinal(r.rank)} on Macrotrophy`
    : c.top
      ? `${c.top} this ${r.period}`
      : `${ordinal(r.rank)} this ${r.period}`;
  return {
    kind: 'global',
    title: 'Leaderboard',
    sub: c.labels.sub,
    date: c.labels.date,
    short: c.labels.short,
    time: '',
    big: { v: `#${r.rank}`, u: '', l: 'Global rank' },
    note,
    stats: [
      { v: String(r.score), u: 'pts', l: 'Points' },
      { v: String(r.workouts), u: '', l: 'Workouts' },
      { v: String(r.records), u: '', l: 'Records' },
    ],
    more: { v: String(r.hardSets), u: '', l: 'Hard sets' },
    chips,
    ach: { h: head, s: 'Global leaderboard' },
    hand: tier ? `${ordinal(r.rank)}!` : c.top ? `${c.top.toLowerCase()}!` : `#${r.rank}!`,
    tier,
    rings: c.rings,
    ringsNote: `Against the most that scores in a ${r.period}`,
    extra: c.extra,
    rank: true,
  };
}

export function groupRankStory(
  r: RankInput & { groupName: string; members: number; leaderScore: number | null },
): StoryContent {
  const c = rankCommon(r);
  const tier = tierFor(r.rank);
  const behind =
    r.rank > 1 && r.leaderScore !== null && r.leaderScore > r.score
      ? `${r.leaderScore - r.score} ${plural(r.leaderScore - r.score, 'point')} behind 1st`
      : null;
  const note =
    r.rank === 1 ? `Top of ${r.groupName}` : (behind ?? c.move ?? `Out of ${r.members} members`);
  const chips = [`${ordinal(r.rank)} place`, c.moveShort, `${r.score} points`].filter(
    (x): x is string => !!x,
  );
  return {
    kind: 'group',
    title: r.groupName,
    sub: c.labels.sub,
    date: c.labels.date,
    short: c.labels.short,
    time: '',
    big: { v: `#${r.rank}`, u: '', l: 'Rank in group' },
    note,
    stats: [
      { v: String(r.score), u: 'pts', l: 'Points' },
      { v: String(r.members), u: '', l: 'Members' },
      { v: String(r.workouts), u: '', l: 'Workouts' },
    ],
    more: { v: String(r.records), u: '', l: 'Records' },
    chips,
    ach: {
      h: `${ordinal(r.rank)} in ${r.groupName}`,
      s: r.period === 'week' ? 'Weekly leaderboard' : 'Monthly leaderboard',
    },
    hand: r.rank === 1 ? 'number 1!' : `${ordinal(r.rank)} place!`,
    tier,
    rings: c.rings,
    ringsNote: `Against the most that scores in a ${r.period}`,
    extra: c.extra,
    rank: true,
  };
}
