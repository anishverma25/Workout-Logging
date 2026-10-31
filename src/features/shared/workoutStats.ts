import { formatDurationSummary, formatNumber } from '@/lib/format';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';

/** "44 min · 18 sets · 4,210 kg": only the numbers that exist. */
export function workoutStats(
  minutes: number | null,
  workingSets: number,
  volumeKg: number,
  unit: WeightUnit,
): string {
  return [
    minutes !== null ? formatDurationSummary(minutes) : null,
    `${workingSets} ${workingSets === 1 ? 'set' : 'sets'}`,
    volumeKg > 0 ? `${formatNumber(toDisplayWeight(volumeKg, unit), 0)} ${unit}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
