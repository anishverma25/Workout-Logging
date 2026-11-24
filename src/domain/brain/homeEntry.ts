import type { Finding } from './response';
import { MIN_FOOD_DAYS, MIN_SESSIONS } from '../analytics/weekly';

/**
 * Home shows the "weekly report is ready" banner once the report week has opened (its last day,
 * 6 pm), while no report exists for that week, when the week has enough logged to make one, and
 * until the person makes it (or hides the banner for that week).
 */
export function reportBannerDue(input: {
  /** Monday of the report week that is open now, yyyy-mm-dd. */
  openWeek: string;
  /** Weeks that already have a saved report on this account. */
  savedWeeks: readonly string[];
  /** Weeks whose banner the person closed. */
  hiddenWeeks: readonly string[];
  sessions: number;
  foodDays: number;
}): boolean {
  if (input.savedWeeks.includes(input.openWeek)) return false;
  if (input.hiddenWeeks.includes(input.openWeek)) return false;
  return input.sessions >= MIN_SESSIONS || input.foodDays >= MIN_FOOD_DAYS;
}

export interface BrainSummary {
  /** learning: still collecting weeks; ready: decides from the person's own data. */
  stage: 'learning' | 'ready';
  /** Learning progress, 0 to 1. */
  progress: number;
  headline: string;
  /** The short label on Home's Brain row: "Learning you · Week 5 of 6". */
  badge: string;
  detail: string;
}

/**
 * The Brain's state in one line for Home: how far it has learned the person, and what it has
 * for next week. Every number comes from the Brain's own model and decision.
 */
export function brainSummary(input: {
  stage: { learning: boolean; week: number; of: number } | null;
  changes: number | null;
  decided: 'applied' | 'kept' | null;
  pro: boolean;
}): BrainSummary {
  const s = input.stage;
  const learning = !s || s.learning;
  const week = s ? Math.max(1, Math.min(s.week, s.of)) : 1;
  const of = s?.of ?? 4;
  const headline = learning ? `Learning you: week ${week} of ${of}` : 'Your plan adapts to you';
  let detail: string;
  if (!input.pro) {
    detail = learning
      ? 'It reads your workouts, food and weight to plan each week. Your plan with Pro.'
      : 'It has learned from your logs and can plan next week. Your plan with Pro.';
  } else if (input.decided === 'applied') {
    detail = 'Next week is set. Your changes are applied.';
  } else if (input.decided === 'kept') {
    detail = 'Next week is set. You kept your plan.';
  } else if (input.changes === null) {
    detail = 'Next week appears here as soon as your week is read.';
  } else if (input.changes === 0) {
    detail = 'Nothing to change next week. Your plan stays as it is.';
  } else {
    detail = `${input.changes} ${input.changes === 1 ? 'change' : 'changes'} ready for next week.`;
  }
  return {
    stage: learning ? 'learning' : 'ready',
    progress: learning ? week / of : 1,
    headline,
    badge: learning ? `Learning you · Week ${week} of ${of}` : 'Knows you',
    detail,
  };
}

const BAND: Record<string, string> = {
  low: 'under 10 hard sets a week',
  mid: '10 to 15 hard sets a week',
  high: '16 or more hard sets a week',
  heavy: 'heavier sets of 1 to 5 reps',
  moderate: 'sets of 6 to 10 reps',
  short: '2 days or less between sessions',
  long: '3 days or more between sessions',
  deficit: 'eating below maintenance',
  fed: 'eating at maintenance or above',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One plain line for a finding the person's own data supports. */
export function findingLine(f: Finding): string | null {
  if (f.confidence !== 'personal' || !f.best || !BAND[f.best]) return null;
  const who = f.subject === 'all' ? 'You' : cap(f.subject.replace(/-/g, ' '));
  return f.subject === 'all'
    ? `${who} progressed most when ${BAND[f.best]}.`
    : `${who} progressed most on ${BAND[f.best]}.`;
}
