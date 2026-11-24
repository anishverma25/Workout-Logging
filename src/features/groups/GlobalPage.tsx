import { useState } from 'react';
import { ChevronDown, Dumbbell, Globe2 } from 'lucide-react';
import { useSyncStatus } from '@/app/account';
import {
  CommunityError,
  getBoardRoutine,
  getGlobalBoard,
  setShareRoutine,
  useRemote,
  type GlobalRow,
  type NameStyle,
  type Period,
} from '@/app/community';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  CapsuleButton,
  InlineNotice,
  Section,
  SegmentedControl,
  Skeleton,
  Switch,
  TextButton,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { globalRankStory } from '@/domain/share/story';
import { RankShareSheet } from '@/features/share/RankShareSheet';
import { formatNumber } from '@/lib/format';
import { ScoreBreakdown } from './ScoreBreakdown';
import { useFeature } from '@/app/entitlement';
import { cn } from '@/lib/cn';
import { Link } from 'react-router';
import { BoardRoutineSheet } from './BoardRoutineSheet';
import { ReportSheet, ShowAsSheet } from './PrivacySheets';
import { HowPointsWork } from './GroupsPage';
import { MemberAvatar, ProTag } from './parts';

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const MEDAL = [
  'bg-gold-dim text-gold',
  'bg-[var(--fill)] text-[var(--tier-silver-1)]',
  'bg-[var(--fill)] text-[var(--tier-bronze-1)]',
];

/**
 * The global leaderboard (November 2026): everyone on Macrotrophy with points this week or month,
 * by Macrotrophy Score. Everyone appears under their profile name; a username shows only when its
 * owner turns it on here.
 */
export function GlobalPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('week');
  // Free members see how many of the leaders are Pro (from the board itself, so always true).
  const isPro = useFeature('group_boards');
  const [offset, setOffset] = useState<0 | -1>(0);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [style, setStyle] = useState<NameStyle | null>(null);
  const [showAsOpen, setShowAsOpen] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);
  const [reporting, setReporting] = useState<GlobalRow | null>(null);
  const [sharing, setSharing] = useState(false);
  const [routineOf, setRoutineOf] = useState<GlobalRow | null>(null);
  const [routineShown, setRoutineShown] = useState<boolean | null>(null);
  const [routineNotice, setRoutineNotice] = useState(() => {
    try {
      return localStorage.getItem(ROUTINE_NOTICE_KEY) !== 'seen';
    } catch {
      return false;
    }
  });
  const sync = useSyncStatus();
  const board = useRemote(
    () => getGlobalBoard(period, offset),
    `global:${period}:${offset}:${version}`,
  );
  const b = board.data ?? null;
  const nameStyle = style ?? b?.nameStyle ?? 'name';
  // Asked once: the first time the board opens for someone who has never chosen.
  const firstAsk = !!b && !b.styleChosen && style === null && !askedOnce;
  const shareRoutine = routineShown ?? b?.shareRoutine ?? true;
  const podium = b && offset === 0 && b.rows.length >= 3 ? b.rows.slice(0, 3) : null;
  const listRows = b ? (podium ? b.rows.slice(3) : b.rows) : [];

  const dismissNotice = () => {
    setRoutineNotice(false);
    try {
      localStorage.setItem(ROUTINE_NOTICE_KEY, 'seen');
    } catch {
      // Storage blocked: the notice shows again next time.
    }
  };

  const toggleRoutine = async (next: boolean) => {
    setRoutineShown(next);
    dismissNotice();
    try {
      await setShareRoutine(next);
      toast(next ? 'Your routine plan shows on the boards' : 'Your routine is private now');
    } catch (err) {
      setRoutineShown(!next);
      toast(err instanceof CommunityError ? err.message : 'Could not save. Try again.');
    }
  };
  const periodName = period === 'week' ? 'week' : 'month';
  const which = offset === 0 ? `This ${periodName}` : `Last ${periodName}`;
  const mineInTop = !!b?.rows.some((r) => r.me);

  return (
    <>
      <PageHeader
        back={{ to: '/groups', label: 'Groups' }}
        title="Global leaderboard"
        subtitle="Everyone on Macrotrophy, by the same fair Macrotrophy Score."
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10" data-global-page>
        {board.loading && !b ? <Skeleton height="16rem" radius="panel" /> : null}
        {board.error ? (
          <InlineNotice tone="warning">
            {board.error}{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setVersion((v) => v + 1)}
            >
              Try again
            </button>
          </InlineNotice>
        ) : null}

        {b ? (
          <>
            <div
              className="flex items-center gap-3 rounded-panel bg-lime-dim px-5 py-4"
              data-global-mine
            >
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime"
              >
                <Globe2 className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                {b.mine ? (
                  <>
                    <span className="type-headline tabular block text-text-1">
                      You are #{formatNumber(b.mine.rank)} of {formatNumber(b.total)}
                    </span>
                    <span className="type-subhead tabular block text-text-2">
                      {formatNumber(b.mine.score)} {b.mine.score === 1 ? 'point' : 'points'}{' '}
                      {offset === 0 ? `this ${periodName}` : `last ${periodName}`}
                      {nameStyle === 'hidden' ? '. Only you see this.' : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="type-headline block text-text-1">
                      {offset === 0 ? 'Not on the board yet' : `No points last ${periodName}`}
                    </span>
                    <span className="type-subhead block text-text-2">
                      {offset === 0
                        ? 'Finish a workout of 10 minutes or more and you appear here.'
                        : `${formatNumber(b.total)} people scored.`}
                    </span>
                  </>
                )}
              </span>
              {b.mine ? (
                <CapsuleButton tone="lime" onClick={() => setSharing(true)} data-share-rank>
                  Share
                </CapsuleButton>
              ) : null}
            </div>

            {sync.pending - sync.rejected > 0 ? (
              <InlineNotice>
                Some of your changes have not reached your account yet. Your workouts count here
                once they sync.
              </InlineNotice>
            ) : null}

            <SegmentedControl<Period>
              label="Leaderboard period"
              block
              value={period}
              onChange={(p) => {
                setPeriod(p);
                setOffset(0);
                setOpen(null);
              }}
              options={[
                { value: 'week', label: 'Weekly' },
                { value: 'month', label: 'Monthly' },
              ]}
            />

            {routineNotice ? (
              <InlineNotice
                icon={<Dumbbell />}
                action={
                  <TextButton small onClick={dismissNotice}>
                    Got it
                  </TextButton>
                }
              >
                <span data-routine-notice>
                  New: tap anyone to see their routine and copy it. Yours shows too (the plan only,
                  never weights). You can hide it under Your privacy.
                </span>
              </InlineNotice>
            ) : null}

            {podium ? (
              <Podium
                rows={podium}
                onPick={(r) => setOpen((o) => (o === r.rank ? null : r.rank))}
              />
            ) : null}

            <Section
              title={`${which} · ${dateLabel(b.startsOn)} to ${dateLabel(b.endsOn)}`}
              id="global-board-title"
              action={
                <TextButton
                  small
                  onClick={() => {
                    setOffset((o) => (o === 0 ? -1 : 0));
                    setOpen(null);
                  }}
                  data-toggle-offset
                >
                  {offset === 0 ? `Last ${periodName}` : `This ${periodName}`}
                </TextButton>
              }
              footer={
                offset === 0
                  ? 'The top 100 by Macrotrophy Score. Updates every minute or so. Tap a name for their points and routine.'
                  : 'Final result, locked when it ended.'
              }
            >
              {b.rows.length === 0 ? (
                <p className="type-meta rounded-card bg-surface p-4 text-text-2">
                  No points yet this {periodName}. The first finished workout takes the lead.
                </p>
              ) : (
                <ol
                  className="divide-y-[0.5px] divide-divider overflow-hidden rounded-card bg-surface"
                  aria-labelledby="global-board-title"
                  data-global-board
                >
                  {(podium && open !== null && open <= 3
                    ? b.rows.slice(0, 3).filter((r) => r.rank === open)
                    : []
                  ).map((r) => (
                    <GlobalRowView
                      key={`p${r.rank}`}
                      row={r}
                      open
                      onToggle={() => setOpen(null)}
                      onRoutine={() => setRoutineOf(r)}
                      onReport={() => setReporting(r)}
                    />
                  ))}
                  {listRows.map((r) => (
                    <GlobalRowView
                      key={r.rank}
                      row={r}
                      open={open === r.rank}
                      onToggle={() => setOpen((o) => (o === r.rank ? null : r.rank))}
                      onRoutine={() => setRoutineOf(r)}
                      onReport={() => setReporting(r)}
                    />
                  ))}
                  {b.mine && !mineInTop ? (
                    <>
                      <li aria-hidden className="type-caption py-1 text-center text-text-3">
                        ···
                      </li>
                      <GlobalRowView
                        row={b.mine}
                        open={open === b.mine.rank}
                        onToggle={() => setOpen((o) => (o === b.mine!.rank ? null : b.mine!.rank))}
                        onRoutine={() => setRoutineOf(b.mine)}
                        onReport={() => undefined}
                      />
                    </>
                  ) : null}
                </ol>
              )}
            </Section>

            {!isPro && offset === 0 ? <ProLeaders rows={b.rows} /> : null}

            <Section title="Your privacy" id="global-privacy-title">
              <div
                className="divide-y-[0.5px] divide-divider overflow-hidden rounded-card bg-surface"
                data-global-privacy
              >
                <button
                  type="button"
                  onClick={() => setShowAsOpen(true)}
                  className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
                  data-show-as-row
                >
                  <span className="min-w-0 flex-1">
                    <span id="global-privacy" className="type-headline block text-text-1">
                      Show me as
                    </span>
                    <span className="type-subhead block text-text-2">{STYLE_LABEL[nameStyle]}</span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 -rotate-90 text-text-3" aria-hidden />
                </button>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span id="routine-privacy" className="type-headline block text-text-1">
                      Show my routine plan
                    </span>
                    <span className="type-subhead block text-text-2">
                      People who tap you see your days, exercises, sets and reps. Never your
                      weights, food or body.
                    </span>
                  </span>
                  <Switch
                    checked={shareRoutine}
                    onChange={(next) => void toggleRoutine(next)}
                    aria-labelledby="routine-privacy"
                    data-share-routine-switch
                  />
                </div>
              </div>
            </Section>

            <HowPointsWork />
          </>
        ) : null}
      </div>
      <ShowAsSheet
        open={showAsOpen || firstAsk}
        first={firstAsk}
        current={nameStyle}
        hasUsername={!!b?.hasUsername}
        onClose={() => {
          setShowAsOpen(false);
          setAskedOnce(true);
        }}
        onSaved={(s) => {
          setStyle(s);
          setShowAsOpen(false);
          setAskedOnce(true);
          setVersion((v) => v + 1);
        }}
      />
      <ReportSheet
        open={reporting !== null}
        kind="person"
        target={
          reporting
            ? reporting.username
              ? `@${reporting.username}`
              : `${reporting.name}, #${reporting.rank} ${period} ${b?.startsOn ?? ''}`
            : ''
        }
        label={reporting?.name ?? ''}
        onClose={() => setReporting(null)}
      />
      <BoardRoutineSheet
        open={routineOf !== null}
        onClose={() => setRoutineOf(null)}
        owner={routineOf?.name ?? ''}
        load={() => getBoardRoutine(period, offset, routineOf!.rank)}
      />
      {b?.mine ? (
        <RankShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          fileTag={`rank-${period}`}
          load={async () => {
            const mine = b.mine;
            if (!mine) return null;
            // Movement only against a finished, frozen period.
            let previousRank: number | null = null;
            if (offset === 0) {
              const prev = await getGlobalBoard(period, -1).catch(() => null);
              if (prev?.locked && prev.mine) previousRank = prev.mine.rank;
            }
            return globalRankStory({
              period,
              startsOn: b.startsOn,
              endsOn: b.endsOn,
              rank: mine.rank,
              total: b.total,
              previousRank,
              score: mine.score,
              workouts: mine.workouts,
              hardSets: mine.hardSets,
              records: mine.records,
              proteinDays: mine.proteinDays,
              consistencyWeeks: mine.consistencyWeeks,
              progressPoints: mine.progressPoints,
              past: offset !== 0,
            });
          }}
        />
      ) : null}
    </>
  );
}

const ROUTINE_NOTICE_KEY = 'overload.routineNotice';

const STYLE_LABEL: Record<NameStyle, string> = {
  name: 'My name and photo',
  username: 'My username and photo',
  initials: 'Initials only, no photo',
  hidden: 'Not shown on the public board',
};

/** Gold, silver and bronze in a ring of their metal, on steps, first in the middle and raised. */
function Podium({ rows, onPick }: { rows: GlobalRow[]; onPick: (r: GlobalRow) => void }) {
  const order = [rows[1]!, rows[0]!, rows[2]!];
  return (
    <ol className="podium" aria-label="Top three" data-podium>
      <li className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="podium-flake" style={{ left: '38%', top: 0 }} />
        <span
          className="podium-flake"
          style={{ left: '58%', top: -6, animationDelay: '1.1s', background: 'var(--tier-gold-a)' }}
          aria-hidden
        />
        <span
          className="podium-flake"
          style={{ left: '47%', top: 10, animationDelay: '2.2s' }}
          aria-hidden
        />
      </li>
      {order.map((r) => {
        const first = r.rank === 1;
        return (
          <li key={r.rank} className="podium-spot" data-place={r.rank}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="pressable flex w-full min-w-0 flex-col items-center gap-1.5 text-center"
              data-podium-rank={r.rank}
            >
              {first ? (
                <svg className="podium-crown" viewBox="0 0 48 36" aria-hidden>
                  <path
                    d="M4 30 2 8l12 10L24 2l10 16 12-10-2 22Z"
                    fill="var(--gold)"
                    stroke="var(--tier-gold-c)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="24" cy="2.5" r="2.5" fill="var(--tier-gold-a)" />
                </svg>
              ) : null}
              <span className="podium-ring">
                <span className={first ? 'scale-150' : 'scale-125'}>
                  <MemberAvatar username={r.name} avatar={r.avatar} />
                </span>
                <span className="podium-medal tabular" aria-label={`Place ${r.rank}`}>
                  {r.rank}
                </span>
              </span>
              <span
                className={cn(
                  'type-subhead mt-3 w-full truncate font-semibold text-text-1',
                  first && 'mt-5',
                )}
              >
                {r.name}
              </span>
              {r.pro || r.me ? (
                <span className="flex items-center gap-1">
                  {r.pro ? <ProTag /> : null}
                  {r.me ? <span className="type-caption text-text-2">You</span> : null}
                </span>
              ) : null}
              <span className="podium-points tabular">
                {formatNumber(r.score)}
                <span className="type-caption ml-0.5 font-semibold text-text-2">pts</span>
              </span>
            </button>
            <span className="podium-step" aria-hidden>
              {r.rank}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function GlobalRowView({
  row: r,
  open,
  onToggle,
  onRoutine,
  onReport,
}: {
  row: GlobalRow;
  open: boolean;
  onToggle: () => void;
  onRoutine: () => void;
  onReport: () => void;
}) {
  return (
    <li className={cn(r.me && 'bg-lime-dim')} data-global-row={r.rank} data-me={r.me || undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'type-headline tabular flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-1',
            MEDAL[r.rank - 1] ?? 'text-text-2',
          )}
          aria-label={`Place ${r.rank}`}
        >
          {r.rank}
        </span>
        <span className={cn('shrink-0', r.pro && 'pro-ring')}>
          <MemberAvatar username={r.name} avatar={r.avatar} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-headline block truncate text-text-1">
            {r.name}
            {r.pro ? <ProTag /> : null}
            {r.me ? <span className="type-subhead ml-1.5 text-text-2">You</span> : null}
          </span>
          {r.username ? (
            <span className="type-subhead block truncate text-text-2">@{r.username}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-right">
          <span className="type-headline tabular block text-text-1">{formatNumber(r.score)}</span>
          <span className="type-caption block text-text-2">
            {r.score === 1 ? 'point' : 'points'}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-text-3 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="px-4 pb-4" data-breakdown>
          <ScoreBreakdown row={r} />
          {!r.me ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <CapsuleButton tone="lime" onClick={onRoutine} data-see-routine>
                See their routine
              </CapsuleButton>
              <button
                type="button"
                onClick={onReport}
                className="pressable tap-target type-subhead px-1 font-medium text-text-2"
                data-report-person
              >
                Report
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** "6 of the top 10 are Pro": shown to free members, counted from the board on screen. */
function ProLeaders({ rows }: { rows: GlobalRow[] }) {
  const top = rows.slice(0, 10);
  const pro = top.filter((r) => r.pro).length;
  if (top.length < 3 || pro === 0) return null;
  return (
    <div className="pro-leaders flex items-center gap-3 rounded-card p-4" data-pro-leaders>
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-text-1">
          {pro} of the top {top.length} {pro === 1 ? 'is' : 'are'} Pro
        </span>
        <span className="type-meta block text-text-2">
          They plan their weeks with the Brain and track their protein. Get your <ProTag /> tag.
        </span>
      </span>
      <Link
        to="/pro"
        className="pressable type-headline inline-flex h-9 shrink-0 items-center rounded-full bg-lime px-4 text-on-lime"
      >
        Get Pro
      </Link>
    </div>
  );
}
