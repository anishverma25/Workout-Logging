import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download } from 'lucide-react';
import { useAccount } from '@/app/account';
import { useFeature } from '@/app/entitlement';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  cachedReports,
  claimReport,
  fetchReports,
  ReportError,
  reportWindow,
  type SavedReport,
} from '@/app/weeklyReport';
import { PrimaryButton, SecondaryButton } from '@/components/kit';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { usePreferences } from '@/data/hooks';
import { canMakeReport, MIN_FOOD_DAYS, MIN_SESSIONS } from '@/domain/analytics/weekly';
import { addDays, toDateKey } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';
import { NextWeek } from '../brain/NextWeek';
import { ProLock } from '../pro/ProLock';
import { loadFamilies } from '../share/story/fonts';
import { DownloadSheet } from './DownloadSheet';
import { rangeLabel, ReportView, useReportPrefs, DISPLAY, BODY } from './ReportView';
import { useWeeklyReport } from './useReportInput';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekRange = (start: Date) => {
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} to ${end.getDate()} ${MONTHS[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS[start.getMonth()]} to ${end.getDate()} ${MONTHS[end.getMonth()]}`;
};
const opensText = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} at 6 pm`;

/**
 * Weekly intelligence (Pro, `docs/weekly-report.md`): one report a week, calculated on the phone
 * from the person's own logs and saved once on the server. Past reports stay readable without Pro.
 */
export function ReportPage() {
  const account = useAccount();
  const userId = account.status === 'signedIn' ? (account.user?.id ?? null) : null;
  const pro = useFeature('weekly_report');
  const prefs = usePreferences();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const { mode, setMode, lang, setLang } = useReportPrefs();

  const [saved, setSaved] = useState<SavedReport[]>(() => cachedReports(userId));
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [makeError, setMakeError] = useState<string | null>(null);
  const [download, setDownload] = useState(false);
  const [fonts, setFonts] = useState(false);

  useEffect(() => {
    let live = true;
    void loadFamilies(['bric', 'dmsans', 'dmmono']).then(() => live && setFonts(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetchReports(userId)
      .then((list) => {
        if (!live) return;
        setSaved(list);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!live) return;
        // Offline: the copies on this phone still open.
        setLoadError(e instanceof ReportError ? e.message : 'Could not load your reports.');
      })
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [userId]);

  const win = useMemo(() => reportWindow(now, prefs.weekStartsOn), [now, prefs.weekStartsOn]);
  const openKey = toDateKey(win.open);
  const savedOpen = saved.find((r) => r.weekStart === openKey) ?? null;
  const previous = saved.find((r) => r.weekStart === toDateKey(addDays(win.open, -7))) ?? null;
  const previousActions = useMemo(() => previous?.report.actions ?? null, [previous]);
  const draft = useWeeklyReport(pro && !savedOpen ? win.open : null, now, previousActions);

  const ordered = useMemo(() => [...saved].sort((a, b) => a.weekStart.localeCompare(b.weekStart)), [saved]);
  const selectedKey = params.get('week');
  const shown =
    (selectedKey ? saved.find((r) => r.weekStart === selectedKey) : null) ??
    (selectedKey ? null : savedOpen ?? ordered[ordered.length - 1] ?? null);
  const number = shown ? ordered.findIndex((r) => r.id === shown.id) + 1 : 0;

  const make = async () => {
    if (!userId || !draft.report) return;
    setMaking(true);
    setMakeError(null);
    try {
      const { saved: s } = await claimReport(userId, draft.report);
      setSaved((list) => [s, ...list.filter((r) => r.weekStart !== s.weekStart)]);
      setParams({ week: s.weekStart }, { replace: true });
    } catch (e) {
      setMakeError(e instanceof ReportError ? e.message : 'Could not make the report. Try again.');
    } finally {
      setMaking(false);
    }
  };

  const generate = (() => {
    if (!pro) return null;
    if (savedOpen) return null;
    if (draft.status === 'loading' || !loaded) return { kind: 'loading' as const };
    if (draft.status === 'error') return { kind: 'error' as const };
    if (!draft.report || !canMakeReport(draft.report)) return { kind: 'thin' as const };
    return { kind: 'ready' as const };
  })();

  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="Your week and next week"
        subtitle="One report a week, and the plan for the next"
      />

      <div className="flex flex-col gap-3" style={BODY} data-report-page>
        {!pro ? (
          <ProLock
            feature="weekly_report"
            lead={
              draft.sessions || draft.foodDays
                ? `${draft.sessions} workouts and ${draft.foodDays} food days are ready to be read together.`
                : undefined
            }
          />
        ) : null}

        {generate?.kind === 'loading' ? <Skeleton className="h-36 rounded-panel" /> : null}
        {generate?.kind === 'error' ? <ErrorState /> : null}
        {generate?.kind === 'ready' || generate?.kind === 'thin' ? (
          <section
            className="flex flex-col gap-3 rounded-panel bg-surface p-5"
            data-report-generate={generate.kind}
          >
            <span className="type-meta text-lime">Week of {weekRange(win.open)}</span>
            <h2 className="text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-text-1" style={DISPLAY}>
              {generate.kind === 'ready' ? 'Your report is ready to make' : 'Not enough logged this week'}
            </h2>
            <p className="type-body text-text-2">
              {generate.kind === 'ready'
                ? 'You get one report for each week. It is saved once and stays the same, so make it when the week is logged.'
                : `A report needs ${MIN_SESSIONS} workouts or ${MIN_FOOD_DAYS} days of food in the week. You can still log the days you missed.`}
            </p>
            {makeError ? (
              <p role="alert" className="type-footnote text-danger-text">
                {makeError}
              </p>
            ) : null}
            {generate.kind === 'ready' ? (
              <PrimaryButton block loading={making} onClick={() => void make()} data-report-make>
                Make my report
              </PrimaryButton>
            ) : null}
            <p className="type-footnote text-text-3">Next week opens {opensText(win.nextOpen)}.</p>
          </section>
        ) : null}

        {loadError && !saved.length ? (
          <p className="type-footnote text-text-3" role="status">
            {loadError}
          </p>
        ) : null}

        {ordered.length > 1 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Your reports">
            {[...ordered].reverse().map((r) => {
              const on = shown?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setParams({ week: r.weekStart }, { replace: true })}
                  className={cn(
                    'pressable type-footnote shrink-0 rounded-full px-3.5 py-2 whitespace-nowrap',
                    on ? 'bg-text-1 text-bg' : 'bg-surface text-text-2',
                  )}
                >
                  {rangeLabel(r.report)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {shown ? (
        <div className={cn('transition-opacity', fonts ? 'opacity-100' : 'opacity-0')}>
          <ReportView
            report={shown.report}
            number={number}
            mode={mode}
            onMode={setMode}
            lang={lang}
            onLang={setLang}
            actions={
              <div className="mt-5 flex flex-wrap gap-2">
                <SecondaryButton compact icon={<Download />} onClick={() => setDownload(true)} data-report-download>
                  Download
                </SecondaryButton>
              </div>
            }
          />
        </div>
      ) : pro && !savedOpen && loaded && !ordered.length ? (
        <p className="type-footnote mt-6 text-text-3">Your reports will be kept here.</p>
      ) : null}

      <NextWeek lang={lang} now={now} />

      <DownloadSheet open={download && !!shown} onClose={() => setDownload(false)} saved={shown} number={number} lang={lang} />
    </>
  );
}
