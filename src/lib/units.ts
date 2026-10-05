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

/** Trims trailing zeros: 80 -> "80", 77.5 -> "77.5", 102.06 -> "102.1" (1 decimal max by default). */
export function formatWeightValue(kg: number, unit: WeightUnit, maxDecimals = 1): string {
  const v = toDisplayWeight(kg, unit);
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(v * factor) / factor;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

export function formatWeight(kg: number, unit: WeightUnit, maxDecimals = 1): string {
  return `${formatWeightValue(kg, unit, maxDecimals)} ${unit}`;
}
