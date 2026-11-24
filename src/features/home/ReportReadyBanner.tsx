import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileText, X } from 'lucide-react';
import { Link } from 'react-router';
import { useAccount } from '@/app/account';
import { cachedReports, fetchReports, reportWindow } from '@/app/weeklyReport';
import type { TrainingData } from '@/domain/analytics/sessions';
import { buildSessions } from '@/domain/analytics/sessions';
import { reportBannerDue } from '@/domain/brain/homeEntry';
import type { WeekFacts } from '@/domain/brain/facts';
import { addDays, toDateKey } from '@/lib/dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekRange = (start: Date) => {
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} to ${end.getDate()} ${MONTHS[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS[start.getMonth()]} to ${end.getDate()} ${MONTHS[end.getMonth()]}`;
};

const HIDDEN_KEY = (account: string) => `overload.reportBannerHidden.${account}`;
function readHidden(account: string | null): string[] {
  if (!account) return [];
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_KEY(account)) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * "Your weekly report is ready": shown on Home once the week has closed and until the report for
 * that week is made, for everyone (free members see what the report is, the page asks for Pro).
 */
export function ReportReadyBanner({
  data,
  weeks,
  now,
}: {
  data: TrainingData;
  weeks: WeekFacts[];
  now: Date;
}) {
  const account = useAccount();
  const userId = account.status === 'signedIn' ? (account.user?.id ?? null) : null;
  const win = useMemo(() => reportWindow(now, 1), [now]);
  const openKey = toDateKey(win.open);
  const [saved, setSaved] = useState(() => cachedReports(userId).map((r) => r.weekStart));
  const [hidden, setHidden] = useState(() => readHidden(userId));

  const counts = useMemo(() => {
    const end = addDays(win.open, 7);
    const sessions = buildSessions(data).filter((s) => s.date >= win.open && s.date < end).length;
    const foodDays = weeks.find((w) => w.weekStart === openKey)?.foodDays ?? 0;
    return { sessions, foodDays };
  }, [data, weeks, win.open, openKey]);

  const due = reportBannerDue({
    openWeek: openKey,
    savedWeeks: saved,
    hiddenWeeks: hidden,
    ...counts,
  });

  // The phone's copy may be behind (made on another phone): ask the server once when it matters.
  useEffect(() => {
    if (!userId || !due) return;
    let live = true;
    fetchReports(userId)
      .then((list) => live && setSaved(list.map((r) => r.weekStart)))
      .catch(() => {
        // Offline: keep what the phone knows.
      });
    return () => {
      live = false;
    };
  }, [userId, due]);

  if (!due) return null;
  const hide = () => {
    const next = [...hidden.filter((w) => w >= toDateKey(addDays(win.open, -28))), openKey];
    setHidden(next);
    if (userId)
      try {
        localStorage.setItem(HIDDEN_KEY(userId), JSON.stringify(next));
      } catch {
        // Private mode: hidden until the page reloads.
      }
  };
  return (
    <div className="report-ready mb-4 flex items-center rounded-full pl-1" data-report-ready>
      <Link
        to="/report"
        className="pressable chrome flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-1"
        data-report-ready-open
        aria-label={`Your weekly report is ready: week of ${weekRange(win.open)}`}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-lime text-on-lime"
          aria-hidden
        >
          <FileText className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className="type-subhead font-semibold text-text-1">
            Your weekly report is ready
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-lime" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={hide}
        className="pressable tap-target grid size-10 shrink-0 place-items-center rounded-full text-text-3"
        aria-label="Hide for this week"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
