import { toDisplayWeight, type WeightUnit } from '@/lib/units';

/** en-GB grouping, at most `maxDecimals` decimals, no trailing ".0": 10,413 · 62.5 · 70. */
export function formatNumber(value: number, maxDecimals = 1): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  // Avoid "-0".
  const clean = Object.is(rounded, -0) ? 0 : rounded;
  return clean.toLocaleString('en-GB', { maximumFractionDigits: maxDecimals });
}

/**
 * A load in the person's unit. Kilograms keep up to two decimals when the stored value needs
 * them (41.25 stays 41.25, 70.0 shows 70); converted pounds show at most one decimal.
 */
export function formatLoad(kg: number, unit: WeightUnit): string {
  const v = toDisplayWeight(kg, unit);
  const quarterStep = Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
  return formatNumber(v, unit === 'kg' && quarterStep ? 2 : 1);
}

/** "44 min", "1 h 13 min", "2 h". */
export function formatDurationSummary(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
