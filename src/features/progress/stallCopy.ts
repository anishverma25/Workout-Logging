import type { Stall } from '@/domain/analytics/stalls';
import { formatCalendarDate } from '@/lib/format/dates';
import { pluralize } from '@/lib/format';
import { formatWeightValue, roundTo, toDisplayWeight, type WeightUnit } from '@/lib/units';

export interface StallCopy {
  /** Short label for the cause. */
  label: string;
  /** What the numbers show, with the numbers. */
  finding: string;
  /** What to do, specific to this lift. */
  action: string;
}

/** A load someone can put on the bar: 2.5 kg or 5 lb steps. */
function plateLoad(kg: number, unit: WeightUnit): string {
  const v = roundTo(toDisplayWeight(kg, unit), unit === 'kg' ? 2.5 : 5);
  return `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${unit}`;
}

const kgText = (kg: number, unit: WeightUnit) => `${formatWeightValue(kg, unit)} ${unit}`;

/** "175 kg × 8 on Sat, 7 Jun 2025". The year shows whenever it is not this year. */
export function stallBest(s: Stall, unit: WeightUnit, now = new Date()): string {
  return `${kgText(s.best.weightKg, unit)} × ${s.best.reps} on ${formatCalendarDate(s.best.date, now)}`;
}

export function stallCopy(
  s: Stall,
  unit: WeightUnit,
  name: string,
  names: Map<string, string>,
): StallCopy {
  const f = s.facts;
  switch (s.cause) {
    case 'break':
      return {
        label: 'Back after a break',
        finding: `You went ${pluralize(f.gapWeeks ?? 3, 'week')} without ${name} after your best. Strength starts to fade after about 3 weeks off, so being below it now is expected, not a plateau.`,
        action: `Rebuild over the next 2 to 4 weeks: add a little weight each session you hit all your reps, stopping 1 to 2 reps short of failure. Strength you have built before comes back faster than it took to build.`,
      };
    case 'frequency':
      return {
        label: 'Trained too rarely',
        finding: `${pluralize(s.sessionsSince, 'session')} of ${name} in ${pluralize(s.weeks, 'week')}, about ${(f.perWeek ?? 0).toFixed(1)} a week. Progress follows the hard sets you do each week, and one session every week or two keeps that number low.`,
        action: `Train it at least once a week, twice if you can (for example on both of your upper or lower days), with 3 or more hard sets each time.`,
      };
    case 'effort':
      return {
        label: 'Sets stop far from failure',
        finding: `Your sets of ${name} since your best ended with a median of ${f.medianRir} reps left in the tank. Sets that stop 3 or more reps short give less strength and muscle than sets taken closer.`,
        action: `On your last set, keep going until you have 1 or 2 good reps left. When you beat your reps that way, add weight next time.`,
      };
    case 'volume':
      return {
        label: 'Fewer sets than before',
        finding: `You now do ${(f.setsNow ?? 0).toFixed(1)} working sets of ${name} a session, down from ${(f.setsBefore ?? 0).toFixed(1)} in the 6 weeks before your best.`,
        action: `Go back to ${Math.round(f.setsBefore ?? 3)} working sets a session for the next 3 weeks and see if the lift moves again.`,
      };
    case 'same_load':
      return {
        label: 'Same weight every session',
        finding: `Every session since your best has topped out at ${kgText(f.loadKg ?? 0, unit)}, with at most ${f.repsAtLoad} reps.`,
        action: `Progress by reps first: stay at ${kgText(f.loadKg ?? 0, unit)} and add a rep to one set each session. When every set reaches ${(f.repsAtLoad ?? 0) + 2} reps, add the smallest weight step. Adding reps works as well as adding weight.`,
      };
    case 'rep_range': {
      const [lo, hi] = f.reps ?? [8, 12];
      const load = f.targetKg ? ` with about ${plateLoad(f.targetKg, unit)}` : '';
      return {
        label: 'A real plateau, early',
        finding: `Frequency, sets and effort all look fine, but ${name} has not moved in ${pluralize(s.weeks, 'week')}. Your top sets have been around ${lo === 5 ? '8 or more' : '6 or fewer'} reps.`,
        action: `For the next 4 weeks, work in a new range: ${lo} to ${hi} reps${load}. A new rep range is a fresh stimulus; then go back and try to beat your best.`,
      };
    }
    case 'deload':
      return {
        label: 'A real plateau: take a lighter week',
        finding: `${name} has not moved in ${pluralize(s.weeks, 'week')} over ${pluralize(s.sessionsSince, 'session')}, while you trained it often enough and hard enough. Fatigue can hide strength you already have.`,
        action: `Take one lighter week: half your usual sets of ${name}${f.targetKg ? ` at about ${plateLoad(f.targetKg, unit)}` : ''}, stopping well short of failure. Then go back to your normal sets and aim for one more rep than last time.`,
      };
    case 'variation': {
      const swap = f.variationId ? names.get(f.variationId) : undefined;
      return {
        label: 'A long plateau: change the exercise',
        finding: `${name} has not moved in ${pluralize(s.weeks, 'week')} over ${pluralize(s.sessionsSince, 'session')}, with enough sessions, sets and effort.`,
        action: swap
          ? `Swap ${name} for ${swap} for 4 to 6 weeks, keeping the same sets and effort. It trains the same muscles from a different angle, and the strength usually carries back over when you return.`
          : `Swap ${name} for a close variation that trains the same muscles (a different angle, grip or implement) for 4 to 6 weeks, then return to it.`,
      };
    }
  }
}
