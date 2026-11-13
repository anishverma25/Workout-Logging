/**
 * The hard limits the adaptive plan works inside (Project doc `claude/macrotrophy-brain-plan.md`,
 * "Safety and honesty rules"). Every one is checked by the simulation tests: no decision the
 * engine makes for any generated person may step outside them.
 */

export const KCAL_PER_KG = 7700;
/** No plan goes below this, or below the person's resting energy, whichever is higher. */
export const MIN_DAILY_KCAL = 1200;
/** The most a calorie target moves in one week. */
export const MAX_KCAL_STEP = 150;
export const KCAL_ROUND = 50;
/** A week tells us something about food and weight only with this much logged. */
export const MIN_FOOD_DAYS = 5;
export const MIN_WEIGH_INS = 4;
/** A food day counts when it has at least this much logged. */
export const LOGGED_DAY_KCAL = 1000;
/** Eating within this share of the target counts as following it. */
export const INTAKE_TOLERANCE = 0.1;
/** Weight pace on a cut, share of body weight a week (Helms 2014). Called weight, never fat. */
export const CUT_BAND: [number, number] = [0.005, 0.01];
/** A person holding weight stays within this share a week. */
export const HOLD_BAND = 0.0025;
/** Protein, g per kg of body weight (Morton 2018), unless the person set their own. */
export const PROTEIN_RANGE: [number, number] = [1.6, 2.2];
export const PROTEIN_ROUND = 5;
/** The most a muscle's weekly sets move in one week, and how many muscles move at once. */
export const MAX_SET_STEP = 2;
export const MAX_VOLUME_CHANGES = 3;
/** Weekly hard sets per muscle the plan never proposes going below or above. */
export const SETS_FLOOR = 4;
export const SETS_CEILING = 20;
/** Under this many weekly sets, a muscle that is not progressing gets more first. */
export const SETS_LOW = 10;
/** One exercise never goes above this many sets from a rewrite. */
export const MAX_SETS_PER_EXERCISE = 6;
/** Weeks of logs before the plan says anything personal. */
export const LEARNING_WEEKS = 6;
/** How much evidence it takes to move from the research default to the person's own data. */
export const SHRINK_K = 3;
/** A lift moved when its estimated 1RM changed by this share over the comparison. */
export const LIFT_UP = 0.02;
export const LIFT_DOWN = -0.03;
/** A deload trims sets to this share for one week and is never called twice within this. */
export const DELOAD_SHARE = 0.6;
export const DELOAD_GAP_WEEKS = 4;
/** Eating this far under maintenance counts as a deficit when judging recovery. */
export const DEFICIT_KCAL = 250;
/** An event changes the week's targets only when it covers at least this many of its days. */
export const EVENT_MIN_DAYS = 4;
/** The most a surplus target sits above maintenance. */
export const MAX_SURPLUS_SHARE = 0.2;

export const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/** The lowest calorie target allowed for this person. */
export function calorieFloor(bmrKcal: number | null): number {
  return Math.max(MIN_DAILY_KCAL, bmrKcal ? Math.ceil(bmrKcal / KCAL_ROUND) * KCAL_ROUND : 0);
}
