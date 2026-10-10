/**
 * Weight units. All loads are stored in kilograms at full precision.
 * Conversion happens only for display, so switching units never changes stored data.
 */

export type WeightUnit = 'kg' | 'lb';

export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kgToLb(kg);
}

export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

export function roundTo(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

/**
 * Trims trailing zeros. By default kilograms keep up to two decimals when the stored value
 * needs them (41.25 stays 41.25, 70.0 shows 70) and converted pounds show at most one.
 */
export function formatWeightValue(kg: number, unit: WeightUnit, maxDecimals?: number): string {
  const v = toDisplayWeight(kg, unit);
  // Loaded weights move in 0.25 kg steps, so a logged 41.25 keeps both decimals; calculated
  // values (estimates, averages) show one.
  const quarterStep = Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
  const decimals = maxDecimals ?? (unit === 'kg' && quarterStep ? 2 : 1);
  const factor = 10 ** decimals;
  const rounded = Math.round(v * factor) / factor;
  return rounded.toLocaleString('en-GB', { maximumFractionDigits: decimals });
}

export function formatWeight(kg: number, unit: WeightUnit, maxDecimals?: number): string {
  return `${formatWeightValue(kg, unit, maxDecimals)} ${unit}`;
}
