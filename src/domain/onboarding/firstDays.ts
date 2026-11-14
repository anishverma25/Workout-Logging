/**
 * The first 14 days (Fable review batch 9): a new member always has one next step on Home and
 * gets something true back early. Pure; the Now card's own cards win when they apply.
 *
 * Insights compare the person with published ranges, never with a personal model, so they are
 * true from the first log. Every number shown is one the person logged or a research range.
 */

import { PROTEIN_RANGE, SETS_CEILING, SETS_LOW } from '../brain/limits';

export const FIRST_DAYS = 14;
/** Food days before the protein average says anything (three days smooth out one odd day). */
export const PROTEIN_INSIGHT_DAYS = 3;

export type FirstDaysKind =
  | 'first_workout'
  | 'pick_routine'
  | 'first_food'
  | 'first_weight'
  | 'muscle_sets'
  | 'protein'
  | 'learning';

export interface FirstDaysCard {
  kind: FirstDaysKind;
  title: string;
  detail: string;
  action: string;
  to: string;
}

export interface FirstDaysInput {
  /** Whole days since the account was made (0 on the day of sign-up). */
  ageDays: number;
  workouts: number;
  foodDays: number;
  weighIns: number;
  /** Today's routine day when there is one, and whether any routine is active. */
  plannedDay: string | null;
  hasRoutine: boolean;
  /** This week's hard sets per muscle (from WeekFacts), by display name. */
  muscleSets: Record<string, number>;
  /** Mean protein per kg over the logged food days, when weight and protein are known. */
  proteinPerKg: number | null;
  /** The goal's protein range in g per kg (GOAL_PROTEIN), or the research default. */
  proteinRange?: [number, number];
  /** Protein numbers are shown (macro tracking: Pro, and the trial). */
  macros: boolean;
  /** The Brain's learning stage, and this week's logging toward it. */
  learning: { week: number; of: number } | null;
  weekFoodDays: number;
  weekWeighIns: number;
}

/** Weekly food days and weigh-ins the Brain asks for (`docs/brain.md`). */
export const LEARNING_FOOD_DAYS = 5;
export const LEARNING_WEIGH_INS = 4;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The most-trained muscle against the weekly evidence range, after the first workout. */
export function muscleSetsInsight(muscleSets: Record<string, number>): FirstDaysCard | null {
  const top = Object.entries(muscleSets)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const [muscle, raw] = top;
  const sets = round1(raw);
  const where =
    sets < SETS_LOW
      ? `The research range for growth is ${SETS_LOW} to ${SETS_CEILING} a week, so there is room to add.`
      : sets <= SETS_CEILING
        ? `That is inside the research range of ${SETS_LOW} to ${SETS_CEILING} a week.`
        : `That is above the ${SETS_CEILING} a week where the research stops seeing more benefit.`;
  return {
    kind: 'muscle_sets',
    title: `${muscle}: ${sets} hard ${sets === 1 ? 'set' : 'sets'} this week`,
    detail: where,
    action: 'Why',
    to: '/science#volume',
  };
}

/** Average protein per kg against the goal's range, after a few food days. */
export function proteinInsight(
  perKg: number,
  range: [number, number] = PROTEIN_RANGE,
): FirstDaysCard {
  const v = round1(perKg);
  const [low, high] = range;
  const where =
    v < low
      ? `For your goal the range starts at ${low} g.`
      : v <= high
        ? `That is inside the ${low} to ${high} g range for your goal.`
        : `That is above the ${low} to ${high} g range for your goal; more is fine, it just adds calories.`;
  return {
    kind: 'protein',
    title: `You average ${v} g of protein per kg`,
    detail: where,
    action: 'Why',
    to: '/science#protein',
  };
}

/**
 * One card, in this order: the first workout, the first food day, the first weight, then
 * something back (protein after 3 food days, else this week's sets), then the learning meter.
 * After 14 days only the learning meter remains, while the Brain is still learning.
 */
export function firstDaysCard(input: FirstDaysInput): FirstDaysCard | null {
  if (input.ageDays < 0) return null;
  if (input.ageDays > FIRST_DAYS) return input.learning ? learningCard(input) : null;
  if (input.workouts === 0) {
    if (input.plannedDay)
      return {
        kind: 'first_workout',
        title: 'Log your first workout',
        detail: `Today is ${input.plannedDay}. Tick each set as you go; the rest timer starts itself.`,
        action: 'Start',
        to: '/workout',
      };
    if (!input.hasRoutine)
      return {
        kind: 'pick_routine',
        title: 'Pick a routine',
        detail: 'Then Home shows what to train each day. You can change it any time.',
        action: 'Pick',
        to: '/routines',
      };
    return {
      kind: 'first_workout',
      title: 'Log your first workout',
      detail: 'Start from your routine or an empty workout. Every set you tick is saved.',
      action: 'Start',
      to: '/workout',
    };
  }
  if (input.foodDays === 0)
    return {
      kind: 'first_food',
      title: 'Log what you ate today',
      detail: 'Two rotis and dal takes about 10 seconds.',
      action: 'Log food',
      to: '/food',
    };
  if (input.weighIns === 0)
    return {
      kind: 'first_weight',
      title: 'Add your weight',
      detail: 'One number starts your trend.',
      action: 'Add',
      to: '/body',
    };
  if (input.macros && input.foodDays >= PROTEIN_INSIGHT_DAYS && input.proteinPerKg !== null)
    return proteinInsight(input.proteinPerKg, input.proteinRange);
  // Something back after the first sessions; after that the meter says what comes next.
  const sets = input.workouts <= 2 ? muscleSetsInsight(input.muscleSets) : null;
  if (sets) return sets;
  if (input.learning) return learningCard(input);
  return null;
}

/** "Week 2 of 6. This week: 3 of 5 food days, 2 of 4 weigh-ins." */
export function learningLine(
  learning: { week: number; of: number },
  weekFoodDays: number,
  weekWeighIns: number,
): string {
  return `Week ${Math.max(1, learning.week)} of ${learning.of}. This week: ${Math.min(weekFoodDays, LEARNING_FOOD_DAYS)} of ${LEARNING_FOOD_DAYS} food days, ${Math.min(weekWeighIns, LEARNING_WEIGH_INS)} of ${LEARNING_WEIGH_INS} weigh-ins.`;
}

function learningCard(input: FirstDaysInput): FirstDaysCard {
  return {
    kind: 'learning',
    title: 'Macrotrophy is learning you',
    detail: learningLine(input.learning!, input.weekFoodDays, input.weekWeighIns),
    action: 'How',
    to: '/science#adaptive-plan',
  };
}
