import type { Exercise, SetType, TrackingType, WorkoutSet } from '@/domain/models/schemas';
import type { Preferences } from '@/domain/models/schemas';
import type { SetSuggestion } from '@/domain/workout/previous';
import { formatWeightValue, type WeightUnit } from '@/lib/units';

/** Column headings and behaviour of the set table for each way of tracking. */
export interface Columns {
  /** Load column heading, or null when the exercise has no load. */
  load: string | null;
  /** Second column heading: reps, seconds or metres. */
  amount: string;
  amountField: 'reps' | 'durationSec' | 'distanceM';
  showEffort: boolean;
}

export function columnsFor(tracking: TrackingType, unit: WeightUnit): Columns {
  switch (tracking) {
    case 'weight_reps':
      return { load: unit, amount: 'Reps', amountField: 'reps', showEffort: true };
    case 'weighted_bodyweight':
      return { load: `+${unit}`, amount: 'Reps', amountField: 'reps', showEffort: true };
    case 'assisted_bodyweight':
      return { load: `−${unit}`, amount: 'Reps', amountField: 'reps', showEffort: true };
    case 'bodyweight_reps':
      return { load: null, amount: 'Reps', amountField: 'reps', showEffort: true };
    case 'duration':
      return { load: null, amount: 'Sec', amountField: 'durationSec', showEffort: false };
    case 'distance':
      return { load: null, amount: 'm', amountField: 'distanceM', showEffort: false };
    case 'cardio':
      // The first column holds minutes (durationSec), the second kilometres (distanceM).
      return { load: 'Min', amount: 'km', amountField: 'distanceM', showEffort: false };
  }
}

export const trackingOf = (exercise: Exercise | undefined): TrackingType =>
  exercise?.trackingType ?? 'weight_reps';

/**
 * "80 × 8", "+10 × 6", "12 reps", "45 s", "400 m".
 * `compact` drops the spaces ("80×8") for the narrow last-time column.
 */
export function formatSetValues(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSec' | 'distanceM'> | SetSuggestion,
  tracking: TrackingType,
  unit: WeightUnit,
  compact = false,
): string {
  const w = set.weightKg !== null ? formatWeightValue(set.weightKg, unit, 2) : null;
  const x = compact ? '×' : ' × ';
  const reps = compact ? `${set.reps ?? '?'}` : `${set.reps ?? '?'} reps`;
  switch (tracking) {
    case 'weight_reps':
      return `${w ?? '?'}${x}${set.reps ?? '?'}`;
    case 'weighted_bodyweight':
      return set.weightKg ? `+${w}${x}${set.reps ?? '?'}` : reps;
    case 'assisted_bodyweight':
      return set.weightKg ? `−${w}${x}${set.reps ?? '?'}` : reps;
    case 'bodyweight_reps':
      return reps;
    case 'duration':
      return `${set.durationSec ?? '?'} s`;
    case 'distance':
      return `${set.distanceM ?? '?'} m`;
    case 'cardio': {
      const min = set.durationSec ? formatMinutes(set.durationSec) : '?';
      const km = set.distanceM ? formatKm(set.distanceM) : null;
      return compact ? `${min}′${km ? ` ${km}k` : ''}` : `${min} min${km ? `, ${km} km` : ''}`;
    }
  }
}

export const effortField = (prefs: Preferences): 'rir' | 'rpe' => prefs.effortMetric;

export const SET_TYPE_STYLES: Record<SetType, string> = {
  warmup: 'text-warn',
  working: 'text-muted',
  backoff: 'text-data-2',
  drop: 'text-danger',
};

/** Labels for the set column: working sets are numbered, other types get a letter. */
export function setLabels(sets: WorkoutSet[]): Map<string, string> {
  const labels = new Map<string, string>();
  let n = 0;
  for (const s of sets) labels.set(s.id, s.setType === 'working' ? String(++n) : '');
  return labels;
}

const formatMinutes = (sec: number) =>
  (Math.round((sec / 60) * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 });
const formatKm = (m: number) => (m / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/** Minutes per kilometre, "5:24", from a cardio set. Null without both values. */
export function formatPace(durationSec: number | null, distanceM: number | null): string | null {
  if (!durationSec || !distanceM) return null;
  const secPerKm = durationSec / (distanceM / 1000);
  if (!Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}
