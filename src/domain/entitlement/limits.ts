/**
 * Every Free and Pro limit people read about, in one place (batch 20, O9). Copy takes its
 * numbers from here; `limits.test.ts` fails on a bare number written next to these words.
 * The server enforces the group and duel limits itself (migrations 0027 and 0023); these must
 * match it.
 */
/**
 * The trial for accounts made from migration 0033 on (14 days). Older accounts had 168 hours;
 * `Entitlement.trialHours` is each account's own length, read from its row.
 */
export const TRIAL_HOURS = 336;
export const TRIAL_DAYS = TRIAL_HOURS / 24;

/** Routines on the free plan; Pro has no limit. Routines over the limit are kept. */
export const FREE_ROUTINES = 2;
/** Progress on the free plan shows this many days; Pro opens 30, 90 days and all time. */
export const FREE_PROGRESS_DAYS = 7;
/** Groups a person can be in. */
export const FREE_GROUPS = 1;
export const PRO_GROUPS = 10;
/** Duels a person can start each week. */
export const FREE_DUELS = 1;
export const PRO_DUELS = 3;
/** Food photos Macrotrophy AI reads a day (Pro). */
export const AI_PHOTOS_PER_DAY = 15;
/**
 * Community reward (migration 0040): the defaults of `forum_reward_rules`. The karma page shows
 * the server's own numbers; these are only for short lines elsewhere (tested against the SQL).
 */
export const COMMUNITY_REWARD_DAYS = 30;
export const COMMUNITY_REWARD_KARMA = 300;
