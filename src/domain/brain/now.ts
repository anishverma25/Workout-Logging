/**
 * The Now card: the one thing that matters at this moment, picked from the person's own habits.
 * Everything else on Home stays where it is. Quiet when nothing is worth saying.
 */

export type NowKind = 'review' | 'wrapped' | 'weigh' | 'train' | 'protein' | 'meal';

export interface NowCard {
  kind: NowKind;
  title: string;
  detail: string;
  action: string;
  to: string;
}

export interface NowInput {
  /** Local hour of the day, 0 to 23, and the day of the month. */
  hour: number;
  dayOfMonth: number;
  /** The weekly review has changes waiting for an answer (Pro). */
  reviewChanges: number;
  /** A monthly recap that has not been opened: the month's name, or null. */
  wrappedMonth: string | null;
  weighedToday: boolean;
  /** Weigh-ins in the last 14 days, and the hour they are usually at. */
  weighIns14: number;
  usualWeighHour: number | null;
  /** Today's planned day when it has not been trained yet, and the usual hour of training. */
  plannedDay: string | null;
  usualGymHour: number | null;
  workoutOpen: boolean;
  /** Food: days logged in the last 7, what is left today, what has been logged for the meal now. */
  foodDays7: number;
  kcalLeft: number | null;
  proteinLeft: number | null;
  mealNow: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  mealLogged: boolean;
  /** Up to three foods that fit what is left (from Eat next). */
  fits: string[];
}

const MEAL_HOURS: Record<NowInput['mealNow'], [number, number]> = {
  breakfast: [6, 10],
  lunch: [12, 15],
  snacks: [16, 18],
  dinner: [19, 22],
};
const MEAL_NAME = { breakfast: 'breakfast', lunch: 'lunch', snacks: 'a snack', dinner: 'dinner' };

/** How habitual something has to be before the card speaks about it. */
export const NOW_MIN_WEIGH_INS = 3;
export const NOW_MIN_FOOD_DAYS = 3;
export const NOW_PROTEIN_GAP_G = 20;

export function nowCard(input: NowInput): NowCard | null {
  const { hour } = input;
  if (input.reviewChanges > 0)
    return {
      kind: 'review',
      title: 'Your week is ready',
      detail: `${input.reviewChanges} ${input.reviewChanges === 1 ? 'change' : 'changes'} proposed for this week. Nothing moves until you say yes.`,
      action: 'Review',
      to: '/report',
    };
  if (input.wrappedMonth && input.dayOfMonth <= 5)
    return {
      kind: 'wrapped',
      title: `Your ${input.wrappedMonth}, wrapped`,
      detail: 'Your month in numbers, ready to share.',
      action: 'Open',
      to: '/wrapped',
    };
  if (input.workoutOpen) return null;
  // A weigh-in belongs to the morning, for people who do weigh in.
  const weighBy = Math.min(12, (input.usualWeighHour ?? 8) + 3);
  if (!input.weighedToday && input.weighIns14 >= NOW_MIN_WEIGH_INS && hour >= 4 && hour <= weighBy)
    return {
      kind: 'weigh',
      title: 'Weigh in',
      detail: 'Before food, like your other mornings. One number keeps the trend honest.',
      action: 'Log weight',
      to: '/body',
    };
  if (input.plannedDay && input.usualGymHour !== null && Math.abs(hour - input.usualGymHour) <= 1)
    return {
      kind: 'train',
      title: `Start ${input.plannedDay}`,
      detail: 'It is about the time you usually train.',
      action: 'Start',
      to: '/workout',
    };
  const logsFood = input.foodDays7 >= NOW_MIN_FOOD_DAYS;
  if (
    logsFood &&
    hour >= 19 &&
    (input.proteinLeft ?? 0) >= NOW_PROTEIN_GAP_G &&
    (input.kcalLeft ?? 0) >= 120 &&
    input.fits.length > 0
  )
    return {
      kind: 'protein',
      title: `${Math.round(input.proteinLeft!)} g protein left`,
      detail: `These fit what is left today: ${input.fits.slice(0, 3).join(', ')}.`,
      action: 'Add',
      to: '/food',
    };
  const [from, to] = MEAL_HOURS[input.mealNow];
  if (logsFood && !input.mealLogged && hour >= from && hour <= to && input.kcalLeft !== null && input.kcalLeft > 0)
    return {
      kind: 'meal',
      title: `Log ${MEAL_NAME[input.mealNow]}`,
      detail:
        input.proteinLeft !== null && input.proteinLeft > 0
          ? `${Math.round(input.kcalLeft).toLocaleString('en-IN')} kcal and ${Math.round(input.proteinLeft)} g protein left today.`
          : `${Math.round(input.kcalLeft).toLocaleString('en-IN')} kcal left today.`,
      action: 'Log',
      to: '/food?add=1',
    };
  return null;
}

/** The hour something usually happens at: the median of the hours it happened. */
export function usualHour(dates: Date[]): number | null {
  if (dates.length < 3) return null;
  const hours = dates.map((d) => d.getHours()).sort((a, b) => a - b);
  return hours[Math.floor(hours.length / 2)]!;
}
