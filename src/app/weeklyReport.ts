import { supabase } from '@/data/sync/supabase';
import type { WeeklyReport } from '@/domain/analytics/weekly';
import { addDays, startOfDay, startOfWeek, toDateKey, type WeekStartsOn } from '@/lib/dates';

/**
 * Weekly reports on the server (migration 0021): one per person per week, saved once by
 * `claim_weekly_report` and never changed. A copy of the person's reports is kept on this phone
 * so they open offline.
 */

export class ReportError extends Error {}

export interface SavedReport {
  id: string;
  weekStart: string;
  createdAt: string;
  report: WeeklyReport;
}

/** A week's report opens at 6 pm on its last day and can be made until 8 days after it ends. */
export const OPEN_HOUR = 18;

/**
 * The week a report can be made for now, by the phone's clock (the server checks its own), or
 * the next opening when none is open.
 */
export function reportWindow(now: Date, weekStartsOn: WeekStartsOn) {
  const current = startOfWeek(now, weekStartsOn);
  const opensAt = (start: Date) => {
    const d = addDays(start, 6);
    d.setHours(OPEN_HOUR, 0, 0, 0);
    return d;
  };
  if (now >= opensAt(current)) return { open: current, nextOpen: opensAt(addDays(current, 7)) };
  const last = addDays(current, -7);
  // Last week stays open through this week.
  return { open: last, nextOpen: opensAt(current) };
}

function messageFor(error: { message?: string; code?: string }): string {
  const m = error.message ?? '';
  if (/comes with Pro/i.test(m)) return 'The weekly report comes with Pro.';
  if (/opens on its last day/i.test(m)) return 'This week’s report opens on its last day.';
  if (/too far back/i.test(m)) return 'That week is too far back to make a report.';
  if (error.code === 'PGRST202' || /does not exist|Could not find the function/i.test(m))
    return 'Weekly reports are not available yet. Please try again later.';
  return 'Could not reach Macrotrophy. Check your connection and try again.';
}

function parse(v: unknown): SavedReport | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const report = o.report as WeeklyReport | undefined;
  if (!report || typeof report !== 'object' || report.version !== 1) return null;
  return {
    id: String(o.id ?? ''),
    weekStart: String(o.week_start ?? report.weekStart),
    createdAt: String(o.created_at ?? report.madeAt),
    report,
  };
}

const KEY = (account: string) => `overload.reports.${account}`;

export function cachedReports(account: string | null): SavedReport[] {
  if (!account) return [];
  try {
    const list = JSON.parse(localStorage.getItem(KEY(account)) ?? '[]') as unknown[];
    return list.map(parse).filter((r): r is SavedReport => r !== null);
  } catch {
    return [];
  }
}

function cache(account: string, list: SavedReport[]) {
  try {
    const raw = list.slice(0, 12).map((r) => ({
      id: r.id,
      week_start: r.weekStart,
      created_at: r.createdAt,
      report: r.report,
    }));
    localStorage.setItem(KEY(account), JSON.stringify(raw));
  } catch {
    // Storage full or refused: the reports still come from the server.
  }
}

export async function fetchReports(account: string): Promise<SavedReport[]> {
  if (!supabase) throw new ReportError('Accounts are not set up in this version of the app.');
  const { data, error } = await supabase.rpc('get_my_weekly_reports', { p_limit: 12 });
  if (error) throw new ReportError(messageFor(error));
  const list = (Array.isArray(data) ? data : []).map(parse).filter((r): r is SavedReport => r !== null);
  cache(account, list);
  return list;
}

/** Saves the week's report; when one was saved already, that one comes back unchanged. */
export async function claimReport(account: string, report: WeeklyReport): Promise<{ saved: SavedReport; created: boolean }> {
  if (!supabase) throw new ReportError('Accounts are not set up in this version of the app.');
  const { data, error } = await supabase.rpc('claim_weekly_report', {
    p_id: crypto.randomUUID(),
    p_week_start: report.weekStart,
    p_report: report,
  });
  if (error) throw new ReportError(messageFor(error));
  const saved = parse(data);
  if (!saved) throw new ReportError('Could not save the report. Try again.');
  const others = cachedReports(account).filter((r) => r.weekStart !== saved.weekStart);
  cache(account, [saved, ...others].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
  return { saved, created: (data as { created?: boolean }).created === true };
}

export const weekKey = (d: Date) => toDateKey(startOfDay(d));
