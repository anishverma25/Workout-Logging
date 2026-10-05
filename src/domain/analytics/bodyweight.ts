import { addDays } from '@/lib/dates';
import type { BodyWeightEntry } from '../models/schemas';
import { isAlive } from './sessions';

export interface BodyWeightSummary {
  latest: BodyWeightEntry;
  previous: BodyWeightEntry | null;
  /** Change vs the latest entry at least 7 days before the latest, in kg. */
  weekChangeKg: number | null;
  /** Mean of entries in the 7 days up to the latest entry; needs 3 or more entries. */
  rollingAverageKg: number | null;
  rollingCount: number;
  series: { date: Date; kg: number }[];
}

export const ROLLING_WINDOW_DAYS = 7;
export const ROLLING_MIN_ENTRIES = 3;

export function bodyWeightSummary(
  entries: BodyWeightEntry[],
  seriesDays = 30,
): BodyWeightSummary | null {
  const sorted = entries.filter(isAlive).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const latestDate = new Date(latest.measuredAt);

  const weekAgo = addDays(latestDate, -7);
  const reference = [...sorted].reverse().find((e) => new Date(e.measuredAt) <= weekAgo) ?? null;

  const windowStart = addDays(latestDate, -ROLLING_WINDOW_DAYS);
  const inWindow = sorted.filter((e) => new Date(e.measuredAt) > windowStart);
  const rollingAverageKg =
    inWindow.length >= ROLLING_MIN_ENTRIES
      ? inWindow.reduce((s, e) => s + e.weightKg, 0) / inWindow.length
      : null;

  const seriesStart = addDays(latestDate, -seriesDays);
  return {
    latest,
    previous: sorted[sorted.length - 2] ?? null,
    weekChangeKg: reference ? latest.weightKg - reference.weightKg : null,
    rollingAverageKg,
    rollingCount: inWindow.length,
    series: sorted
      .filter((e) => new Date(e.measuredAt) >= seriesStart)
      .map((e) => ({ date: new Date(e.measuredAt), kg: e.weightKg })),
  };
}

export interface BodyWeightPoint {
  date: Date;
  kg: number;
  /** Mean of entries in the 7 days up to and including this one; null with fewer than 3. */
  averageKg: number | null;
  entry: BodyWeightEntry;
}

/** Every entry with the rolling average at that point, oldest first. */
export function bodyWeightSeries(entries: BodyWeightEntry[]): BodyWeightPoint[] {
  const sorted = entries.filter(isAlive).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  return sorted.map((entry, i) => {
    const date = new Date(entry.measuredAt);
    const windowStart = addDays(date, -ROLLING_WINDOW_DAYS);
    const window: BodyWeightEntry[] = [];
    for (let j = i; j >= 0; j--) {
      const e = sorted[j]!;
      if (new Date(e.measuredAt) <= windowStart) break;
      window.push(e);
    }
    return {
      date,
      kg: entry.weightKg,
      averageKg:
        window.length >= ROLLING_MIN_ENTRIES
          ? window.reduce((s, e) => s + e.weightKg, 0) / window.length
          : null,
      entry,
    };
  });
}

export interface BodyWeightTrend {
  /** Change in the rolling average from the first to the last point in range that has one. */
  averageChangeKg: number;
  days: number;
  from: Date;
  to: Date;
}

/**
 * The trend over a set of points, from rolling averages only: single weigh-ins move with
 * water and food, so comparing two of them says little. Needs averages at least 7 days apart.
 */
export function bodyWeightTrend(points: BodyWeightPoint[]): BodyWeightTrend | null {
  const withAvg = points.filter((p) => p.averageKg !== null);
  const first = withAvg[0];
  const last = withAvg[withAvg.length - 1];
  if (!first || !last) return null;
  const days = Math.round((last.date.getTime() - first.date.getTime()) / 86_400_000);
  if (days < ROLLING_WINDOW_DAYS) return null;
  return {
    averageChangeKg: last.averageKg! - first.averageKg!,
    days,
    from: first.date,
    to: last.date,
  };
}
