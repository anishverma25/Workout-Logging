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
