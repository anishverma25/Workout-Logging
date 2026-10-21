import type { WeeklyCheckin } from '@/domain/analytics/checkin';
import { buildSessions, isWorkingSet, type TrainingData } from '@/domain/analytics/sessions';
import { activeRoutine } from '@/domain/analytics/schedule';
import type { ProgressModel } from '@/domain/analytics/progress';
import { formatRecordValue, PR_LABELS } from '@/domain/analytics/prs';
import { formatRest } from '@/domain/analytics/rest';
import type { TargetInsight } from '@/domain/analytics/targets';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import type { Profile } from '@/domain/models/schemas';
import type { NutritionSummary, RealMaintenance } from '@/domain/nutrition/analysis';
import type { DailyTargets } from '@/domain/nutrition/targets';
import type { DietType, Nutrients } from '@/domain/nutrition/types';
import { formatWeightValue, type WeightUnit } from '@/lib/units';
import type { CoachTopic } from '@/app/coach';
import { stallCopy } from '../progress/stallCopy';

/**
 * The training brief: what the coach is told, as short plain lines of numbers the app has
 * already calculated. The AI explains these; it calculates nothing itself.
 *
 * Never included: name, email, account id, notes, photos. Only what the topic needs, so a
 * question stays small (and inside the AI providers' free limits).
 */

export interface BriefInput {
  unit: WeightUnit;
  /** All training, for the recent workouts list in the chat and the check-in. */
  data?: TrainingData | null;
  now: Date;
  profile: Profile | null;
  model: ProgressModel | null;
  checkin?: WeeklyCheckin | null;
  targets?: {
    kcal: number | null;
    proteinG: number | null;
    calculatedKcal: number | null;
    bodyWeightKg: number | null;
    insights: TargetInsight[];
  } | null;
  /** What the food log says, when the person logs food. */
  nutrition?: {
    summary: NutritionSummary;
    today: Nutrients;
    maintenance: RealMaintenance | null;
    targets: DailyTargets;
    diet: DietType | null;
  } | null;
}

const MAX_LINES = 12;

const day = (d: Date) => d.toISOString().slice(0, 10);
const words = (v: string) => v.replace(/_/g, ' ');
const round1 = (v: number) => Math.round(v * 10) / 10;
const pct = (v: number) => `${Math.round(v * 100)}%`;

function weight(kg: number, unit: WeightUnit) {
  return `${formatWeightValue(kg, unit)} ${unit}`;
}

function ageFrom(birthDate: string | null | undefined, now: Date): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

function latestBodyWeight(model: ProgressModel | null): { kg: number; average: boolean } | null {
  const points = model?.body.points ?? [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!;
    if (p.averageKg !== null) return { kg: p.averageKg, average: true };
  }
  return points.length ? { kg: points[points.length - 1]!.kg, average: false } : null;
}

function personLines({ profile, model, unit, now, targets }: BriefInput): string[] {
  const parts: string[] = [];
  if (profile) {
    parts.push(`goal ${words(profile.goal)}`, `experience ${words(profile.experience)}`);
    if (profile.sex) parts.push(words(profile.sex));
    const age = ageFrom(profile.birthDate, now);
    if (age) parts.push(`age ${age}`);
    if (profile.heightCm) parts.push(`height ${profile.heightCm} cm`);
    if (profile.trainingDays) parts.push(`plans ${profile.trainingDays} training days a week`);
    if (profile.sessionMinutes) parts.push(`sessions of about ${profile.sessionMinutes} min`);
    if (profile.equipment) parts.push(`trains at ${words(profile.equipment)}`);
  }
  const bw =
    latestBodyWeight(model) ??
    (targets?.bodyWeightKg ? { kg: targets.bodyWeightKg, average: false } : null);
  if (bw) parts.push(`body weight ${weight(bw.kg, unit)}${bw.average ? ' (7-day average)' : ''}`);
  return [
    `Today: ${day(now)}. Weights in ${unit}.`,
    parts.length ? `Person: ${parts.join(', ')}.` : 'Person: no profile details yet.',
  ];
}

function windowLines(m: ProgressModel): string[] {
  const c = m.consistency;
  const lines = [
    `Period: last ${m.window.days} days (${day(m.window.start)} to ${day(new Date(m.window.end.getTime() - 1))}). Workouts: ${m.sessionsInWindow}${c.perWeek !== null ? `, ${round1(c.perWeek)} a week` : ''}.`,
  ];
  if (c.adherence.rate !== null)
    lines.push(
      `Planned routine sessions done: ${c.adherence.completed} of ${c.adherence.planned} (${pct(c.adherence.rate)}).`,
    );
  return lines;
}

function section(title: string, lines: string[], empty: string): string[] {
  if (lines.length === 0) return [`${title}: ${empty}`];
  const shown = lines.slice(0, MAX_LINES);
  const more = lines.length - shown.length;
  return [`${title}:`, ...shown.map((l) => `- ${l}`), ...(more > 0 ? [`- and ${more} more`] : [])];
}

const exerciseNames = (m: ProgressModel) => {
  const names = new Map<string, string>();
  for (const o of m.exerciseOptions) names.set(o.id, o.name);
  for (const v of m.volume.byExercise) names.set(v.id, v.name);
  for (const l of m.strength.levels) names.set(l.exerciseId, l.name);
  if (m.selected) names.set(m.selected.exerciseId, m.selected.name);
  return names;
};

// ---------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------

function insights(m: ProgressModel) {
  return section(
    'Insights the app found',
    m.insights.map((i) => `${i.title.replace(/[.\s]+$/, '')}. Based on: ${i.basis}`),
    'none this period.',
  );
}

function progression(m: ProgressModel, unit: WeightUnit) {
  return section(
    'Lifts ready to progress (hit the top of the rep range at the right effort)',
    m.progression.map(
      (s) =>
        `${s.exerciseName} on ${day(s.date)}: ${s.sets
          .map(
            (x) =>
              `${weight(x.weightKg, unit)} x ${x.reps}${x.rir !== null ? ` at RIR ${x.rir}` : ''}`,
          )
          .join(', ')}${s.effort === 'unknown' ? ' (effort not logged)' : ''}`,
    ),
    'none right now.',
  );
}

function selectedLift(m: ProgressModel, unit: WeightUnit) {
  const s = m.selected;
  if (!s) return ['Selected lift: none chosen on the Progress page.'];
  const lines = s.points
    .slice(-8)
    .map(
      (p) =>
        `${day(p.date)}: ${p.bestE1rm !== null ? `e1RM ${weight(p.bestE1rm, unit)}, ` : ''}${p.topLoad !== null ? `top set ${weight(p.topLoad, unit)} x ${p.topLoadReps}, ` : ''}${p.workingSets} working sets`,
    );
  const out = section(`${s.name}, recent sessions`, lines, 'no sessions in this period.');
  if (s.e1rmChange)
    out.push(
      `${s.name} e1RM change this period: ${weight(s.e1rmChange.first, unit)} to ${weight(s.e1rmChange.last, unit)} (${s.e1rmChange.fraction >= 0 ? '+' : ''}${round1(s.e1rmChange.fraction * 100)}%).`,
    );
  if (s.relativeStrength)
    out.push(`${s.name} e1RM is ${round1(s.relativeStrength.ratio)} times body weight.`);
  return out;
}

function levels(m: ProgressModel, unit: WeightUnit) {
  const lines = m.strength.levels.map(
    (l) =>
      `${l.name}: e1RM ${weight(l.e1rm, unit)} (${round1(l.ratio)} x body weight), level ${l.level ?? 'below Beginner'}${l.next && l.nextKg ? `, ${l.next} at ${weight(l.nextKg, unit)}` : ''}`,
  );
  const out = section(
    'Strength levels for body weight',
    lines,
    'not enough data on the main lifts.',
  );
  if (m.strength.dots)
    out.push(
      `DOTS score ${round1(m.strength.dots.score)} from a total of ${weight(m.strength.dots.totalKg, unit)}.`,
    );
  const names = exerciseNames(m);
  const rates = m.strength.rates
    .slice(0, 6)
    .map(
      (r) =>
        `${names.get(r.exerciseId) ?? 'A lift'}: ${r.kgPerWeek >= 0 ? '+' : ''}${formatWeightValue(r.kgPerWeek, unit, 2)} ${unit} e1RM a week`,
    );
  if (rates.length) out.push(...section('Recent rate of strength gain', rates, ''));
  return out;
}

function plateaus(m: ProgressModel, unit: WeightUnit) {
  const names = exerciseNames(m);
  return section(
    'Stalled lifts (no set beat the earlier best on weight or reps)',
    m.plateaus.map((s) => {
      const name = names.get(s.exerciseId) ?? 'A lift';
      const copy = stallCopy(s, unit, name, names);
      return `${name}: best ${weight(s.best.weightKg, unit)} x ${s.best.reps} on ${day(s.best.date)}, ${s.weeks} weeks and ${s.sessionsSince} sessions without progress. Likely cause: ${copy.label}. ${copy.finding} App advice: ${copy.action}`;
    }),
    'none, every trained lift is still moving.',
  );
}

function volume(m: ProgressModel, unit: WeightUnit) {
  const v = m.volume;
  const out = [
    `Volume load this period: ${weight(v.totalKg, unit)}${v.previousTotalKg !== null ? `, previous period ${weight(v.previousTotalKg, unit)}` : ''}.`,
  ];
  out.push(
    ...section(
      'By week',
      v.periods
        .slice(-8)
        .map(
          (p) =>
            `${p.period.longLabel}: ${weight(p.volumeKg, unit)}, ${p.workingSets} working sets${p.period.partial ? ' (partial)' : ''}`,
        ),
      'nothing logged.',
    ),
    ...section(
      'Top exercises',
      v.byExercise
        .slice(0, 8)
        .map((e) => `${e.name}: ${weight(e.volumeKg, unit)}, ${e.workingSets} working sets`),
      'none.',
    ),
  );
  return out;
}

function balance(m: ProgressModel) {
  return section(
    'Balance over the last 4 weeks (working sets)',
    m.balance.map(
      (b) =>
        `${b.label}: ${b.a.label} ${b.a.sets} sets, ${b.b.label} ${b.b.sets} sets${b.ratio !== null ? `, ratio ${round1(b.ratio)} (healthy ${b.range[0]} to ${b.range[1]})` : ''}, ${words(b.verdict).replace('a heavy', `${b.a.label} heavy`).replace('b heavy', `${b.b.label} heavy`)}`,
    ),
    'not enough sets to compare.',
  );
}

function muscles(m: ProgressModel) {
  const weeks = Math.max(1, m.muscles.weeks);
  return section(
    `Hard sets per muscle group, average per week over ${round1(weeks)} weeks (direct sets count 1, indirect 0.5; 10 to 20 a week is the common target)`,
    [...m.muscles.workload]
      .sort((a, b) => b.weighted - a.weighted)
      .map((w) => `${MUSCLE_LABELS[w.muscle]}: ${round1(w.weighted / weeks)} a week`),
    'no hard sets logged.',
  );
}

function consistency(m: ProgressModel) {
  const c = m.consistency;
  return [
    `Workouts: ${c.total} in ${m.window.days} days${c.perWeek !== null ? `, ${round1(c.perWeek)} a week` : ''}, ${Math.round(c.minutes)} minutes in total.`,
    ...section(
      'By period',
      c.periods
        .slice(-8)
        .map((p) => `${p.period.longLabel}: ${p.workouts}${p.period.partial ? ' (partial)' : ''}`),
      'nothing logged.',
    ),
  ];
}

const band = (b: { from: number; to: number }) =>
  !Number.isFinite(b.to)
    ? `over ${formatRest(b.from)}`
    : b.from <= 0
      ? `under ${formatRest(b.to)}`
      : `${formatRest(b.from)} to ${formatRest(b.to)}`;

function rest(m: ProgressModel) {
  const r = m.rest;
  if (r.intervals === 0) return ['Rest between sets: not enough timed sets to measure.'];
  const lines = [
    `Rest between sets measured from ${r.intervals} intervals.`,
    r.compound.median !== null
      ? `Compound lifts: median rest ${formatRest(r.compound.median)} (evidence suggests at least 2:00), ${r.compound.underFloor} of ${r.compound.count} under that.`
      : 'Compound lifts: not enough data.',
    r.isolation.median !== null
      ? `Isolation lifts: median rest ${formatRest(r.isolation.median)} (evidence suggests at least 1:00), ${r.isolation.underFloor} of ${r.isolation.count} under that.`
      : 'Isolation lifts: not enough data.',
  ];
  if (r.betweenExercises.median !== null)
    lines.push(`Between exercises: median ${formatRest(r.betweenExercises.median)}.`);
  lines.push(
    ...section(
      'Reps kept on the next set at the same weight, by rest length',
      r.bands
        .filter((b) => b.kept !== null)
        .map((b) => `${band(b)}: ${pct(b.kept!)} of reps kept (${b.pairs} pairs)`),
      'not enough pairs yet.',
    ),
  );
  if (r.personal)
    lines.push(`Shortest rest that keeps almost all reps: ${band(r.personal.shortest)}.`);
  return lines;
}

function body(m: ProgressModel, unit: WeightUnit) {
  const t = m.body.trend;
  const recent = m.body.points
    .filter((p) => p.averageKg !== null)
    .slice(-6)
    .map((p) => `${day(p.date)}: ${weight(p.averageKg!, unit)} (7-day average)`);
  return [
    t
      ? `Body weight trend: ${t.averageChangeKg >= 0 ? '+' : ''}${formatWeightValue(t.averageChangeKg, unit, 2)} ${unit} over ${t.days} days (${formatWeightValue((t.averageChangeKg / t.days) * 7, unit, 2)} ${unit} a week).`
      : 'Body weight trend: not enough weigh-ins yet (needs averages 7 days apart).',
    ...section('Recent averages', recent, 'none.'),
  ];
}

function records(m: ProgressModel, unit: WeightUnit) {
  return section(
    'Records set this period',
    m.records
      .slice(0, 10)
      .map(
        (r) =>
          `${r.exerciseName}, ${PR_LABELS[r.type]}: ${formatRecordValue(r.type, r.value, unit)} on ${day(r.date)}`,
      ),
    'none this period.',
  );
}

function checkinLines(c: WeeklyCheckin, unit: WeightUnit) {
  return [
    `Last week (from ${day(c.weekStart)}): ${c.sessions} sessions${c.target ? ` of ${c.target} planned` : ''}, ${c.workingSets} working sets, ${c.records} records.`,
    ...section(
      'Lifts that improved',
      c.improved.map((i) => `${i.name}: e1RM +${weight(i.gainKg, unit)}`),
      'none.',
    ),
    ...section(
      'Stalled lifts',
      c.stalled.map((s) => `${s.name}: ${s.weeks} weeks`),
      'none.',
    ),
    `The app's focus for this week: ${c.focus.text}`,
  ];
}

function targetLines(t: NonNullable<BriefInput['targets']>) {
  return [
    `Calorie target: ${t.kcal !== null ? `${t.kcal} kcal a day (set by the person)` : t.calculatedKcal !== null ? `not set, the app works out ${t.calculatedKcal} kcal` : 'not set'}.`,
    `Protein target: ${t.proteinG !== null ? `${t.proteinG} g a day` : 'not set'}.`,
    ...section(
      'What the app found',
      t.insights.map((i) => `${i.title}. ${i.body}`),
      'nothing to flag.',
    ),
  ];
}

const DIET_WORDS: Record<DietType, string> = {
  veg: 'vegetarian',
  egg: 'eggetarian (vegetarian and eggs)',
  nonveg: 'non-vegetarian',
  jain: 'Jain (vegetarian, no onion, garlic or root vegetables)',
};

/** Food: averages from the log, today so far, real maintenance and where protein comes from. */
function nutritionLines(n: NonNullable<BriefInput['nutrition']>): string[] {
  const s = n.summary;
  const lines: string[] = [];
  if (n.diet) lines.push(`Diet: ${DIET_WORDS[n.diet]}.`);
  lines.push(
    `Daily targets: ${n.targets.kcal !== null ? `${n.targets.kcal} kcal` : 'calories not set'}, ${n.targets.proteinG !== null ? `${n.targets.proteinG} g protein` : 'protein not set'}${n.targets.kcalSource === 'calculated' ? ' (calculated by the app)' : ''}.`,
  );
  if (!s.avg) {
    lines.push(
      `Food log: ${s.loggedDays} fully logged days in the last ${s.days} days, too few for averages.`,
    );
  } else {
    lines.push(
      `Food log, last ${s.days} days: ${s.loggedDays} fully logged days. Average ${s.avg.kcal} kcal, ${s.avg.proteinG} g protein, ${s.avg.carbsG} g carbs, ${s.avg.fatG} g fat, ${s.avg.fibreG} g fibre a day.`,
    );
    if (n.targets.proteinG !== null)
      lines.push(`Protein target met on ${s.proteinHitDays} of ${s.loggedDays} logged days.`);
    if (s.proteinTraining !== null && s.proteinRest !== null)
      lines.push(
        `Protein on training days ${s.proteinTraining} g, on rest days ${s.proteinRest} g.`,
      );
  }
  if (s.topProtein.length)
    lines.push(
      `Biggest protein sources: ${s.topProtein.map((t) => `${t.foodName} ${t.proteinG} g`).join(', ')}.`,
    );
  lines.push(
    `Today so far: ${Math.round(n.today.kcal)} kcal, ${round1(n.today.proteinG)} g protein.`,
  );
  if (n.maintenance)
    lines.push(
      `Real maintenance from the food log and weight trend: ${n.maintenance.kcal} kcal a day (average intake ${n.maintenance.meanIntake} kcal over ${n.maintenance.loggedDays} logged days, trend weight ${n.maintenance.changeKg >= 0 ? '+' : ''}${round1(n.maintenance.changeKg)} kg over ${n.maintenance.days} days).`,
    );
  return lines;
}

/** The last few workouts, each exercise with its heaviest working set and its set count. */
function recentWorkouts(data: TrainingData, unit: WeightUnit, limit = 6): string[] {
  const sessions = buildSessions(data).slice(-limit);
  const lines = sessions.map((s) => {
    const parts = s.exercises
      .map(({ exercise, sets }) => {
        const working = sets.filter(isWorkingSet);
        if (!exercise || working.length === 0) return null;
        const top = working.reduce((a, b) =>
          (b.weightKg ?? 0) > (a.weightKg ?? 0) ||
          ((b.weightKg ?? 0) === (a.weightKg ?? 0) && (b.reps ?? 0) > (a.reps ?? 0))
            ? b
            : a,
        );
        const best =
          top.weightKg !== null && top.weightKg > 0 && top.reps !== null
            ? `${weight(top.weightKg, unit)} x ${top.reps}${top.rir !== null ? ` at RIR ${top.rir}` : ''}`
            : top.reps !== null
              ? `${top.reps} reps`
              : top.durationSec !== null
                ? `${top.durationSec} s`
                : 'done';
        return `${exercise.name} ${best} (${working.length} sets)`;
      })
      .filter(Boolean);
    return `${day(s.date)} ${s.workout.name}: ${parts.join('; ') || 'no working sets'}`;
  });
  const routine = activeRoutine(data.routines);
  return [
    ...(routine ? [`Current routine: ${routine.name}.`] : []),
    ...section('Recent workouts, newest last (top set per exercise)', lines, 'none logged yet.'),
  ];
}

// ---------------------------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------------------------

/** The brief for an Explain button or the chat. */
export function buildBrief(topic: CoachTopic, input: BriefInput): string {
  const { model: m, unit } = input;
  const lines = [...personLines(input)];
  if (topic === 'checkin') {
    if (input.checkin) lines.push(...checkinLines(input.checkin, unit));
    if (input.data) lines.push(...recentWorkouts(input.data, unit, 5));
    if (m) lines.push(...plateaus(m, unit));
    return lines.join('\n');
  }
  if (topic === 'targets') {
    if (input.targets) lines.push(...targetLines(input.targets));
    if (input.nutrition) lines.push(...nutritionLines(input.nutrition));
    if (m) lines.push(...body(m, unit));
    return lines.join('\n');
  }
  if (!m) return [...lines, 'No workouts logged yet.'].join('\n');
  lines.push(...windowLines(m));
  switch (topic) {
    case 'insights':
      lines.push(...insights(m));
      break;
    case 'progression':
      lines.push(...progression(m, unit));
      break;
    case 'strength':
      lines.push(...selectedLift(m, unit), ...levels(m, unit));
      break;
    case 'levels':
      lines.push(...levels(m, unit));
      break;
    case 'plateaus':
      lines.push(...plateaus(m, unit));
      break;
    case 'volume':
      lines.push(...volume(m, unit));
      break;
    case 'balance':
      lines.push(...balance(m), ...muscles(m));
      break;
    case 'muscles':
      lines.push(...muscles(m), ...balance(m));
      break;
    case 'consistency':
      lines.push(...consistency(m));
      break;
    case 'rest':
      lines.push(...rest(m));
      break;
    case 'body':
      lines.push(...body(m, unit));
      break;
    case 'records':
      lines.push(...records(m, unit));
      break;
    case 'chat':
      if (input.data) lines.push(...recentWorkouts(input.data, unit));
      lines.push(
        ...insights(m),
        ...levels(m, unit),
        ...plateaus(m, unit),
        ...progression(m, unit),
        ...muscles(m),
        ...balance(m),
        ...rest(m),
        ...body(m, unit),
        ...section(
          'Most trained exercises',
          m.volume.byExercise.slice(0, 8).map((e) => `${e.name}: ${e.workingSets} working sets`),
          'none.',
        ),
      );
      if (input.targets) lines.push(...targetLines(input.targets));
      if (input.nutrition) lines.push(...nutritionLines(input.nutrition));
      break;
  }
  return lines.join('\n');
}

/** Muscles most people train on purpose, so a suggestion about them is worth asking. */
const MAIN_MUSCLES = new Set<string>([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
]);

/** Questions worth asking, from what the data actually shows. */
export function suggestedQuestions(
  m: ProgressModel | null,
  hasTargets: boolean,
  logsFood = false,
): string[] {
  if (!m || !m.hasAnyData)
    return logsFood
      ? ['Am I eating enough protein?', 'How should I start training with Overload?']
      : ['How should I start training with Overload?'];
  const out: string[] = [];
  if (logsFood) out.push('Am I eating enough protein for my goal?');
  const names = exerciseNames(m);
  const stall = m.plateaus[0];
  if (stall)
    out.push(`Why has my ${(names.get(stall.exerciseId) ?? 'lift').toLowerCase()} stalled?`);
  if (m.progression.length) out.push('Which lifts should I add weight to next session?');
  const low = [...m.muscles.workload]
    .filter((w) => MAIN_MUSCLES.has(w.muscle))
    .filter((w) => w.weighted / Math.max(1, m.muscles.weeks) < 8)
    .sort((a, b) => a.weighted - b.weighted)[0];
  if (low) out.push(`Am I training ${MUSCLE_LABELS[low.muscle].toLowerCase()} enough?`);
  if (m.rest.verdicts.some((v) => v !== 'on_target'))
    out.push('Am I resting long enough between sets?');
  if (hasTargets) out.push('Are my calorie and protein targets right for my goal?');
  out.push('What should I focus on this week?');
  return out.slice(0, 4);
}
