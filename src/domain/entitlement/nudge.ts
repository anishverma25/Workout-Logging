/**
 * When, and with what, to remind a free member that Pro exists.
 *
 * The rules this follows, in plain words:
 * - Only after the trial has really ended, and never to someone who already has Pro.
 * - Two quiet days after the trial ends.
 * - Then often at first while the trial is fresh in mind (days 0, 3, 7, 12 and 19 of the
 *   schedule), then once every 10 days for as long as they stay free. "Not now" buys a week.
 * - Every line is one of their own numbers, the price, or a feature they have not used. No
 *   invented deadlines, no counters, no "only today", no borrowed urgency. If there is nothing
 *   true to say, nothing is said.
 * - Reminders rotate: each one is shown once before any comes back, and then the one seen
 *   longest ago comes back first, with its numbers worked out again.
 */

/** Days after the trial ends before the first reminder. */
export const QUIET_DAYS = 2;
/** Days to wait before reminder 1 to 5. Close together at first (owner request, UI v3 A3). */
export const GAP_DAYS = [0, 3, 4, 5, 7] as const;
/** After the schedule above, one reminder every this many days while they stay free. */
export const STEADY_GAP_DAYS = 10;
/** How many shown ids are kept: enough to know the rotation order. */
export const MAX_NUDGES = 24;
/** Days of silence after "not now". */
export const DISMISS_DAYS = 7;

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
  /** The yearly price, when the server has sent it. */
  yearlyInr?: number | null;
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
      body: 'Every analysis feature, OverloadGPT and your whole history open, and you can cancel any time.',
    });
  }
  if (f.monthlyInr !== null && f.yearlyInr) {
    const saved = Math.round(f.monthlyInr * 12 - f.yearlyInr);
    if (saved > 0) {
      out.push({
        id: 'yearly',
        title: `A year of Pro is ₹${f.yearlyInr}, ₹${saved} less than paying monthly.`,
        body: 'One payment covers twelve months of progress analysis, food insights and OverloadGPT.',
      });
    }
  }
  if (f.historyDays > 0) {
    out.push({
      id: 'coach',
      title: 'OverloadGPT can read your training and explain it.',
      body: 'Ask why a lift has stalled, what to eat on a training day, or what to change next week. It uses the numbers the app has already worked out from your log.',
    });
  }
  return out;
}

/** Days to wait after the reminder that is number `shown` in the schedule (0 based). */
export function gapAfter(shown: number): number {
  return GAP_DAYS[shown] ?? STEADY_GAP_DAYS;
}

/** The reminder to show now, or null for silence. */
export function chooseNudge(facts: NudgeFacts, state: NudgeState, now: Date): Nudge | null {
  if (facts.pro || !facts.endedAt) return null;
  const sinceEnd = days(now.getTime() - facts.endedAt.getTime());
  if (sinceEnd < QUIET_DAYS) return null;
  const gap = gapAfter(state.shownIds.length);
  if (state.lastShownAt && days(now.getTime() - state.lastShownAt.getTime()) < gap) return null;
  if (state.dismissedAt && days(now.getTime() - state.dismissedAt.getTime()) < DISMISS_DAYS) {
    return null;
  }
  const list = candidates(facts);
  const fresh = list.find((c) => !state.shownIds.includes(c.id));
  if (fresh) return fresh;
  // Everything has been shown once: the one seen longest ago comes back.
  const lastSeen = (id: string) => state.shownIds.lastIndexOf(id);
  return [...list].sort((x, y) => lastSeen(x.id) - lastSeen(y.id))[0] ?? null;
}
