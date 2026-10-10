/*
 * Copy that quotes an analytics threshold (decision D8). Every number here is read from the
 * constant the calculation itself uses, so the words can never drift from the maths.
 * thresholdCopy.test.ts checks each sentence against its constants.
 */
import { TREND_DAYS } from './dashboard';
import { PROJECTION_MIN_POINTS, PROJECTION_MIN_WEEKS } from './goals';
import { FREQUENCY_MIN_DAYS } from './progress';
import { PLATEAU_MIN_SESSIONS, PLATEAU_WEEKS } from './standards';
import { MIN_TREND_SESSIONS } from './strength';

/** Weeks of history behind Home's strength trends. */
export const TREND_WINDOW_WEEKS = TREND_DAYS / 7;

export const COPY = {
  strengthTrendsEmpty: `Trends appear after ${MIN_TREND_SESSIONS} sessions of a lift in ${TREND_WINDOW_WEEKS} weeks.`,
  strengthTrendsDetail: `Estimated 1RM from your best set each session, last ${TREND_WINDOW_WEEKS} weeks`,
  stalledLiftsEmpty: `Needs ${PLATEAU_MIN_SESSIONS} sessions per lift.`,
  stalledLiftsDetail: `No new best estimated 1RM for ${PLATEAU_WEEKS} weeks or more, across at least ${PLATEAU_MIN_SESSIONS} sessions.`,
  goalProjectionEmpty: `A projection needs ${PROJECTION_MIN_POINTS} sessions over ${PROJECTION_MIN_WEEKS} weeks of recent data.`,
  frequencyEmpty: `Needs at least ${FREQUENCY_MIN_DAYS} days of history.`,
  recordsEmpty: 'Records appear when you beat an earlier best.',
} as const;
