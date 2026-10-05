/**
 * Parsing rules for workout number inputs.
 * The field may be empty while typing; it is never forced to 0.
 * Accepts "77.5" and "77,5" (comma decimal keyboards).
 */

export interface ParseOptions {
  min?: number;
  max?: number;
  allowDecimal?: boolean;
}

/** True when the raw text is an acceptable in-progress value (including empty or "77."). */
export function isValidDraft(raw: string, allowDecimal = true): boolean {
  if (raw === '') return true;
  const pattern = allowDecimal ? /^\d{0,4}([.,]\d{0,2})?$/ : /^\d{0,4}$/;
  return pattern.test(raw);
}

/** Parses a draft into a number, or null when empty or not a finished number. */
export function parseDraft(raw: string, options: ParseOptions = {}): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '.' || trimmed === ',') return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  if (options.allowDecimal === false && !Number.isInteger(value)) return null;
  if (options.min !== undefined && value < options.min) return null;
  if (options.max !== undefined && value > options.max) return null;
  return value;
}

/** Formats a stored number back into editable text without trailing zeros. */
export function toDraft(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(Math.round(value * 100) / 100);
}
