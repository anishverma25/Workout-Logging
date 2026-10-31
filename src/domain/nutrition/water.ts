import type { WaterLog } from '@/domain/models/schemas';

/** A glass when the person has not set their own size. */
export const DEFAULT_GLASS_ML = 250;
export const GLASS_CHOICES_ML = [150, 200, 250, 300, 350, 500] as const;

/** Water drunk on one day, in ml. */
export function waterOn(logs: WaterLog[], date: string): number {
  return logs.reduce((t, l) => (l.deletedAt === null && l.date === date ? t + l.ml : t), 0);
}

/** The entries of one day, newest first. */
export function waterEntries(logs: WaterLog[], date: string): WaterLog[] {
  return logs
    .filter((l) => l.deletedAt === null && l.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Glasses for an amount, to one decimal: 1,250 ml in 250 ml glasses is 5. */
export function toGlasses(ml: number, glassMl: number): number {
  return Math.round((ml / glassMl) * 10) / 10;
}

/** "5 glasses", "1 glass", "2.5 glasses". */
export function glassesText(ml: number, glassMl: number): string {
  const g = toGlasses(ml, glassMl);
  return `${g} ${g === 1 ? 'glass' : 'glasses'}`;
}

/** Each of the given days with its total, oldest first, for the week strip. */
export function waterByDay(logs: WaterLog[], dates: string[]): { date: string; ml: number }[] {
  return dates.map((date) => ({ date, ml: waterOn(logs, date) }));
}
