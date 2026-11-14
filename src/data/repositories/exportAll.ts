import type { WorkoutDatabase } from '@/data/db';

/** Tables that are bookkeeping for sync, not the person's data. */
const SKIP = new Set(['outbox', 'meta']);

/**
 * Everything this account keeps on the phone, as one JSON file: profile, routines, workouts and
 * sets, body, goals, food logs, own foods, plan changes and every other table. Deleted rows are
 * left out. For people who want all their data, not only the spreadsheets.
 */
export async function accountJson(db: WorkoutDatabase, now = new Date()): Promise<string> {
  const out: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    if (SKIP.has(table.name)) continue;
    const rows = (await table.toArray()) as { deletedAt?: string | null; origin?: string }[];
    out[table.name] = rows.filter((r) => !r.deletedAt && (r.origin ?? 'user') === 'user');
  }
  return JSON.stringify(
    { app: 'Macrotrophy', exportedAt: now.toISOString(), tables: out },
    null,
    2,
  );
}
