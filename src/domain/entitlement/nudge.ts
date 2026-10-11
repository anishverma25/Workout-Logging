/**
 * When, and with what, to remind a free member that Pro exists.
 *
 * The rules this follows, in plain words:
 * - Only after the trial has really ended, and never to someone who already has Pro.
 * - A quiet first week: nothing for the first few days after the trial ends.
 * - Widening gaps, not a drumbeat: each reminder waits longer than the last, and there are
 *   only ever four of them. A dismissal buys a long silence.
 * - Every line is one of their own numbers, or the price. No invented deadlines, no counters,
 *   no "only today", no borrowed urgency. If there is nothing true to say, nothing is said.
 */

/** Days after the trial ends before the first reminder. */
export const QUIET_DAYS = 3;
/** Days to wait before reminder 1, 2, 3 and 4. The gap widens every time. */
export const GAP_DAYS = [0, 10, 21, 35] as const;
export const MAX_NUDGES = GAP_DAYS.length;
/** Extra days of silence after "not now". */
export const DISMISS_DAYS = 21;

const DAY_MS = 86_400_000;
const days = (ms: number) => ms / DAY_MS;

export interface NudgeState {
  /** Which reminders have been shown, oldest first. One id is never repeated. */
  shownIds: string[];
  lastShownAt: Date | null;
  dismissedAt: Date | null;
}

export const EMPTY_NUDGE_STATE: NudgeState = {
  shownIds: [],
  lastShownAt: null,
  dismissedAt: null,
};

export interface NudgeFacts {
  /** True while Pro or the trial is running: nothing is shown then. */
  pro: boolean;
  /** When their trial or last Pro period ended. Null means it never started. */
  endedAt: Date | null;
  /** Workouts logged since that end. Their own effort, uncounted by anyone else. */
  workoutsSince: number;
  /** Days from their first logged workout to now. */
  historyDays: number;
  /** Personal records in their log. */
  records: number;
  /** The monthly price, when the server has sent the plans. */
  monthlyInr: number | null;
}

export interface Nudge {
  id: string;
  /** One line, their own number. */
  title: string;
  /** What Pro would do with it. */
  body: string;
}

/** The free view of Progress, in days. Anything older than this is Pro. */
export const FREE_PROGRESS_DAYS = 30;

/**
 * The reminders, best first. Each one is only offered when its own number is real, so a person
 * with no history and no records is never shown a made-up reason to pay.
 */
function candidates(f: NudgeFacts): Nudge[] {
  const out: Nudge[] = [];
  if (f.historyDays > FREE_PROGRESS_DAYS + 14) {
    out.push({
      id: 'history',
      title: `Your training log now goes back ${Math.round(f.historyDays)} days.`,
      body: `Free progress shows the last ${FREE_PROGRESS_DAYS}. Pro opens every day of it: strength, volume and consistency across months, from the sets you have already logged.`,
    });
  }
  if (f.workoutsSince >= 8) {
    out.push({
      id: 'workouts',
      title: `${f.workoutsSince} workouts logged since your trial ended.`,
      body: 'Pro reads all of them and tells you which lifts are ready for more weight, which have stalled, and what to change. The work is done; the analysis is one tap away.',
    });
  }
  if (f.records >= 3) {
    out.push({
      id: 'records',
      title: `${f.records} personal records in your log.`,
      body: 'Pro turns them into strength levels, a DOTS score and a date for each goal, so you can see how far you have come and what is next.',
    });
  }
  if (f.monthlyInr !== null) {
    const perDay = f.monthlyInr / (365 / 12);
    out.push({
      id: 'price',
      title:
        perDay < 1
          ? `Pro is ₹${f.monthlyInr} a month, under ₹1 a day.`
          : `Pro is ₹${f.monthlyInr} a month.`,
      body: 'Every analysis feature, your whole history open, and you can cancel any time. These are introductory prices while the app is new.',
    });
  }
  return out;
}

/** The reminder to show now, or null for silence. */
export function chooseNudge(facts: NudgeFacts, state: NudgeState, now: Date): Nudge | null {
  if (facts.pro || !facts.endedAt) return null;
  if (state.shownIds.length >= MAX_NUDGES) return null;
  const sinceEnd = days(now.getTime() - facts.endedAt.getTime());
  if (sinceEnd < QUIET_DAYS) return null;
  const gap = GAP_DAYS[state.shownIds.length] ?? 0;
  if (state.lastShownAt && days(now.getTime() - state.lastShownAt.getTime()) < gap) return null;
  if (
    state.dismissedAt &&
    days(now.getTime() - state.dismissedAt.getTime()) < Math.max(gap, DISMISS_DAYS)
  ) {
    return null;
  }
  return candidates(facts).find((c) => !state.shownIds.includes(c.id)) ?? null;
}
