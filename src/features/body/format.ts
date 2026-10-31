import { CM_PER_INCH } from '@/data/repositories/measurements';

export type LengthUnit = 'cm' | 'in';

/** Centimetres shown in the chosen unit: "176 cm" or "69.3 in". */
export function formatLength(cm: number, unit: LengthUnit, digits = 1): string {
  const value = unit === 'in' ? cm / CM_PER_INCH : cm;
  return `${value.toLocaleString('en-GB', { maximumFractionDigits: digits })} ${unit}`;
}

export const toDisplayLength = (cm: number, unit: LengthUnit) =>
  Math.round((unit === 'in' ? cm / CM_PER_INCH : cm) * 10) / 10;
