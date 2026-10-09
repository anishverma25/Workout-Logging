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

/** "8–12", or "8" when the range is a single number. */
export function formatRepRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

/** Rest or timer length: 45 s, 1:30, 3:00. */
export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Clock style for running timers: 0:45, 2:05, 1:02:10. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "2 min 05 sec", for screen readers and summaries. */
export function spokenDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s} seconds`;
  return s === 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : `${m} min ${s} sec`;
}
