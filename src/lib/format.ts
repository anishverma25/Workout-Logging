export function formatInteger(value: number): string {
  return Math.round(value).toLocaleString();
}

/** Signed percentage, e.g. +6% / -3%. Values are fractions (0.06). */
export function formatSignedPercent(fraction: number, decimals = 0): string {
  const pct = fraction * 100;
  const factor = 10 ** decimals;
  const rounded = Math.round(pct * factor) / factor;
  if (rounded === 0) return '0%';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: decimals })}%`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Thousands separators up to 100,000, then compact: 12,480 stays "12,480"; 248,000 -> "248k". */
export function formatCompact(value: number): string {
  if (Math.abs(value) < 100_000) return formatInteger(value);
  return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
