import { FREE_ROUTINES } from './limits';
/**
 * The calm trial ending (Fable review batch 9): in the last 3 days of the trial, one Home card
 * says when it ends, what Pro found in the person's own logs, and what stays free. No
 * countdown, no urgency words (tested), no invented facts.
 */

export const TRIAL_ENDING_DAYS = 3;

export interface TrialEndingCopy {
  title: string;
  findings: string[];
  free: string;
}

/** What every free account keeps, in the app's own words (Free and Pro table). */
export const STAYS_FREE = `Workout logging, your full history, every record, ${FREE_ROUTINES} routines and food logging with calories stay free.`;

export function trialEndingDue(remainingMs: number | null): boolean {
  return remainingMs !== null && remainingMs > 0 && remainingMs <= TRIAL_ENDING_DAYS * 86_400_000;
}

export function trialEndingCopy(endsAt: Date, findings: string[]): TrialEndingCopy {
  const day = endsAt.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return {
    title: `Your Pro trial ends on ${day}`,
    findings: findings.slice(0, 3),
    free: STAYS_FREE,
  };
}

/** Words and marks a calm card never uses. */
export const URGENCY =
  /hurry|last chance|don.t miss|act now|only \d|hours? left|minutes? left|expir(es|ing) soon|before it.s gone|!|countdown|limited time/i;
