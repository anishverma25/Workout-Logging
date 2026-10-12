import type { ImportedLog, ImportedWorkout, ImportSource } from './formats';

/**
 * The routine someone was following, rebuilt from their recent workouts.
 *
 * Neither Hevy nor Strong exports routines, but every workout started from a routine keeps the
 * routine day's name as its title ("Push A", "FULL BODY (B)"). So:
 * - each title trained in the last six weeks of the log is a day of the routine, unless it is
 *   an app's default name for an unplanned session ("Evening Workout");
 * - a day's exercises, their order and how many working sets come from the latest time it was
 *   trained; the rep range spans the working sets of its last three sessions;
 * - each weekday goes to the day most often trained on it, so Home plans the days the person
 *   actually trains. Weekdays never trained stay rest days.
 * Everything can be edited afterwards like any other routine.
 */

export interface InferredSlot {
  /** The exercise's name in the export; the import decides what it becomes. */
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
  supersetKey: string | null;
}

export interface InferredDay {
  /** The workout title in the export this day was rebuilt from. */
  title: string;
  name: string;
  weekdays: number[];
  /** Times it was trained in the window, for the preview. */
  sessions: number;
  slots: InferredSlot[];
}

export interface InferredRoutine {
  name: string;
  days: InferredDay[];
}

export const ROUTINE_WINDOW_DAYS = 42;
const MAX_DAYS = 7;
const RECENT_SESSIONS = 3;
/** Rep range for exercises logged without reps (holds, carries). */
const DEFAULT_REPS: [number, number] = [8, 12];

const GENERIC =
  /^((early |late )?(morning|afternoon|evening|night|lunch|midday|noon)( workout)?|workout|quick workout|new workout|empty workout|untitled)$/i;

const DAY_MS = 86_400_000;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

/** "FULL BODY EACH OTHER DAY (A)" and "(B)" share "FULL BODY EACH OTHER DAY". */
function commonName(titles: string[]): string | null {
  if (titles.length < 2) return null;
  let prefix = titles[0]!;
  for (const t of titles.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < t.length && prefix[i]!.toLowerCase() === t[i]!.toLowerCase())
      i++;
    prefix = prefix.slice(0, i);
  }
  // Cut back to a whole word, and drop joining punctuation such as " (" or " -".
  const midWord = /\w$/.test(prefix) && titles.some((t) => /\w/.test(t[prefix.length] ?? ''));
  const trimmed = (midWord ? prefix.replace(/\w+$/, '') : prefix)
    .replace(/[\s\-:(/|,]+$/, '')
    .trim();
  return trimmed.length >= 3 ? trimmed : null;
}

function slotsFor(sessions: ImportedWorkout[]): InferredSlot[] {
  const latest = sessions[0]!;
  const seen = new Set<string>();
  const slots: InferredSlot[] = [];
  for (const ex of latest.exercises) {
    if (seen.has(ex.name)) continue;
    seen.add(ex.name);
    const working = ex.sets.filter((s) => s.setType !== 'warmup');
    const recentReps = sessions
      .slice(0, RECENT_SESSIONS)
      .flatMap((w) => w.exercises.filter((e) => e.name === ex.name))
      .flatMap((e) => e.sets.filter((s) => s.setType !== 'warmup' && s.reps !== null && s.reps > 0))
      .map((s) => Math.min(100, s.reps!));
    const [repMin, repMax] =
      recentReps.length > 0 ? [Math.min(...recentReps), Math.max(...recentReps)] : DEFAULT_REPS;
    const rpes = working.map((s) => s.rpe).filter((r): r is number => r !== null);
    slots.push({
      name: ex.name,
      sets: Math.max(1, Math.min(20, working.length || ex.sets.length)),
      repMin,
      repMax,
      targetRir: rpes.length > 0 ? Math.max(0, Math.min(10, Math.round(10 - median(rpes)))) : null,
      supersetKey: ex.supersetKey,
    });
  }
  return slots;
}

export function inferRoutine(log: ImportedLog, source: ImportSource): InferredRoutine | null {
  const latest = log.workouts[log.workouts.length - 1];
  if (!latest) return null;
  const since = latest.startedAt.getTime() - ROUTINE_WINDOW_DAYS * DAY_MS;
  const recent = log.workouts
    .filter((w) => w.startedAt.getTime() >= since && !GENERIC.test(w.title.trim()))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  if (recent.length === 0) return null;

  const byTitle = new Map<string, ImportedWorkout[]>();
  for (const w of recent) {
    const list = byTitle.get(w.title) ?? [];
    list.push(w);
    byTitle.set(w.title, list);
  }
  // Most-trained first if there are more than a week's worth, then in name order (A before B).
  const titles = [...byTitle.keys()]
    .sort((a, b) => byTitle.get(b)!.length - byTitle.get(a)!.length)
    .slice(0, MAX_DAYS)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Each weekday to the day trained on it most often; ties go to the most recent.
  const weekdays = new Map<string, number[]>(titles.map((t) => [t, []]));
  for (let wd = 0; wd < 7; wd++) {
    let best: { title: string; count: number; last: number } | null = null;
    for (const t of titles) {
      const on = byTitle.get(t)!.filter((w) => w.startedAt.getDay() === wd);
      if (on.length === 0) continue;
      const cand = { title: t, count: on.length, last: on[0]!.startedAt.getTime() };
      if (!best || cand.count > best.count || (cand.count === best.count && cand.last > best.last))
        best = cand;
    }
    if (best) weekdays.get(best.title)!.push(wd);
  }

  const days: InferredDay[] = titles.map((t) => ({
    title: t,
    name: t.trim().slice(0, 40),
    weekdays: weekdays.get(t)!,
    sessions: byTitle.get(t)!.length,
    slots: slotsFor(byTitle.get(t)!),
  }));
  const fallback = source === 'hevy' ? 'My Hevy routine' : 'My Strong routine';
  const name = (titles.length === 1 ? titles[0]! : commonName(titles)) ?? fallback;
  return { name: name.slice(0, 60), days: days.filter((d) => d.slots.length > 0) };
}
